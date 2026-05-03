<?php
// =====================================================
// media.php — 画像・ファイルアップロード (Day 2 完全版)
//   POST multipart/form-data: file, [site], [name]
//   保存先: cms2/uploads/{YYYY}/{MM}/{filename}
//   重複時は -2, -3 ... と連番付与
//   レスポンス: { ok:true, url, filename, size, mime, width?, height? }
// =====================================================
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

require_auth();
require_csrf();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  ng('POSTでアクセスしてください', 405, 'METHOD_NOT_ALLOWED');
}

if (!isset($_FILES['file'])) {
  ng('file パラメータがありません', 400, 'NO_FILE');
}

$f = $_FILES['file'];
if (!is_array($f) || !isset($f['error'])) {
  ng('不正なアップロードリクエストです', 400, 'BAD_UPLOAD');
}

if ($f['error'] !== UPLOAD_ERR_OK) {
  $messages = [
    UPLOAD_ERR_INI_SIZE   => 'ファイルがサーバの制限を超えています',
    UPLOAD_ERR_FORM_SIZE  => 'ファイルがフォーム制限を超えています',
    UPLOAD_ERR_PARTIAL    => 'アップロードが途中で切れました',
    UPLOAD_ERR_NO_FILE    => 'ファイルが選択されていません',
    UPLOAD_ERR_NO_TMP_DIR => '一時フォルダがありません',
    UPLOAD_ERR_CANT_WRITE => '書き込みに失敗しました',
    UPLOAD_ERR_EXTENSION  => 'PHP拡張により拒否されました',
  ];
  ng($messages[$f['error']] ?? 'ファイル受信に失敗しました', 400, 'UPLOAD_FAIL');
}

if (!is_uploaded_file($f['tmp_name'])) {
  ng('一時ファイルが不正です', 400, 'NOT_UPLOADED');
}

// -----------------------------------------------------
// サイズ・拡張子チェック
// -----------------------------------------------------
$maxBytes = 10 * 1024 * 1024; // 10MB
if ($f['size'] > $maxBytes) {
  ng('10MBを超えるファイルはアップロードできません', 413, 'TOO_LARGE');
}

$origName = (string)$f['name'];
$ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
$allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf'];
if (!in_array($ext, $allowedExt, true)) {
  ng('対応外の拡張子です（jpg/png/gif/webp/svg/pdf）', 400, 'BAD_EXT');
}

// MIME 二重チェック（finfo）
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($f['tmp_name']) ?: 'application/octet-stream';
$allowedMime = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'text/xml', 'text/plain', // SVG が text/* で来ることあり
  'application/pdf',
];
if (!in_array($mime, $allowedMime, true)) {
  ng("MIMEタイプ不一致: $mime", 400, 'BAD_MIME');
}

// SVG は中身に <script> が無いことを確認（XSS 防止）
if ($ext === 'svg') {
  $content = @file_get_contents($f['tmp_name']) ?: '';
  if (preg_match('/<script\b/i', $content) || preg_match('/on\w+\s*=/i', $content)) {
    ng('SVG内にスクリプト/イベントハンドラが含まれています', 400, 'SVG_UNSAFE');
  }
}

// -----------------------------------------------------
// 保存先決定: uploads/{YYYY}/{MM}/{filename}
// -----------------------------------------------------
$year = date('Y');
$month = date('m');
$baseDir = CMS2_UPLOADS_DIR . "/{$year}/{$month}";
if (!is_dir($baseDir)) {
  if (!@mkdir($baseDir, 0755, true) && !is_dir($baseDir)) {
    ng('保存先ディレクトリ作成失敗', 500, 'MKDIR_FAIL');
  }
}

$cleanName = safe_filename($origName);
if ($cleanName === '' || $cleanName === '.' . $ext) {
  $cleanName = 'file-' . bin2hex(random_bytes(4)) . '.' . $ext;
}

// 重複時は -2, -3 ...
$stem = pathinfo($cleanName, PATHINFO_FILENAME);
$finalName = $cleanName;
$counter = 2;
while (file_exists("{$baseDir}/{$finalName}")) {
  $finalName = "{$stem}-{$counter}.{$ext}";
  $counter++;
  if ($counter > 9999) {
    $finalName = "{$stem}-" . bin2hex(random_bytes(4)) . ".{$ext}";
    break;
  }
}

$destPath = ensure_within(CMS2_UPLOADS_DIR, "{$baseDir}/{$finalName}");

if (!@move_uploaded_file($f['tmp_name'], $destPath)) {
  ng('保存に失敗しました', 500, 'WRITE_FAIL');
}
@chmod($destPath, 0644);

// -----------------------------------------------------
// 画像なら寸法を取得
// -----------------------------------------------------
$width = null;
$height = null;
if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
  $info = @getimagesize($destPath);
  if (is_array($info)) {
    $width = $info[0] ?? null;
    $height = $info[1] ?? null;
  }
}

// 公開 URL 構築
//   xserver では cms2.bizarch-design.com/uploads/... で配信される想定
$publicPath = "/uploads/{$year}/{$month}/{$finalName}";
$base = 'https://cms2.bizarch-design.com';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (str_contains($origin, 'localhost')) $base = $origin;
$publicUrl = $base . $publicPath;

cms2_log("media uploaded: $publicPath ({$f['size']} bytes) by " . (current_user_id() ?? '-'));

ok([
  'url' => $publicUrl,
  'path' => $publicPath,
  'filename' => $finalName,
  'size' => (int)$f['size'],
  'mime' => $mime,
  'width' => $width,
  'height' => $height,
]);
