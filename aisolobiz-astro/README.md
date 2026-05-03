# aisolobiz-astro

`aisolobiz.bizarch-design.com` の Astro 化プロジェクト。
既存の静的版 `../aisolobiz/` を段階的にリプレースする。

- **Phase 0 (ここ)**: 初期化 + index.astro 1 ページのみ
- **Phase 1〜N**: 残りページの順次移植
- **将来**: WordPress (ACF + REST API) からデータ取得

---

## ディレクトリ

```
aisolobiz-astro/
├ src/
│  ├ layouts/BaseLayout.astro          # <html>/<head>/Header/Footer/JS
│  ├ components/
│  │  ├ SiteHeader.astro               # 共通ヘッダー
│  │  ├ SiteFooter.astro               # 共通フッター
│  │  ├ HeroSection.astro              # トップヒーロー
│  │  ├ Q5Section.astro                # 30秒Q&A
│  │  ├ MenuCards.astro                # 3つの入り口
│  │  ├ WallsDashboard.astro           # 6つの壁
│  │  ├ DiagnoseSection.astro          # 7問業種診断
│  │  ├ ChapterList.astro              # 12章リスト
│  │  ├ QuickSimulator.astro           # 即試算ウィジェット
│  │  └ CorporateBanner.astro          # 法人成りCTA
│  ├ pages/index.astro                 # トップ (Phase 0 完了)
│  ├ styles/global.css                 # ../aisolobiz/assets/css/common.css を import
│  └ env.d.ts
├ public/
│  ├ assets/svg/    (29 SVG: walls + industry + chapters + favicon + logo)
│  ├ assets/images/ (hero/ogp/profile の 3 PNG)
│  └ assets/js/common.js
├ astro.config.mjs                      # output: static, site: aisolobiz.bizarch-design.com
├ package.json                          # Astro 5 + Tailwind 3
├ tailwind.config.mjs
├ tsconfig.json
└ .gitignore
```

---

## セットアップ & ビルド

```bash
cd aisolobiz-astro
npm install
npm run build       # → dist/ にビルド
npm run preview     # → http://localhost:4321 でプレビュー
```

---

## 移植進捗

| Phase | ページ                  | 状態   | 備考                                          |
| ----- | ----------------------- | ------ | --------------------------------------------- |
| 0     | `index.astro`           | ✅ 完了 | 8 コンポーネントに分解 (Hero/Q5/Menu/Walls/Diagnose/Chapters/QuickSim/CorporateBanner) |
| 1     | `textbook.astro`        | 未着手 | 412KB の超大型ページ。12 章ごとに分割推奨     |
| 2     | `simulator/index.astro` | 未着手 | data.json + script.js + style.css をどう扱うか要検討 |
| 3     | `open.astro`            | 未着手 | 第 5 章「15 分で開業」                        |
| 4     | `downloads.astro`       | 未着手 | 資料ダウンロード一覧                          |
| 5     | `resources.astro`       | 未着手 | 用語集・国保早見表・AIツールリンク集          |
| 6     | `coming-soon.astro`     | 未着手 | クエリパラメータでメッセージ切り替え          |

---

## 各ページの想定コンポーネント分割

### Phase 1: textbook.astro
12 章 × 各セクションで分解:
- `ChapterHeader.astro` (章番号 + タイトル + リード)
- `TakehomeTable.astro` (CH01: 手取り早見表)
- `TaxComparison.astro` (CH02: 節税効果 3 比較)
- `AiToolsTier.astro` (CH03: AI ツール 3 階層)
- `IndustryCatalog.astro` + `Diagnose7Q.astro` (CH04: 業種カタログ + 7 問診断)
- `OpenStepGuide.astro` (CH05: 15 分で開業)
- `ChannelMatrix.astro` (CH06: 5 チャネル)
- `CashflowCalc.astro` (CH07: 固定費 + キャッシュフロー)
- `ExpenseTips.astro` (CH08: 経費術)
- `TaxFilingFlow.astro` (CH09: 確定申告)
- `PitfallList.astro` (CH10: 落とし穴 10 選)
- `PivotGuide.astro` (CH11: やめる/休む/ピボット)
- `GraduationRoad.astro` (CH12: 卒業ロード → 法人版)
- `TextbookTOC.astro` (左サイド固定 TOC)

