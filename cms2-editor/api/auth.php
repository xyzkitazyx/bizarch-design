<?php
// =====================================================
// 認証 API (Day 2 完全版)
//   POST {action:'login',  id, password}  → セッション + トークン
//   POST {action:'logout'}                 → セッション破棄
//   GET                                    → 現在のセッション情報
//   POST {action:'verify'}                 → トークン/セッション検証
// =====================================================
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// -----------------------------------------------------
// GET: セッション確認 + CSRF トークン発行
// -----------------------------------------------------
if ($method === 'GET') {
  $userId = current_user_id();
  if (!$userId) {
    ok([
      'authenticated' => false,
      'csrfToken' => csrf_token(),
    ]);
  }
  $u = find_user($userId);
  ok([
    'authenticated' => true,
    'user' => [
      'id' => $userId,
      'name' => $u['name'] ?? $userId,
      'role' => $u['role'] ?? 'user',
    ],
    'csrfToken' => csrf_token(),
  ]);
}

if ($method !== 'POST') {
  ng('GET または POST を使用してください', 405, 'METHOD_NOT_ALLOWED');
}

$body = read_json_body();
$action = (string)($body['action'] ?? '');

// -----------------------------------------------------
// POST login: id + password を受け、users.json と照合
// -----------------------------------------------------
if ($action === 'login') {
  // 簡易レート制限（同一 IP 5 失敗で 5 分ロック）
  $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
  $rateFile = CMS2_DATA_DIR . '/login_rate.json';
  $rate = file_exists($rateFile) ? (json_decode(@file_get_contents($rateFile) ?: '[]', true) ?: []) : [];
  $now = time();
  $rate = array_filter($rate, fn($r) => ($r['ts'] ?? 0) > $now - 300);
  $failsThisIp = array_filter($rate, fn($r) => ($r['ip'] ?? '') === $ip);
  if (count($failsThisIp) >= 5) {
    ng('ログイン失敗が連続しました。5分後に再試行してください', 429, 'RATE_LIMITED');
  }

  $id = trim((string)($body['id'] ?? $body['username'] ?? ''));
  $pass = (string)($body['password'] ?? '');

  if ($id === '' || $pass === '') {
    ng('IDとパスワードを入力してください', 400, 'EMPTY_CREDENTIALS');
  }
  if (!preg_match('/^[a-zA-Z0-9_\-\.]{2,64}$/', $id)) {
    ng('IDの形式が不正です', 400, 'INVALID_ID');
  }

  $user = find_user($id);
  $verified = $user && password_verify($pass, (string)($user['passwordHash'] ?? ''));

  if (!$verified) {
    $rate[] = ['ip' => $ip, 'ts' => $now];
    @file_put_contents($rateFile, json_encode(array_values($rate)), LOCK_EX);
    cms2_log("login failed id=$id");
    ng('IDまたはパスワードが正しくありません', 401, 'BAD_CREDENTIALS');
  }

  // パスワード再ハッシュ（必要なら）
  if (password_needs_rehash((string)$user['passwordHash'], PASSWORD_BCRYPT)) {
    $store = load_users();
    foreach ($store['users'] as &$u) {
      if (($u['id'] ?? '') === $id) {
        $u['passwordHash'] = password_hash($pass, PASSWORD_BCRYPT);
      }
    }
    unset($u);
    save_users($store);
  }

  // セッション固定攻撃対策
  session_regenerate_id(true);
  $_SESSION['cms2_user_id'] = $id;
  $_SESSION['cms2_login_at'] = $now;

  // 成功時はレート記録から該当 IP の失敗を消す
  $rate = array_filter($rate, fn($r) => ($r['ip'] ?? '') !== $ip);
  @file_put_contents($rateFile, json_encode(array_values($rate)), LOCK_EX);

  cms2_log("login success id=$id");
  ok([
    'user' => [
      'id' => $id,
      'name' => $user['name'] ?? $id,
      'role' => $user['role'] ?? 'admin',
    ],
    'token' => issue_token($id),
    'csrfToken' => csrf_token(),
  ]);
}

// -----------------------------------------------------
// POST logout: セッション破棄
// -----------------------------------------------------
if ($action === 'logout') {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
      'expires' => time() - 42000,
      'path' => $params['path'],
      'domain' => $params['domain'],
      'secure' => $params['secure'],
      'httponly' => $params['httponly'],
      'samesite' => $params['samesite'] ?? 'Lax',
    ]);
  }
  @session_destroy();
  ok(['loggedOut' => true]);
}

// -----------------------------------------------------
// POST verify: トークン/セッションの検証
// -----------------------------------------------------
if ($action === 'verify') {
  $userId = current_user_id();
  if (!$userId) ng('未認証です', 401, 'UNAUTHORIZED');
  $u = find_user($userId);
  ok([
    'user' => [
      'id' => $userId,
      'name' => $u['name'] ?? $userId,
      'role' => $u['role'] ?? 'user',
    ],
    'csrfToken' => csrf_token(),
  ]);
}

// -----------------------------------------------------
// POST change_password: 自分のパスワード変更
// -----------------------------------------------------
if ($action === 'change_password') {
  $userId = require_auth();
  require_csrf();
  $current = (string)($body['current'] ?? '');
  $next = (string)($body['next'] ?? '');
  if (strlen($next) < 8) ng('新しいパスワードは8文字以上にしてください', 400, 'WEAK_PASSWORD');
  $u = find_user($userId);
  if (!$u || !password_verify($current, (string)($u['passwordHash'] ?? ''))) {
    ng('現在のパスワードが正しくありません', 401, 'BAD_CREDENTIALS');
  }
  $store = load_users();
  foreach ($store['users'] as &$row) {
    if (($row['id'] ?? '') === $userId) {
      $row['passwordHash'] = password_hash($next, PASSWORD_BCRYPT);
      $row['passwordChangedAt'] = date('c');
    }
  }
  unset($row);
  save_users($store);
  cms2_log("password changed id=$userId");
  ok(['changed' => true]);
}

ng('未対応のactionです', 400, 'UNKNOWN_ACTION');
