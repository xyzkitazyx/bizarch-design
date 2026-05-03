<?php
// =====================================================
// cms2-editor 共通: CORS / JSON / 認証 / ログ / セキュリティ
// すべての *.php から先頭で require_once されることを想定
// 本番運用版（Day 2）
// =====================================================
declare(strict_types=1);

// -----------------------------------------------------
// 1. エラー設定（本番では画面に出さない、log は残す）
// -----------------------------------------------------
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// -----------------------------------------------------
// 2. パス定義
//   ・API ファイルから 1 階層上を cms2 ルートとみなす
//   ・xserver の標準パスは /home/{user}/bizarch-design.com/public_html/cms2/
// -----------------------------------------------------
define('CMS2_ROOT', dirname(__DIR__));
define('CMS2_DATA_DIR', CMS2_ROOT . '/data');
define('CMS2_MEDIA_DIR', CMS2_ROOT . '/media');
define('CMS2_UPLOADS_DIR', CMS2_ROOT . '/uploads');
define('CMS2_BACKUP_DIR', CMS2_DATA_DIR . '/backups');
define('CMS2_LOG_FILE', CMS2_DATA_DIR . '/error.log');
define('CMS2_USERS_FILE', CMS2_DATA_DIR . '/users.json');
define('CMS2_SESSION_DIR', CMS2_DATA_DIR . '/sessions');

// 公開ターゲットの絶対パス allowlist（パストラバーサル防止）
define('CMS2_PUBLIC_HTML_BASE', dirname(CMS2_ROOT, 2) . '/public_html');
$cms2_publish_targets = [
  // 全サイト /bizarch-design.com/public_html/ 配下の DocumentRoot に統一
  'aisolobiz' => CMS2_PUBLIC_HTML_BASE . '/aisolobiz.bizarch-design.com',
  'aistartup' => CMS2_PUBLIC_HTML_BASE . '/aistartup.bizarch-design.com',
  // corp は Astro ビルドが必要。Phase 2 で対応
];

// xserver で getcwd が異なる場合の override（環境変数で上書き可）
if (getenv('CMS2_PUBLISH_TARGET_AISOLOBIZ')) {
  $cms2_publish_targets['aisolobiz'] = (string)getenv('CMS2_PUBLISH_TARGET_AISOLOBIZ');
}
if (getenv('CMS2_PUBLISH_TARGET_AISTARTUP')) {
  $cms2_publish_targets['aistartup'] = (string)getenv('CMS2_PUBLISH_TARGET_AISTARTUP');
}

// -----------------------------------------------------
// 3. 必須ディレクトリの作成
// -----------------------------------------------------
foreach ([CMS2_DATA_DIR, CMS2_MEDIA_DIR, CMS2_UPLOADS_DIR, CMS2_BACKUP_DIR, CMS2_SESSION_DIR] as $dir) {
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
}

// error_log を専用ファイルへ
@ini_set('error_log', CMS2_LOG_FILE);

// .htaccess で data/ media/sessions/backups の直接アクセスを禁止
$htaccessDeny = "Order deny,allow\nDeny from all\n";
foreach ([CMS2_DATA_DIR, CMS2_BACKUP_DIR, CMS2_SESSION_DIR] as $dir) {
  $hta = $dir . '/.htaccess';
  if (!file_exists($hta)) {
    @file_put_contents($hta, $htaccessDeny);
  }
}

// -----------------------------------------------------
// 4. CORS（同一サブドメイン中心、必要に応じて localhost）
// -----------------------------------------------------
$allowed_origins = [
  'https://cms2.bizarch-design.com',
  'http://localhost:4321',
  'http://localhost:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Access-Control-Allow-Credentials: true');
  header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, X-CMS2-Token, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Max-Age: 600');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// -----------------------------------------------------
// 5. セッション開始（ファイルベース、独自ディレクトリ）
// -----------------------------------------------------
session_save_path(CMS2_SESSION_DIR);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
$isHttps = (
  ($_SERVER['HTTPS'] ?? '') === 'on'
  || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
);
ini_set('session.cookie_secure', $isHttps ? '1' : '0');
session_name('cms2sid');
if (session_status() !== PHP_SESSION_ACTIVE) {
  @session_start();
}

// -----------------------------------------------------
// 6. 環境変数（HMAC SALT）
// -----------------------------------------------------
define('CMS2_TOKEN_SALT', getenv('CMS2_TOKEN_SALT') ?: 'cms2-bizarch-day2-CHANGE-ME-PLEASE');
define('CMS2_TOKEN_TTL', 60 * 60 * 12); // 12 時間

