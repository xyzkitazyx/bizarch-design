// =====================================================
// GrapesJS 設定（Day 2: bizarch-design ブロック群を本実装）
// =====================================================
import type { EditorConfig } from 'grapesjs';

interface BuildOpts {
  /** Asset Manager のアップロード先 URL（省略時はAPI不使用・ローカルURLのみ） */
  assetUploadUrl?: string;
  /** 認証ヘッダ */
  authToken?: string;
  /** サイトID（アップロード時のサーバ識別用） */
  siteId?: string;
}

export function buildGrapesConfig(container: HTMLElement, opts: BuildOpts = {}): EditorConfig {
  return {
    container,
    fromElement: false,
    height: '100%',
    width: 'auto',
    storageManager: false, // 保存はPHP API側で管理
    // 既定のサイドパネルは使わず、独自TopBar+独自ペインへappend
    panels: { defaults: [] },
    // 直接編集を有効化
    showOffsets: true,
    noticeOnUnload: false,
    // PC / Tablet / Mobile の3段階
    deviceManager: {
      devices: [
        { id: 'desktop', name: 'Desktop', width: '' },
        { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
        { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '480px' },
      ],
    },
    canvas: {
      styles: [
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap',
        // bizarch-design 風のベーススタイル（キャンバス内のみ反映）
        // インライン化のため data: URL は使わず、後でaddCss
      ],
      scripts: [],
    },
    // ----- Asset Manager: アップロードはGrapesEditor.tsx側で独自実装 -----
    // （CSRFヘッダや進捗通知が必要なため、AssetManager.upload を上書きしている）
    assetManager: {
      assets: [],
      upload: '',
      uploadName: 'file',
      multiUpload: true,
      autoAdd: true,
      headers: opts.authToken ? { 'X-CMS2-Token': opts.authToken } : {},
      params: opts.siteId ? { site: opts.siteId } : {},
    },
    // ----- ブロック ----
    blockManager: {
      appendTo: '#cms2-blocks',
      blocks: getBizarchBlocks(),
    },
    // ----- レイヤー / セレクタ / スタイル / プロパティ ----
    selectorManager: { appendTo: '#cms2-selectors' },
    styleManager: {
      appendTo: '#cms2-styles',
      sectors: [
        {
          name: 'レイアウト',
          open: true,
          buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'padding', 'margin'],
        },
        {
          name: 'サイズ',
          open: false,
          buildProps: ['width', 'height', 'min-height', 'max-width'],
        },
        {
          name: '装飾',
          open: false,
          buildProps: ['background-color', 'background', 'border', 'border-radius', 'box-shadow', 'opacity'],
        },
        {
          name: 'タイポグラフィ',
          open: false,
          buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align'],
        },
      ],
    },
    layerManager: { appendTo: '#cms2-layers' },
    traitManager: { appendTo: '#cms2-traits' },
  };
}

