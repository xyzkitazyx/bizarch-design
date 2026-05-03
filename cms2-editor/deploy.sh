#!/bin/bash
# cms2-editor 手動デプロイスクリプト（XSERVER FTP）
# Phase A: 静的HTML直接上書きCMS
#
# 使い方:
#   bash deploy.sh                    # ビルド+dist+api をアップ
#   bash deploy.sh --build-only       # ビルドのみ（アップしない）
#   bash deploy.sh --upload-only      # ビルドせず既存 dist/ をアップ
#   bash deploy.sh --include-data     # data/*.json も同時にアップ（注意）
#   bash deploy.sh -h | --help        # ヘルプ表示
#
# 必要環境変数（~/.config/xserver-ftp.env に記載）:
#   XSERVER_FTP_HOST="sv****.xserver.jp"
#   XSERVER_FTP_USER="..."
#   XSERVER_FTP_PASS="..."

set -euo pipefail

# ============================================================
# 設定
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOME}/.config/xserver-ftp.env"

REMOTE_EDITOR_DIR="/bizarch-design.com/public_html/cms2/editor/"
REMOTE_API_DIR="/bizarch-design.com/public_html/cms2/api/"
REMOTE_DATA_DIR="/bizarch-design.com/public_html/cms2/data/"

LOCAL_DIST="${SCRIPT_DIR}/dist"
LOCAL_API="${SCRIPT_DIR}/api"
LOCAL_DATA="${SCRIPT_DIR}/data"

VERIFY_URL="https://cms2.bizarch-design.com/editor/"

# 集計用カウンタ
UPLOAD_OK=0
UPLOAD_NG=0
SKIP_PATTERNS_API=("test_" ".git")

# ============================================================
# 色付きログ
# ============================================================
if [ -t 1 ]; then
  C_RED=$'\033[1;31m'
  C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'
  C_BLUE=$'\033[1;34m'
  C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_RESET=""
fi

log_info()  { echo "${C_BLUE}[INFO]${C_RESET} $*"; }
log_ok()    { echo "${C_GREEN}[OK]${C_RESET}   $*"; }
log_warn()  { echo "${C_YELLOW}[WARN]${C_RESET} $*"; }
log_error() { echo "${C_RED}[ERR]${C_RESET}  $*" >&2; }

