# AI起業シミュレーター - デプロイ手順（Plan A）

## 構成
- 配置：`aistartup/` 配下のVanilla HTML/CSS/JS
- デプロイ先：`https://aistartup.bizarch-design.com/`
- 自動公開：mainブランチへのpushで GitHub Actions が起動

## デプロイフロー

```
git push origin main
       │
       ▼
GitHub Actions (deploy.yml)
       │
       ├─ Step 1〜5: Astro build → dist/
       │
       ├─ Step 6: dist/ → bizarch-design.com（既存・変更なし）
       │
       └─ Step 7: aistartup/ → aistartup.bizarch-design.com（NEW）
```

## 初回セットアップ（1回だけ）

### GitHub Secrets に追加

GitHub の `Settings → Secrets and variables → Actions → New repository secret` で以下を追加：

| Name | Value |
|---|---|
| `FTP_SERVER_DIR_AISTARTUP` | サブドメインのドキュメントルートパス |

**X-Serverでの確認方法**：
1. X-Serverサーバーパネル → サブドメイン設定
2. `aistartup.bizarch-design.com` の「ドキュメントルート」をコピー
3. 通常 `/[サーバーアカウント名]/aistartup.bizarch-design.com/public_html/` の形式

または既存の `FTP_SERVER_DIR` を参考に類推：
- 既存：`/[アカウント]/bizarch-design.com/public_html/`
- サブドメイン：`/[アカウント]/aistartup.bizarch-design.com/public_html/`

## 公開

```bash
cd "C:\Users\xyzki\OneDrive\Desktop\webサイト作る\bizarch-design"
git add aistartup/ .github/workflows/deploy.yml
git commit -m "feat: AI起業シミュレーターをサブドメインに追加"
git push origin main
```

GitHub の `Actions` タブで進捗確認。両方のFTPアップロードが緑になれば完了。

## 動作確認

- メインサイト：https://bizarch-design.com/ （変更なし）
- シミュレーター：https://aistartup.bizarch-design.com/

## ファイル構成

```
aistartup/
├── index.html      # メインUI（免責文言入り）
├── style.css       # bizarch-designトンマナ（Electric Blue × Deep Purple）
├── script.js       # 計算ロジック
├── data.json       # 税率・社保・等級表（2026年4月版）
├── README.md       # シミュレーター仕様
├── DEPLOY.md       # この手順書
└── test_node.js    # ローカル検証用（FTPアップ除外設定済み）
```

## 後日の Plan B 移行

Astro/React版に置き換える場合：
1. `src/pages/aistartup/` 配下にReactコンポーネント追加
2. `astro.config.aistartup.mjs` を作成して別ビルド
3. `deploy.yml` の Step 7 のローカルパスを `./dist-aistartup/` に変更
4. URLは不変（`aistartup.bizarch-design.com`）→ SEO影響なし
