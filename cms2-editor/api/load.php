<?php
// =====================================================
// load.php — サイト編集データの読み込み (Day 2 完全版)
//   GET ?site=aisolobiz[&page=/]
// =====================================================
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

require_auth();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') ng('GET でアクセスしてください', 405, 'METHOD_NOT_ALLOWED');

$site = (string)($_GET['site'] ?? '');
if (!valid_site($site)) ng('不明なサイトです', 400, 'INVALID_SITE');

$pageQuery = (string)($_GET['page'] ?? '');
if ($pageQuery !== '' && !valid_slug($pageQuery)) {
  ng('ページslugが不正です', 400, 'INVALID_SLUG');
}

$file = ensure_within(CMS2_DATA_DIR, CMS2_DATA_DIR . "/{$site}.json");

// -----------------------------------------------------
// 初回アクセス時はデフォルト構造で初期化
// -----------------------------------------------------
if (!file_exists($file)) {
  $default = default_site_payload($site);
  atomic_write($file, json_encode($default, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  cms2_log("load: initialized default for site=$site");
}

$raw = @file_get_contents($file);
if ($raw === false) ng('データ読込に失敗しました', 500, 'READ_FAIL');

$data = json_decode($raw, true);
if (!is_array($data)) {
  ng('データが破損しています', 500, 'BROKEN_JSON');
}

// 旧形式（Day 1: { site, updatedAt, data:{html,css,...} }）を新形式に変換
if (isset($data['data']) && !isset($data['pages'])) {
  $legacy = $data['data'];
  $data = [
    'site' => $site,
    'name' => default_site_name($site),
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
    'theme' => default_theme($site),
    'lastModified' => $data['updatedAt'] ?? date('c'),
  ];
}

// 互換: 既存 client は data オブジェクトと updatedAt を期待
$primaryPage = null;
if ($pageQuery !== '') {
  foreach (($data['pages'] ?? []) as $p) {
    if (($p['slug'] ?? '') === $pageQuery) { $primaryPage = $p; break; }
  }
  if ($primaryPage === null) {
    ng('指定ページが見つかりません', 404, 'PAGE_NOT_FOUND');
  }
} else {
  $primaryPage = $data['pages'][0] ?? null;
}

ok([
  'site' => $site,
  'name' => $data['name'] ?? default_site_name($site),
  'pages' => $data['pages'] ?? [],
  'theme' => $data['theme'] ?? default_theme($site),
  'lastModified' => $data['lastModified'] ?? null,
  // 既存クライアント（GrapesEditor）互換
  'data' => $primaryPage ? [
    'html' => (string)($primaryPage['html'] ?? ''),
    'css' => (string)($primaryPage['css'] ?? ''),
    'components' => $primaryPage['components'] ?? null,
    'styles' => $primaryPage['styles'] ?? null,
  ] : null,
  'updatedAt' => $data['lastModified'] ?? null,
]);

// -----------------------------------------------------
// helpers
// -----------------------------------------------------
function default_site_name(string $site): string {
  return match ($site) {
    'aisolobiz' => 'aisolobiz.bizarch-design.com',
    'aistartup' => 'aistartup.bizarch-design.com',
    'corp'      => 'bizarch-design.com',
    default     => $site,
  };
}

function default_theme(string $site): array {
  return match ($site) {
    'aisolobiz' => ['colors' => ['primary' => '#0066FF', 'accent' => '#00C2FF'], 'fonts' => ['body' => 'Noto Sans JP', 'heading' => 'Noto Sans JP']],
    'aistartup' => ['colors' => ['primary' => '#8A2BE2', 'accent' => '#FF7AE6'], 'fonts' => ['body' => 'Noto Sans JP', 'heading' => 'Noto Sans JP']],
    'corp'      => ['colors' => ['primary' => '#FF7A59', 'accent' => '#FFB199'], 'fonts' => ['body' => 'Noto Sans JP', 'heading' => 'Noto Sans JP']],
    default     => ['colors' => ['primary' => '#000', 'accent' => '#666'], 'fonts' => ['body' => 'Noto Sans JP', 'heading' => 'Noto Sans JP']],
  };
}

function default_site_payload(string $site): array {
  return [
    'site' => $site,
    'name' => default_site_name($site),
    'pages' => [
      [
        'slug' => '/',
        'title' => 'トップ',
        'html' => '',
        'css' => '',
        'components' => null,
        'styles' => null,
      ],
    ],
    'theme' => default_theme($site),
    'lastModified' => date('c'),
  ];
}
