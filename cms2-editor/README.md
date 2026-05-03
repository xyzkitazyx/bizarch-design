# cms2-editor

`cms2.bizarch-design.com/editor/` で稼働する、bizarch-design 向けのビジュアルエディタ管理画面です。
Astro + React + GrapesJS + Tailwind で構築。配信は xserver の静的ホスティング、サーバ処理は PHP API で行います。

---

## ディレクトリ構成

```
cms2-editor/
├ src/
│  ├ pages/
│  │  ├ index.astro          # ログイン画面
│  │  ├ dashboard.astro      # サイト選択ダッシュボード
│  │  └ editor/[site].astro  # エディタ本体（aisolobiz / aistartup / corp）
│  ├ components/
│  │  ├ LoginForm.tsx        # ログインフォーム
│  │  ├ SiteCard.tsx         # サイト選択カード
│  │  ├ TopBar.tsx           # 保存・公開・PC/SP切替
│  │  ├ SiteSwitcher.tsx     # （TopBar 内コンポーネントの再エクスポート）
│  │  └ GrapesEditor.tsx     # GrapesJS Island
│  ├ layouts/
│  │  └ EditorLayout.astro
│  ├ lib/
│  │  ├ api.ts               # PHP API ヘルパー
│  │  └ grapesConfig.ts      # GrapesJS 初期設定
│  └ styles/
│     └ global.css
├ public/favicon.svg
├ api/                       # cms2/api/ にアップロードする PHP
│  ├ _common.php             # 共通: CORS / JSON / 認証
│  ├ auth.php                # ログイン
│  ├ load.php                # サイトデータ読込
│  ├ save.php                # 編集データ保存
│  ├ media.php               # 画像アップロード
│  └ publish.php             # 公開（Day 2 で本実装）
├ data/sites.json            # サイト一覧（メタ）
└ astro.config.mjs           # base: '/editor'
```

---

## 開発手順

```bash
cd cms2-editor
npm install
npm run dev      # http://localhost:4321/editor/
npm run build    # dist/ に出力
npm run preview  # ビルド成果物の確認
```

ローカル起動時は PHP API が無いので、`auth.php` 等の呼び出しは失敗します。
`LoginForm.tsx` 側でフォールバックして dev トークンを発行するため、ID/Pass さえ正しければダッシュボードまで遷移できます。

### Day 1 ログイン情報（スタブ）

| 項目 | 値 |
| --- | --- |
| ID | `admin` |
| Pass | `chacha-2026` |

> 本番運用前に `api/_common.php` の `CMS2_ADMIN_ID` / `CMS2_ADMIN_PASS` を環境変数（または直接書き換え）で必ず変更してください。`CMS2_TOKEN_SALT` も差し替え必須。

---

## デプロイ手順（xserver）

1. ローカルで `npm run build` を実行し、`dist/` フォルダを生成
2. `dist/` の中身をすべて `cms2.bizarch-design.com/editor/` にFTPアップロード
3. `api/` フォルダの中身を `cms2.bizarch-design.com/api/` にFTPアップロード
4. `cms2.bizarch-design.com/data/` ディレクトリを作成（書き込み権限 0755）
5. `cms2.bizarch-design.com/media/` ディレクトリを作成（書き込み権限 0755）
6. `https://cms2.bizarch-design.com/editor/` にアクセスして動作確認

PHP は xserver の標準 PHP 8 系で動きます。`.htaccess` 等は今のところ不要。

---

## 動作確認チェックリスト（Day 1）

- [ ] `/editor/` でログイン画面が表示される
- [ ] `admin / chacha-2026` でログインできる
- [ ] ダッシュボードに 3 サイト（aisolobiz / aistartup / corp）のカードが並ぶ
- [ ] サイトカードをクリックするとエディタ画面に遷移する
- [ ] エディタ TopBar に「サイト切替」「PC/Tab/SP切替」「保存」「公開する」がある
- [ ] エディタ中央の GrapesJS キャンバスがロードされる（空キャンバスでOK）
- [ ] 左ペインにブロック一覧、右ペインにスタイル/プロパティ枠が表示される

---

## Day 2 タスクリスト

### エディタ機能
- [ ] **GrapesJSブロックの本実装**: bizarch-design セクション（Hero / 3カラム特徴 / CTA / FAQ / お問い合わせ など）をブロック化
- [ ] **トレイトの日本語化**: GrapesJS デフォルトの英語UIを日本語ラベルに統一
- [ ] **マイクロCMS連携**: `microcms-js-sdk` を組み込んで動的データ参照
- [ ] **オンスクリーン編集**: テキスト直接編集、ダブルクリックで in-place 編集
- [ ] **リンク編集UI**: ボタンや`<a>`へのURL編集ダイアログ
- [ ] **アンドゥ/リドゥ**のキーバインドとUI