# ============================================================
# ヘルプ
# ============================================================
show_help() {
  cat <<'EOF'
cms2-editor 手動デプロイスクリプト

使い方:
  bash deploy.sh [OPTION]

オプション:
  -h, --help        このヘルプを表示
  --build-only      npm ci && npm run build のみ実行（アップロードしない）
  --upload-only     既存の dist/ と api/ をアップロード（ビルドしない）
  --include-data    data/*.json も同時にアップロード（本番データ上書き注意）

アップロード先:
  dist/      → /bizarch-design.com/public_html/cms2/editor/
  api/*.php  → /bizarch-design.com/public_html/cms2/api/
  data/*.json → /bizarch-design.com/public_html/cms2/data/  (--include-data 時のみ)

必要な環境変数ファイル:
  ~/.config/xserver-ftp.env
    XSERVER_FTP_HOST="sv****.xserver.jp"
    XSERVER_FTP_USER="..."
    XSERVER_FTP_PASS="..."
EOF
}

# ============================================================
# 引数解析
# ============================================================
DO_BUILD=1
DO_UPLOAD=1
INCLUDE_DATA=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    --build-only)
      DO_BUILD=1
      DO_UPLOAD=0
      ;;
    --upload-only)
      DO_BUILD=0
      DO_UPLOAD=1
      ;;
    --include-data)
      INCLUDE_DATA=1
      ;;
    *)
      log_error "不明なオプション: $1"
      show_help
      exit 1
      ;;
  esac
  shift
done

# ============================================================
# 環境変数の読み込み
# ============================================================
if [ ! -f "$ENV_FILE" ]; then
  log_error "環境変数ファイルが見つかりません: $ENV_FILE"
  log_error "以下の内容で作成してください:"
  log_error '  XSERVER_FTP_HOST="sv****.xserver.jp"'
  log_error '  XSERVER_FTP_USER="..."'
  log_error '  XSERVER_FTP_PASS="..."'
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${XSERVER_FTP_HOST:?XSERVER_FTP_HOST が未設定です}"
: "${XSERVER_FTP_USER:?XSERVER_FTP_USER が未設定です}"
: "${XSERVER_FTP_PASS:?XSERVER_FTP_PASS が未設定です}"

# ============================================================
# curl での単一ファイルアップロード
# ============================================================
upload_file() {
  local local_path="$1"
  local remote_dir="$2"
  local relative="$3"

  local url="ftp://${XSERVER_FTP_HOST}${remote_dir}${relative}"
  local target_dir
  target_dir="$(dirname "$relative")"

  # 中間ディレクトリも作成（--ftp-create-dirs）
  if curl --silent --show-error --fail \
        --ftp-create-dirs \
        --user "${XSERVER_FTP_USER}:${XSERVER_FTP_PASS}" \
        --upload-file "$local_path" \
        "$url"; then
    log_ok "  ↑ ${relative}"
    UPLOAD_OK=$((UPLOAD_OK + 1))
  else
    log_error "  × ${relative}"
    UPLOAD_NG=$((UPLOAD_NG + 1))
  fi
}

# ディレクトリを再帰的にアップロード（除外パターン対応）
upload_directory() {
  local local_root="$1"
  local remote_dir="$2"
  local label="$3"
  shift 3
  local skip_patterns=("$@")

  if [ ! -d "$local_root" ]; then
    log_warn "${label}: ディレクトリ無し ${local_root} → スキップ"
    return
  fi

  log_info "${label} を ${remote_dir} にアップロード中..."

  # find でファイル一覧を取得
  while IFS= read -r -d '' file; do
    local relative="${file#${local_root}/}"

    # 除外チェック
    local skip=0
    for pat in "${skip_patterns[@]}"; do
      if [[ "$relative" == *"$pat"* ]]; then
        skip=1
        break
      fi
    done

    if [ $skip -eq 1 ]; then
      continue
    fi

    upload_file "$file" "$remote_dir" "$relative"
  done < <(find "$local_root" -type f -print0)
}

# ============================================================
# ビルド
# ============================================================
if [ "$DO_BUILD" -eq 1 ]; then
  log_info "依存パッケージをインストール中（npm ci）..."
  cd "$SCRIPT_DIR"
  if ! npm ci; then
    log_error "npm ci に失敗しました"
    exit 1
  fi

  log_info "Astro をビルド中（npm run build）..."
  if ! npm run build; then
    log_error "npm run build に失敗しました"
    exit 1
  fi

  log_ok "ビルド完了: ${LOCAL_DIST}"
fi

# ============================================================
# アップロード
# ============================================================
if [ "$DO_UPLOAD" -eq 1 ]; then
  if [ ! -d "$LOCAL_DIST" ]; then
    log_error "dist/ が見つかりません。先に bash deploy.sh --build-only を実行してください"
    exit 1
  fi

  # 1. dist/ → /editor/
  upload_directory "$LOCAL_DIST" "$REMOTE_EDITOR_DIR" "dist (editor SPA)" ".git" "node_modules"

  # 2. api/*.php → /api/  （test_*.php は除外）
  upload_directory "$LOCAL_API" "$REMOTE_API_DIR" "api (PHP)" "${SKIP_PATTERNS_API[@]}"

  # 3. data/*.json → /data/ （--include-data 時のみ）
  if [ "$INCLUDE_DATA" -eq 1 ]; then
    log_warn "data/*.json をアップロード（本番データ上書き注意）..."
    upload_directory "$LOCAL_DATA" "$REMOTE_DATA_DIR" "data (JSON)" "_backup" "users.json" "error.log" "backups"
  else
    log_info "data/ はスキップ（--include-data でアップ可能）"
  fi
fi

# ============================================================
# 集計＆動作確認URL表示
# ============================================================
echo ""
echo "=================================================="
log_info "デプロイ集計"
echo "  成功: ${C_GREEN}${UPLOAD_OK}${C_RESET} ファイル"
echo "  失敗: ${C_RED}${UPLOAD_NG}${C_RESET} ファイル"
echo "=================================================="

if [ "$DO_UPLOAD" -eq 1 ]; then
  echo ""
  log_info "動作確認URL:"
  echo "  ${C_BLUE}${VERIFY_URL}${C_RESET}"
  echo ""
fi

if [ "$UPLOAD_NG" -gt 0 ]; then
  log_error "失敗したファイルがあります"
  exit 1
fi

log_ok "全タスク完了"
exit 0
