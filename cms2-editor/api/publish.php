<?php
// =====================================================
// publish.php — 編集データを実HTMLに反映 (Day 2 完全版)
//   POST {site, page='/'}
//   - cms2/data/{site}.json から HTML/CSS を取り出し
//   - 許可リスト内のターゲットディレクトリに index.html を書き出し
//   - ターゲット allowlist 外は 403
//   - 公開ログを残す
//   レスポンス: { ok:true, publishedAt, site, urls:[...], pages:[...] }
// =====================================================
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

require_auth();
require_csrf();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  ng('POSTでアクセスしてください', 405, 'METHOD_NOT_ALLOWED');
}

global $cms2_publish_targets;

$body = read_json_body();
$site = (string)($body['site'] ?? '');
if (!valid_site($site)) ng('不明なサイトです', 400, 'INVALID_SITE');

$pageFilter = (string)($body['page'] ?? '');
if ($pageFilter !== '' && !valid_slug($pageFilter)) {
  ng('ページslugが不正です', 400, 'INVALID_SLUG');
}

// -----------------------------------------------------
// corp は Astro ビルドが必要なので Phase 2
// -----------------------------------------------------
if ($site === 'corp') {
  ok([
    'site' => $site,
    'publishedAt' => date('c'),
    'warning' => 'corp サイトは Astro ビルドが必要なため、Phase 2 で対応予定です。今は data の保存のみ完了しています。',
    'urls' => [],
  ]);
}

// -----------------------------------------------------
// データ読込
// -----------------------------------------------------
$file = ensure_within(CMS2_DATA_DIR, CMS2_DATA_DIR . "/{$site}.json");
if (!file_exists($file)) {
  ng('公開対象データが見つかりません。先に保存してください', 404, 'NO_DATA');
}
$raw = @file_get_contents($file);
$data = json_decode($raw ?: '{}', true);
if (!is_array($data)) ng('データが破損しています', 500, 'BROKEN_JSON');

// 旧形式救済
if (isset($data['data']) && !isset($data['pages'])) {
  $legacy = $data['data'];
  $data['pages'] = [[
    'slug' => '/', 'title' => 'トップ',
    'html' => (string)($legacy['html'] ?? ''),
    'css' => (string)($legacy['css'] ?? ''),
  ]];
}
$pages = is_array($data['pages'] ?? null) ? $data['pages'] : [];
if (empty($pages)) {
  ng('公開可能なページがありません', 400, 'NO_PAGES');
}

// 該当ページに絞り込み
if ($pageFilter !== '') {
  $pages = array_values(array_filter($pages, fn($p) => ($p['slug'] ?? '') === $pageFilter));
  if (empty($pages)) {
    ng('指定ページが見つかりません', 404, 'PAGE_NOT_FOUND');
  }
}

// -----------------------------------------------------
// ターゲットディレクトリ allowlist チェック
// -----------------------------------------------------
$targetBase = $cms2_publish_targets[$site] ?? null;
if (!$targetBase) ng('このサイトの公開先が設定されていません', 500, 'NO_TARGET');

if (!is_dir($targetBase)) {
  ng("公開先ディレクトリが存在しません: $targetBase", 500, 'TARGET_MISSING');
}
if (!is_writable($targetBase)) {
  ng('公開先に書き込み権限がありません', 500, 'TARGET_NOT_WRITABLE');
}

// -----------------------------------------------------
// 各ページを HTML として書き出し
// -----------------------------------------------------
$urls = [];
$writtenPages = [];

foreach ($pages as $page) {
  $slug = (string)($page['slug'] ?? '/');
  if (!valid_slug($slug)) continue;

  $html = (string)($page['html'] ?? '');
  $css = (string)($page['css'] ?? '');
  $title = (string)($page['title'] ?? 'ページ');

  // ディレクトリ構造を決定
  //  '/'        → index.html
  //  '/about'   → about/index.html  (or about.html)
  //  '/foo/bar' → foo/bar/index.html
  if ($slug === '/') {
    $relPath = 'index.html';
  } else {
    $clean = trim($slug, '/');
    // パス・トラバーサルガード
    if (str_contains($clean, '..')) continue;
    $relPath = $clean . '/index.html';
  }

  $destPath = $targetBase . '/' . $relPath;
  $destPath = ensure_within($targetBase, $destPath);

  $rendered = render_full_html($title, $html, $css, $data);

  // バックアップ（既存があれば .bak 化、世代1のみ）
  if (file_exists($destPath)) {
    @copy($destPath, $destPath . '.bak');
  }

  if (!atomic_write($destPath, $rendered)) {
    ng("公開書き出し失敗: $relPath", 500, 'PUBLISH_WRITE_FAIL');
  }
  @chmod($destPath, 0644);

  $writtenPages[] = $slug;
  $urls[] = build_public_url($site, $slug);
}

// -----------------------------------------------------
// 公開ログ
// -----------------------------------------------------
$logFile = CMS2_DATA_DIR . "/{$site}.publish.log";
$logLine = sprintf("[%s] by=%s pages=%s\n",
  date('c'),
  current_user_id() ?? '-',
  implode(',', $writtenPages)
);
@file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
cms2_log("publish: site=$site pages=" . implode(',', $writtenPages));

ok([
  'site' => $site,
  'publishedAt' => date('c'),
  'pages' => $writtenPages,
  'urls' => $urls,
  'targetBase' => $targetBase,
]);

// =====================================================
// helpers
// =====================================================
function build_public_url(string $site, string $slug): string {
  $domain = match ($site) {
    'aisolobiz' => 'https://aisolobiz.bizarch-design.com',
    'aistartup' => 'https://aistartup.bizarch-design.com',
    'corp'      => 'https://bizarch-design.com',
    default     => "https://{$site}.bizarch-design.com",
  };
  return $domain . ($slug === '/' ? '/' : rtrim($slug, '/') . '/');
}

function render_full_html(string $title, string $bodyHtml, string $css, array $siteData): string {
  $themeColors = $siteData['theme']['colors'] ?? [];
  $primary = htmlspecialchars((string)($themeColors['primary'] ?? '#0066FF'), ENT_QUOTES, 'UTF-8');
  $accent  = htmlspecialchars((string)($themeColors['accent']  ?? '#00C2FF'), ENT_QUOTES, 'UTF-8');
  $titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
  $publishedAt = htmlspecialchars(date('c'), ENT_QUOTES, 'UTF-8');

  // CSS は <style> に直接埋め込み（XSS 対策で </style 文字列を無効化）
  $cssSafe = str_replace('</style', '<\/style', $css);

  return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="cms2-editor / bizarch-design">
  <meta name="cms2-published-at" content="{$publishedAt}">
  <title>{$titleEsc}</title>
  <style>
    :root {
      --color-primary: {$primary};
      --color-accent: {$accent};
    }
    body { margin: 0; font-family: 'Noto Sans JP', sans-serif; -webkit-font-smoothing: antialiased; }
    {$cssSafe}
  </style>
</head>
<body>
{$bodyHtml}
</body>
</html>
HTML;
}