### 画像
- [ ] **画像アップロード本実装**: `media.php` を呼び出してドラッグ&ドロップ対応
- [ ] **アセットマネージャ**: 過去アップロード画像の一覧・選択UI
- [ ] **サムネ自動生成**: WebP 化＋複数サイズ生成（PHP GD or Imagick）

### 公開フロー
- [ ] **ターゲット先デプロイ**: `publish.php` で aisolobiz / aistartup / corp 各サブドメインの該当HTMLにFTP上書き
- [ ] **下書きと公開の二段階管理**: 保存=draft / 公開=production の分離
- [ ] **差分プレビュー**: 公開前に「変更箇所」を可視化

### バージョン管理
- [ ] **バージョン履歴UI**: `data/_backup/` のスナップショットを一覧表示
- [ ] **ロールバック**: 任意バージョンに戻すボタン
- [ ] **コメント機能**: バージョンに任意の説明を付与

### セキュリティ・運用
- [ ] **2FA / IP制限**: ログインの強化
- [ ] **トークン有効期限**: 現状はノーチェック。JWT風に exp 検証
- [ ] **操作ログ**: 誰がいつ何を保存/公開したか
- [ ] **管理者ユーザー追加**: 1ID1Pass → 複数ユーザーへ拡張
- [ ] **CSRFトークン**: 念のため

### UI / UX
- [ ] **ダークモード/ライトモード切替**: 現状はダーク固定
- [ ] **レスポンシブビューの実iframe化**: 公開予定HTMLをiframeで表示
- [ ] **キャンバス上のガイドライン**: グリッド・スナップ
- [ ] **モバイル管理画面の改善**

### ドキュメント
- [ ] **運用マニュアル（社内向け）**: 編集→保存→公開の手順スクリーンショット入り
- [ ] **ブロック一覧カタログ**: 利用できる部品の見本帳

---

## 苦労点 / 注意点

- **ファイル名**: ページパスは `editor/[site].astro` で、`getStaticPaths` により `aisolobiz` / `aistartup` / `corp` の3パターンを事前生成しています。Day 2 でサイトを追加するときは `src/lib/api.ts` の `SITES` 配列に追記すれば自動的にビルドされます。
- **base パス**: `astro.config.mjs` の `base: '/editor'` を変えると全リンクが壊れます。デプロイ先パスを変える場合はここを修正してください。
- **GrapesJS の CSS**: `client:only="react"` で動的読み込みしているため SSR されません。これは GrapesJS が `window` を要求するため。
- **PHP API は同一サブドメイン前提**: `cms2.bizarch-design.com` 配下の `/api/` を叩くため CORS の心配は最小ですが、ローカル開発時は `_common.php` の `$allowed_origins` に `http://localhost:4321` を入れています。

---

## デプロイ手順

### 自動デプロイ（推奨）
`git push origin main` → GitHub Actions が自動でビルド+FTPアップロードします。
ワークフローは `.github/workflows/deploy.yml` の Step 9 に定義されています。

実行内容:
1. `cms2-editor/` で `npm ci && npm run build`
2. `cms2-editor/dist/` を `cms2.bizarch-design.com/editor/` へFTP転送
3. `cms2-editor/api/*.php` を `cms2.bizarch-design.com/api/` へFTP転送（`test_*.php` は除外）

⚠️ `data/` は配布されません（本番側で管理。初回手動アップ済み）。

### 手動デプロイ（GitHub経由しない場合）
```bash
cd cms2-editor
bash deploy.sh                # ビルド+dist+api をアップ
bash deploy.sh --build-only   # ビルドのみ
bash deploy.sh --upload-only  # 既存 dist/ をアップ
bash deploy.sh --include-data # data/*.json も同時にアップ（注意）
bash deploy.sh -h             # ヘルプ
```

### 必要な GitHub Secrets（追加分）
`.github/workflows/deploy.yml` の Step 9 用に、以下2本を **新規追加** してください：

| Secret 名 | 値 | 用途 |
| --- | --- | --- |
| `FTP_SERVER_DIR_CMS2_EDITOR` | `/bizarch-design.com/public_html/cms2/editor/` | dist/ の転送先 |
| `FTP_SERVER_DIR_CMS2_API` | `/bizarch-design.com/public_html/cms2/api/` | api/ の転送先 |

設定手順:
1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. Name と Value を上表のとおり入力 → **Add secret**
4. 既存の `FTP_SERVER` / `FTP_USERNAME` / `FTP_PASSWORD` はそのまま流用されます

### ローカル環境変数（手動デプロイ時）
`~/.config/xserver-ftp.env` を作成してください：
```sh
XSERVER_FTP_HOST="sv****.xserver.jp"
XSERVER_FTP_USER="..."
XSERVER_FTP_PASS="..."
```
このファイルは絶対に Git にコミットしないでください（`.gitignore` 対象外パスのため要注意）。