// -----------------------------------------------------
// 7. JSON ヘルパー
// -----------------------------------------------------
function read_json_body(): array {
  $raw = file_get_contents('php://input') ?: '';
  if ($raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

// 旧名互換
function get_json_input(): array { return read_json_body(); }

function json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function ok(array $payload = []): never {
  json_response(array_merge(['ok' => true], $payload));
}

function ng(string $message, int $status = 400, ?string $code = null): never {
  cms2_log("[NG $status] " . ($code ?? '-') . " $message");
  json_response([
    'ok' => false,
    'error' => $message,
    'code' => $code,
  ], $status);
}

function error_response(string $message, int $status = 400, ?string $code = null): never {
  ng($message, $status, $code);
}

// -----------------------------------------------------
// 8. 簡易ロガー
// -----------------------------------------------------
function cms2_log(string $line): void {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
  $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '-', 0, 120);
  $entry = sprintf("[%s] %s %s — %s\n", date('c'), $ip, $ua, $line);
  @file_put_contents(CMS2_LOG_FILE, $entry, FILE_APPEND | LOCK_EX);
}

// -----------------------------------------------------
// 9. トークン（HMAC、TTL 付き）
//    ステートレスで使えるため API 接続でも便利
// -----------------------------------------------------
function issue_token(string $id): string {
  $payload = json_encode(['id' => $id, 'iat' => time(), 'exp' => time() + CMS2_TOKEN_TTL]);
  $sig = hash_hmac('sha256', $payload, CMS2_TOKEN_SALT);
  return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=') . '.' . $sig;
}

function verify_token(?string $token): ?string {
  if (!$token || !is_string($token)) return null;
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) return null;
  [$b64, $sig] = $parts;
  $payload = base64_decode(strtr($b64, '-_', '+/'), true);
  if ($payload === false) return null;
  $expected = hash_hmac('sha256', $payload, CMS2_TOKEN_SALT);
  if (!hash_equals($expected, $sig)) return null;
  $data = json_decode($payload, true);
  if (!is_array($data) || empty($data['id'])) return null;
  if (isset($data['exp']) && time() > (int)$data['exp']) return null;
  return (string)$data['id'];
}

// -----------------------------------------------------
// 10. 認証チェック（セッション or トークン）
// -----------------------------------------------------
function current_user_id(): ?string {
  // 1) セッション
  if (!empty($_SESSION['cms2_user_id'])) {
    return (string)$_SESSION['cms2_user_id'];
  }
  // 2) ヘッダトークン
  $token = $_SERVER['HTTP_X_CMS2_TOKEN'] ?? '';
  $userId = verify_token($token);
  if ($userId) {
    $_SESSION['cms2_user_id'] = $userId;
    return $userId;
  }
  return null;
}

function require_auth(): string {
  $userId = current_user_id();
  if (!$userId) ng('未認証です', 401, 'UNAUTHORIZED');
  return $userId;
}

// -----------------------------------------------------
// 11. CSRF（POST 系のみ。GET は読み取りなので不要）
//     - セッションごとにトークン発行
//     - クライアントは X-CSRF-Token ヘッダで送る
// -----------------------------------------------------
function csrf_token(): string {
  if (empty($_SESSION['cms2_csrf'])) {
    $_SESSION['cms2_csrf'] = bin2hex(random_bytes(24));
  }
  return (string)$_SESSION['cms2_csrf'];
}

function require_csrf(): void {
  // ログイン前 (auth.php login) は CSRF 不要（セッションが無いため）
  // それ以外の POST はチェック
  $method = $_SERVER['REQUEST_METHOD'] ?? '';
  if ($method !== 'POST') return;
  $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
  $expected = $_SESSION['cms2_csrf'] ?? '';
  // CSRF ヘッダが空でもトークン認証が通っていれば許容（API クライアント用）
  if ($sent === '' && current_user_id()) {
    $token = $_SERVER['HTTP_X_CMS2_TOKEN'] ?? '';
    if (verify_token($token)) return;
  }
  if (!$expected || !hash_equals((string)$expected, (string)$sent)) {
    ng('CSRFトークンが不正です', 403, 'CSRF_INVALID');
  }
}

// -----------------------------------------------------
// 12. 入力バリデーション
// -----------------------------------------------------
function valid_site(string $site): bool {
  // 英数字のみ、許可リスト
  if (!preg_match('/^[a-z0-9]+$/', $site)) return false;
  return in_array($site, ['aisolobiz', 'aistartup', 'corp'], true);
}

