<?php
/**
 * お問い合わせメール送信 API
 * エックスサーバー + PHP Mailer -> Gmail通知
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'POSTリクエストのみ受け付けています']);
    exit;
}

// リクエストボディの取得
$input = json_decode(file_get_contents('php://input'), true);

$name    = isset($input['name'])    ? htmlspecialchars($input['name'], ENT_QUOTES, 'UTF-8')    : '';
$email   = isset($input['email'])   ? filter_var($input['email'], FILTER_SANITIZE_EMAIL)       : '';
$company = isset($input['company']) ? htmlspecialchars($input['company'], ENT_QUOTES, 'UTF-8') : '';
$message = isset($input['message']) ? htmlspecialchars($input['message'], ENT_QUOTES, 'UTF-8') : '';

// バリデーション
$errors = [];
if (empty($name))    $errors[] = 'お名前は必須です';
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = '有効なメールアドレスを入力してください';
if (empty($message)) $errors[] = 'お問い合わせ内容は必須です';

if (!empty($errors)) {
    echo json_encode(['status' => 'error', 'errors' => $errors]);
    exit;
}

// メール送信設定
// ※エックスサーバーの環境に合わせてSMTP設定を変更してください
$to = 'info@bizarch-design.com'; // 送信先（Gmail等に変更可）
$subject = "【BizArch Design】お問い合わせ: {$name} 様";
$body = <<<EOT
==========================================
BizArch Design Inc. - お問い合わせ
==========================================

お名前: {$name}
メール: {$email}
会社名: {$company}

■ お問い合わせ内容:
{$message}

==========================================
EOT;

$headers = [
    'From: noreply@bizarch-design.com',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
];

$result = mb_send_mail($to, $subject, $body, implode("\r\n", $headers));

if ($result) {
    echo json_encode(['status' => 'ok', 'message' => 'お問い合わせを受け付けました']);
} else {
    echo json_encode(['status' => 'error', 'message' => '送信に失敗しました。しばらく経ってから再度お試しください']);
}