### Phase 2: simulator/index.astro
- 既存の `aisolobiz/simulator/` は `data.json` + `script.js` + `style.css` の SPA 風構造
- Astro 化する場合の選択肢:
  1. **そのまま public/ にコピー** (ロジック流用、移植コスト 0)
  2. **React/Solid アイランド化** (`SimulatorApp.tsx` を `client:load`)
  3. **Astro の `<script>` でリライト** (バニラ JS のまま再構成)
- 推奨: **(1) → 後日 (2)** の二段構え

### Phase 3-6: open / downloads / resources / coming-soon
- 構造はトップに近い静的セクション集
- 既存 HTML を `<HtmlSection.astro>` 風の汎用カードに差し込む形で 1〜2 日で完了想定

---

## 推奨移植順

1. **Phase 1: simulator** (流入経路が一番太い + JS ロジック移植が要評価)
2. **Phase 2: open** (CTA 動線の中核 / 構造単純)
3. **Phase 3: downloads + resources** (データ駆動なので CMS 化と相性良)
4. **Phase 4: coming-soon** (テンプレ的)
5. **Phase 5: textbook** (最大ボリューム / 章単位で並行作業可)

---

## CMS API 結合のタイミング

**Phase 1〜4 完了後** に WordPress (ACF + REST API) を立てて、

```
src/lib/cms.ts            # fetch wrapper
src/lib/types.ts          # ACF レスポンス型 (cms_specs/03_acf_fields.md 準拠)
```

を追加し、各コンポーネントの `Astro.props` に渡すデータを段階的に CMS 由来に切り替える。

> **参照**: `C:\Users\xyzki\claude_all\01_claude_agent_team\output\ai_solo_business_textbook\cms_specs\03_acf_fields.md`

各セクションコンポーネントは既に **データを Props で受け取る形** に設計済み (Phase 0 では default 値でハードコード)。CMS 連結時はコンポーネントに手を入れず、`index.astro` の呼び出し側のみ書き換えれば OK。

---

## deploy.yml 修正計画 (今回は実行しない)

現在 `.github/workflows/deploy.yml` の Step 8 は `aisolobiz/` を生 FTP で配信している:

```yaml
- name: Deploy AI個人事業の教科書 to XSERVER subdomain
  uses: SamKirkland/FTP-Deploy-Action@v4.3.5
  with:
    local-dir: ./aisolobiz/
    server-dir: ${{ secrets.FTP_SERVER_DIR_AISOLOBIZ }}
```

**移行後 (全ページ Astro 化完了時)** の修正案:

```yaml
- name: Build aisolobiz-astro
  working-directory: ./aisolobiz-astro
  run: |
    npm ci
    npm run build

- name: Deploy aisolobiz-astro/dist to XSERVER subdomain
  uses: SamKirkland/FTP-Deploy-Action@v4.3.5
  with:
    server: ${{ secrets.FTP_SERVER }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    local-dir: ./aisolobiz-astro/dist/
    server-dir: ${{ secrets.FTP_SERVER_DIR_AISOLOBIZ }}
    dangerous-clean-slate: false
```

**段階的移行 (Phase 0 直後の推奨案)**:
- 既存 `./aisolobiz/` を継続デプロイしつつ
- `aisolobiz-astro/dist/` の各ページが完成するたびに、`exclude` で旧 HTML を 1 ページずつ除外していく
- 全ページ移行完了後、Step 8 を上記のビルド + デプロイ案で完全置換

---

## 厳守事項 (作業時ルール)

- ✅ 既存 `../aisolobiz/` は触らない (並行運用)
- ✅ 共通 CSS は `../aisolobiz/assets/css/common.css` を `src/styles/global.css` で import 参照 (複製しない)
- ✅ `public/assets/` は CI ビルドで dist/ に取り込まれるため、SVG/PNG/JS はここに置いた
- ✅ `node_modules` / `dist` / `.astro` はコミット対象外 (.gitignore 済)

---

## 参考リンク

- Astro Docs: https://docs.astro.build
- 既存 aisolobiz 静的版: `../aisolobiz/`
- bizarch-design.com Astro 設定: `../astro.config.mjs`, `../package.json`
- CMS 仕様: `C:\Users\xyzki\claude_all\01_claude_agent_team\output\ai_solo_business_textbook\cms_specs\`