function valid_slug(string $slug): bool {
  // /、英数字、ハイフン、アンダースコアのみ
  return (bool)preg_match('#^/[a-zA-Z0-9_\-/]*$#', $slug);
}

function safe_filename(string $name): string {
  // ディレクトリ部分を除去
  $name = basename($name);
  // 拡張子だけ取り出して残りを sanitize
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  $stem = pathinfo($name, PATHINFO_FILENAME);
  $stem = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $stem) ?? 'file';
  $stem = trim($stem, '-_');
  if ($stem === '') $stem = 'file';
  $stem = substr($stem, 0, 80);
  return $ext === '' ? $stem : "$stem.$ext";
}

function ensure_within(string $base, string $candidate): string {
  // realpath で正規化、base の外なら拒否
  $baseReal = realpath($base);
  if ($baseReal === false) {
    @mkdir($base, 0755, true);
    $baseReal = realpath($base) ?: $base;
  }
  $dir = dirname($candidate);
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  // candidate がまだ存在しない場合 dir を realpath
  $candidateReal = realpath($candidate);
  if ($candidateReal === false) {
    $dirReal = realpath(dirname($candidate));
    if ($dirReal === false) ng('保存先が解決できません', 500, 'PATH_RESOLVE_FAIL');
    $candidateReal = $dirReal . DIRECTORY_SEPARATOR . basename($candidate);
  }
  $baseSep = rtrim(str_replace('\\', '/', $baseReal), '/') . '/';
  $candSep = str_replace('\\', '/', $candidateReal);
  if (strpos($candSep, $baseSep) !== 0) {
    ng('不正なパスです', 400, 'PATH_TRAVERSAL');
  }
  return $candidateReal;
}

// -----------------------------------------------------
// 13. ユーザーストレージ（users.json）
//     初期管理者: admin / chacha-2026
// -----------------------------------------------------
function load_users(): array {
  if (!file_exists(CMS2_USERS_FILE)) {
    init_default_users();
  }
  $raw = @file_get_contents(CMS2_USERS_FILE);
  $data = json_decode($raw ?: '{}', true);
  return is_array($data) ? $data : [];
}

function save_users(array $users): void {
  $tmp = CMS2_USERS_FILE . '.tmp';
  if (file_put_contents($tmp, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) {
    ng('users.json の保存に失敗しました', 500, 'USERS_WRITE_FAIL');
  }
  @rename($tmp, CMS2_USERS_FILE);
  @chmod(CMS2_USERS_FILE, 0600);
}

function init_default_users(): void {
  if (file_exists(CMS2_USERS_FILE)) return;
  $defaultId = getenv('CMS2_ADMIN_ID') ?: 'admin';
  $defaultPass = getenv('CMS2_ADMIN_PASS') ?: 'chacha-2026';
  $users = [
    'users' => [
      [
        'id' => $defaultId,
        'name' => '管理者',
        'role' => 'admin',
        'passwordHash' => password_hash($defaultPass, PASSWORD_BCRYPT),
        'createdAt' => date('c'),
      ],
    ],
  ];
  save_users($users);
  cms2_log("init_default_users: created users.json with id={$defaultId}");
}

function find_user(string $id): ?array {
  $store = load_users();
  foreach (($store['users'] ?? []) as $u) {
    if (($u['id'] ?? '') === $id) return $u;
  }
  return null;
}

// -----------------------------------------------------
// 14. ファイル書き込み（atomic、排他ロック）
// -----------------------------------------------------
function atomic_write(string $path, string $contents): bool {
  $dir = dirname($path);
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
  if (file_put_contents($tmp, $contents, LOCK_EX) === false) {
    @unlink($tmp);
    return false;
  }
  if (!@rename($tmp, $path)) {
    @unlink($tmp);
    return false;
  }
  return true;
}

// -----------------------------------------------------
// 15. グローバル例外/エラーハンドラ
// -----------------------------------------------------
set_exception_handler(function (\Throwable $e): void {
  cms2_log('[EXCEPTION] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  if (!headers_sent()) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
  }
  echo json_encode(['ok' => false, 'error' => 'サーバ内部エラー', 'code' => 'INTERNAL'], JSON_UNESCAPED_UNICODE);
  exit;
});

set_error_handler(function (int $no, string $msg, string $file = '', int $line = 0): bool {
  if (!(error_reporting() & $no)) return false;
  cms2_log("[PHP-ERR $no] $msg @ $file:$line");
  return false; // 通常のエラーハンドラも続行
});