// =====================================================
// bizarch-design ブロックライブラリ
// 既存サイトで使われているデザインに合わせる
// =====================================================
function getBizarchBlocks() {
  // ブランドカラー
  const C = {
    blue: '#0066FF',
    purple: '#8A2BE2',
    coral: '#FF7A59',
    bgSoft: '#F5F8FF',
    text: '#1A1A1A',
    sub: '#5C6470',
  };

  return [
    // ===== 基本パーツ =====
    {
      id: 'section',
      label: 'セクション',
      category: '基本',
      media: svgIcon(
        '<rect x="3" y="6" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<section style="padding:64px 24px;background:#fff;">
        <div style="max-width:960px;margin:0 auto;text-align:center;">
          <h2 style="font-size:32px;font-weight:900;color:${C.text};margin:0 0 16px;">セクション見出し</h2>
          <p style="font-size:16px;color:${C.sub};line-height:1.8;">本文をここに入力します。</p>
        </div>
      </section>`,
    },
    {
      id: 'heading',
      label: '見出し',
      category: '基本',
      media: svgIcon('<text x="4" y="17" font-size="14" font-weight="900" fill="currentColor">H</text>'),
      content: `<h2 style="font-size:28px;font-weight:900;color:${C.text};margin:0 0 12px;">見出しテキスト</h2>`,
    },
    {
      id: 'text',
      label: 'テキスト',
      category: '基本',
      media: svgIcon(
        '<line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="13" x2="20" y2="13" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<p style="font-size:15px;color:${C.sub};line-height:1.85;margin:0 0 16px;">段落テキストをここに入力します。読みやすい文章で要点を伝えましょう。</p>`,
    },
    {
      id: 'image',
      label: '画像',
      category: '基本',
      media: svgIcon(
        '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="11" r="1.5" fill="currentColor"/><path d="M3 17l5-4 4 3 4-2 5 4" fill="none" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: { type: 'image' },
    },
    {
      id: 'button',
      label: 'ボタン',
      category: '基本',
      media: svgIcon(
        '<rect x="4" y="9" width="16" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<a href="#" style="display:inline-block;padding:14px 32px;border-radius:8px;background:${C.blue};color:#fff;font-weight:700;text-decoration:none;">ボタンテキスト</a>`,
    },

    // ===== bizarch-design 専用 =====
    {
      id: 'hero',
      label: 'ヒーロー',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="3" y="4" width="18" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="7" width="8" height="1.5" fill="currentColor"/><rect x="6" y="10" width="6" height="1" fill="currentColor"/><rect x="6" y="16" width="5" height="2" rx="1" fill="currentColor"/>'
      ),
      content: `<section style="padding:96px 24px;background:linear-gradient(135deg,${C.blue} 0%,${C.purple} 100%);color:#fff;text-align:center;">
        <div style="max-width:880px;margin:0 auto;">
          <p style="font-size:13px;font-weight:700;letter-spacing:0.18em;opacity:0.9;margin:0 0 12px;">BIZARCH DESIGN</p>
          <h1 style="font-size:48px;font-weight:900;line-height:1.25;margin:0 0 20px;">数字で語る<br/>事業構造の設計</h1>
          <p style="font-size:18px;line-height:1.8;opacity:0.92;margin:0 0 32px;">30秒で結論、1分で試算、15分で開業届。<br/>個人事業から法人成りまで、AI時代の起業を数値で答えます。</p>
          <a href="#" style="display:inline-block;padding:16px 36px;border-radius:10px;background:#fff;color:${C.blue};font-weight:900;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,0.18);">無料で試算する</a>
        </div>
      </section>`,
    },
    {
      id: 'hero-split',
      label: 'ヒーロー(分割)',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="3" y="4" width="9" height="14" rx="1" fill="currentColor" opacity="0.4"/><rect x="13" y="4" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<section style="padding:80px 24px;background:#fff;">
        <div style="max-width:1080px;margin:0 auto;display:flex;gap:48px;align-items:center;flex-wrap:wrap;">
          <div style="flex:1 1 380px;">
            <p style="font-size:12px;font-weight:700;color:${C.blue};letter-spacing:0.16em;margin:0 0 12px;">FOR SOLO ENTREPRENEURS</p>
            <h1 style="font-size:42px;font-weight:900;line-height:1.3;color:${C.text};margin:0 0 20px;">AIで一人起業、<br/>数字で答えます。</h1>
            <p style="font-size:16px;color:${C.sub};line-height:1.85;margin:0 0 28px;">8業種×AI活用率の最新データで、副業から専業・法人成りまで完全ガイド。</p>
            <a href="#" style="display:inline-block;padding:14px 28px;border-radius:8px;background:${C.blue};color:#fff;font-weight:700;text-decoration:none;">教科書を読む →</a>
          </div>
          <div style="flex:1 1 380px;">
            <div style="aspect-ratio:4/3;background:${C.bgSoft};border-radius:16px;display:flex;align-items:center;justify-content:center;color:${C.sub};font-size:14px;">画像／グラフ</div>
          </div>
        </div>
      </section>`,
    },
    {
      id: 'qa-card',
      label: 'Q&Aカード',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="6" y="13" font-size="6" font-weight="900" fill="currentColor">Q</text><line x1="10" y1="11" x2="18" y2="11" stroke="currentColor" stroke-width="1"/><line x1="10" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1"/>'
      ),
      content: `<div style="background:#fff;border:1px solid #E5EAF2;border-radius:14px;padding:28px;box-shadow:0 4px 12px rgba(0,0,0,0.04);margin:0 0 16px;">
        <div style="display:flex;gap:14px;margin:0 0 16px;">
          <span style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${C.blue};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;">Q</span>
          <h3 style="font-size:18px;font-weight:700;color:${C.text};margin:6px 0 0;">AIで一人起業、本当にやれる？</h3>
        </div>
        <div style="display:flex;gap:14px;">
          <span style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${C.coral};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;">A</span>
          <p style="font-size:15px;color:${C.sub};line-height:1.85;margin:6px 0 0;">業種と初期投資次第ですが、月10万円〜の副業からは現実的です。8業種別に試算ツールを用意しています。</p>
        </div>
      </div>`,
    },
    {
      id: 'industry-cards',
      label: '業種カード(3列)',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="2" y="6" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="6" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="16" y="6" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>'
      ),
      content: `<section style="padding:64px 24px;background:${C.bgSoft};">
        <div style="max-width:1080px;margin:0 auto;">
          <h2 style="font-size:30px;font-weight:900;text-align:center;color:${C.text};margin:0 0 32px;">業種別 AI活用率</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
            ${[
              { name: 'コンサルティング', rate: '92%', tone: C.blue, body: '提案資料・調査・要約をAIで自動化、月商60万円〜' },
              { name: 'ライティング・編集', rate: '88%', tone: C.purple, body: '構成→執筆→校正までAIで一気通貫、月50万円〜' },
              { name: 'デザイン・制作', rate: '74%', tone: C.coral, body: '画像生成と編集AIで案件単価2倍、月70万円〜' },
            ].map(
              (c) => `
              <div style="background:#fff;border-radius:14px;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
                <div style="font-size:36px;font-weight:900;color:${c.tone};margin:0 0 8px;">${c.rate}</div>
                <h3 style="font-size:17px;font-weight:700;color:${C.text};margin:0 0 8px;">${c.name}</h3>
                <p style="font-size:13px;color:${C.sub};line-height:1.7;margin:0;">${c.body}</p>
              </div>`
            ).join('')}
          </div>
        </div>
      </section>`,
    },
    {
      id: 'cta',
      label: 'CTAバナー',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="3" y="7" width="18" height="10" rx="2" fill="currentColor" opacity="0.15"/><rect x="3" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="10" width="5" height="4" rx="1" fill="currentColor"/>'
      ),
      content: `<section style="padding:56px 24px;background:linear-gradient(135deg,${C.coral} 0%,${C.purple} 100%);color:#fff;">
        <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;">
          <div style="flex:1 1 320px;">
            <h2 style="font-size:26px;font-weight:900;margin:0 0 8px;">15分で開業届を作りませんか？</h2>
            <p style="font-size:14px;opacity:0.92;line-height:1.7;margin:0;">フォーム入力→PDF生成→提出方法ガイドまで完全自動。無料で試せます。</p>
          </div>
          <a href="#" style="display:inline-block;padding:16px 32px;border-radius:10px;background:#fff;color:${C.coral};font-weight:900;text-decoration:none;flex-shrink:0;box-shadow:0 6px 16px rgba(0,0,0,0.18);">今すぐ作成 →</a>
        </div>
      </section>`,
    },
    {
      id: 'table',
      label: '比較表',
      category: 'bizarch-design',
      media: svgIcon(
        '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1"/><line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1"/><line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="1"/><line x1="9" y1="5" x2="9" y2="19" stroke="currentColor" stroke-width="1"/><line x1="15" y1="5" x2="15" y2="19" stroke="currentColor" stroke-width="1"/>'
      ),
      content: `<section style="padding:64px 24px;background:#fff;">
        <div style="max-width:880px;margin:0 auto;">
          <h2 style="font-size:28px;font-weight:900;text-align:center;color:${C.text};margin:0 0 24px;">節税3パターン比較</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:${C.bgSoft};">
                <th style="padding:14px 12px;text-align:left;font-weight:700;color:${C.text};border-bottom:2px solid ${C.blue};">区分</th>
                <th style="padding:14px 12px;text-align:right;font-weight:700;color:${C.text};border-bottom:2px solid ${C.blue};">青色65万</th>
                <th style="padding:14px 12px;text-align:right;font-weight:700;color:${C.text};border-bottom:2px solid ${C.blue};">青色10万</th>
                <th style="padding:14px 12px;text-align:right;font-weight:700;color:${C.text};border-bottom:2px solid ${C.blue};">白色</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:12px;border-bottom:1px solid #E5EAF2;color:${C.sub};">税金負担</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;font-weight:700;color:${C.blue};">最小</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;color:${C.text};">中</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;color:${C.coral};">最大</td></tr>
              <tr><td style="padding:12px;border-bottom:1px solid #E5EAF2;color:${C.sub};">記帳の手間</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;color:${C.coral};">複式</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;color:${C.text};">単式</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E5EAF2;font-weight:700;color:${C.blue};">最少</td></tr>
              <tr><td style="padding:12px;color:${C.sub};">推奨</td><td style="padding:12px;text-align:right;font-weight:900;color:${C.blue};">◎</td><td style="padding:12px;text-align:right;color:${C.text};">○</td><td style="padding:12px;text-align:right;color:${C.sub};">△</td></tr>
            </tbody>
          </table>
        </div>
      </section>`,
    },
    {
      id: 'feature-list',
      label: '機能リスト',
      category: 'bizarch-design',
      media: svgIcon(
        '<circle cx="6" cy="7" r="2" fill="currentColor"/><line x1="11" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="12" r="2" fill="currentColor"/><line x1="11" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="17" r="2" fill="currentColor"/><line x1="11" y1="17" x2="18" y2="17" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<section style="padding:48px 24px;background:#fff;">
        <div style="max-width:720px;margin:0 auto;">
          ${['副業から専業まで段階別ロードマップ', '8業種×AI活用率の最新データ', '15分で開業届PDF自動生成']
            .map(
              (t) => `<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #E5EAF2;">
              <span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:${C.blue};color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;">✓</span>
              <p style="margin:2px 0 0;font-size:15px;color:${C.text};line-height:1.7;">${t}</p>
            </div>`
            )
            .join('')}
        </div>
      </section>`,
    },
    {
      id: 'spacer',
      label: 'スペーサー',
      category: '基本',
      media: svgIcon(
        '<line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.5"/>'
      ),
      content: `<div style="height:48px;"></div>`,
    },
  ];
}

// 小さなSVGアイコンを生成（GrapesJS の media フィールド用）
function svgIcon(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" style="color:#8B92A1;">${inner}</svg>`;
}
