<?php
// =====================================================
// save.php — 編集データ保存 (Day 2 完全版)
//   POST {site, page='/', html, css, components, styles, theme}
//   - atomic 書き込み + バックアップ + 直近10件ローテーション
// =====================================================
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

require_auth();
require_csrf();

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'POST') ng('POSTでアクセスしてください', 405, 'METHOD_NOT_ALLOWED');

$body = read_json_body();
$site = (string)($body['site'] ?? '');
if (!valid_site($site)) ng('不明なサイトです', 400, 'INVALID_SITE');

$pageSlug = (string)($body['page'] ?? $body['slug'] ?? '/');
if (!valid_slug($pageSlug)) ng('ページslugが不正です', 400, 'INVALID_SLUG');

$html = (string)($body['html'] ?? '');
$css = (string)($body['css'] ?? '');
$components = $body['components'] ?? null;
$styles = $body['styles'] ?? null;
$theme = isset($body['theme']) && is_array($body['theme']) ? $body['theme'] : null;
$title = isset($body['title']) ? (string)$body['title'] : null;

// 容量制限（1ページあたり 5MB を上限）
$totalBytes = strlen($html) + strlen($css) + strlen(json_encode($components ?? '')) + strlen(json_encode($styles ?? ''));
if ($totalBytes > 5 * 1024 * 1024) {
  ng('1ページあたり5MBまでに制限しています', 413, 'PAYLOAD_TOO_LARGE');
}

$file = ensure_within(CMS2_DATA_DIR, CMS2_DATA_DIR . "/{$site}.json");

// -----------------------------------------------------
// 1. 既存ロード（または初期化）
// -----------------------------------------------------
$existing = null;
if (file_exists($file)) {
  $raw = @file_get_contents($file);
  $existing = json_decode($raw ?: '{}', true);
}
if (!is_array($existing)) $existing = [];

// 旧形式の救済
if (isset($existing['data']) && !isset($existing['pages'])) {
  $legacy = $existing['data'];
  $existing = [
    'site' => $site,
    'name' => $existing['site'] ?? $site,
    'pages' => [
      [
        'slug' => '/',
        'title' => 'トップ',
        'html' => (string)($legacy['html'] ?? ''),
        'css' => (string)($legacy['css'] ?? ''),
        'components' => $legacy['components'] ?? null,
        'styles' => $legacy['styles'] ?? null,
      ],
    ],
    'theme' => null,
    'lastModified' => $existing['updatedAt'] ?? null,
  ];
}

if (empty($existing['pages']) || !is_array($existing['pages'])) {
  $existing['pages'] = [];
}
if (empty($existing['site'])) $existing['site'] = $site;

// -----------------------------------------------------
// 2. バックアップ（保存前のスナップショット）
// -----------------------------------------------------
$backupPath = null;
if (file_exists($file)) {
  $backupName = sprintf('%s_%s.json', $site, date('Ymd-His'));
  $backupPath = ensure_within(CMS2_BACKUP_DIR, CMS2_BACKUP_DIR . "/{$backupName}");
  @copy($file, $backupPath);
  rotate_backups($site, 10);
}

// -----------------------------------------------------
// 3. 該当ページを更新 or 追加
// -----------------------------------------------------
$pageRecord = [
  'slug' => $pageSlug,
  'title' => $title ?? page_title_for($pageSlug),
  'html' => $html,
  'css' => $css,
  'components' => $components,
  'styles' => $styles,
  'updatedAt' => date('c'),
];

$found = false;
foreach ($existing['pages'] as &$p) {
  if (($p['slug'] ?? '') === $pageSlug) {
    // タイトル指定が無ければ既存維持
    if ($title === null && isset($p['title'])) $pageRecord['title'] = $p['title'];
    $p = $pageRecord;
    $found = true;
    break;
  }
}
unset($p);
if (!$found) {
  $existing['pages'][] = $pageRecord;
}

if ($theme !== null) {
  $existing['theme'] = $theme;
}
$existing['lastModified'] = date('c');
$existing['lastEditor'] = current_user_id();

// -----------------------------------------------------
// 4. atomic 書き込み
// -----------------------------------------------------
$json = json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if ($json === false) ng('JSONエンコードに失敗しました', 500, 'JSON_ENCODE_FAIL');

if (!atomic_write($file, $json)) {
  ng('保存に失敗しました', 500, 'WRITE_FAIL');
}

cms2_log("save: site=$site page=$pageSlug bytes=$totalBytes by=" . (current_user_id() ?? '-'));

ok([
  'site' => $site,
  'page' => $pageSlug,
  'savedAt' => $existing['lastModified'],
  'backupPath' => $backupPath ? str_replace(CMS2_ROOT, '', $backupPath) : null,
  'pageCount' => count($existing['pages']),
]);

// -----------------------------------------------------
// helpers
// -----------------------------------------------------
function rotate_backups(string $site, int $keep): void {
  $glob = glob(CMS2_BACKUP_DIR . "/{$site}_*.json") ?: [];
  if (count($glob) <= $keep) return;
  // 古い順にソートして余剰を削除
  usort($glob, fn($a, $b) => filemtime($a) <=> filemtime($b));
  $excess = count($glob) - $keep;
  for ($i = 0; $i < $excess; $i++) {
    @unlink($glob[$i]);
  }
}

function page_title_for(string $slug): string {
  return match ($slug) {
    '/'         => 'トップ',
    '/about'    => 'About',
    '/contact'  => 'お問い合わせ',
    default     => trim($slug, '/') ?: 'ページ',
  };
}
