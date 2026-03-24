import { createClient, type MicroCMSClient } from 'microcms-js-sdk';

// microCMS SDK設定
// 環境変数は .env ファイルで管理する
// MICROCMS_SERVICE_DOMAIN=your-service-domain
// MICROCMS_API_KEY=your-api-key
const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN || '';
const apiKey = import.meta.env.MICROCMS_API_KEY || '';

// 環境変数が未設定の場合はクライアントを作成しない（フォールバックデータを使用）
export const client: MicroCMSClient | null =
  serviceDomain && apiKey
    ? createClient({ serviceDomain, apiKey })
    : null;

// ============================================
// 型定義
// ============================================

/** グローバルナビゲーション（メニュー）の型 */
export type NavItem = {
  id: string;
  label: string;   // メニュー名（日本語）
  slug: string;     // 遷移先URL（例: /services/）
  order: number;    // 表示順
};

/** ヒーローセクションの型（microCMSフィールド名に対応） */
export type HeroContent = {
  id: string;
  title: string;      // メインタイトル
  subtitle: string;   // サブタイトル
  cta: string;        // CTAボタンテキスト
};

/** サービス情報の型 */
export type Service = {
  id: string;
  title: string;
  description: string;
  icon: string;
  slug: string;
};

/** ブログ記事（Insights）の型 */
export type BlogPost = {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  publishedAt: string;
  category: string[];
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
};

// ============================================
// API取得関数
// ============================================

/** グローバルナビゲーションの取得 */
export async function getNavigation(): Promise<NavItem[]> {
  if (!client) return getDefaultNavigation();
  try {
    const response = await client.getList<NavItem>({
      endpoint: 'navigation',
      queries: { orders: 'order' },
    });
    return response.contents;
  } catch {
    return getDefaultNavigation();
  }
}

/** ヒーローコンテンツの取得（コンテンツID: wx85gdyz-2） */
export async function getHeroContent(): Promise<HeroContent | null> {
  if (!client) return null;
  try {
    const response = await client.getListDetail<HeroContent>({
      endpoint: 'top-config',
      contentId: 'wx85gdyz-2',
    });
    return response;
  } catch {
    return null;
  }
}

/** ブログ一覧の取得 */
export async function getBlogPosts(limit = 10): Promise<BlogPost[]> {
  if (!client) return [];
  try {
    const response = await client.getList<BlogPost>({
      endpoint: 'insights',
      queries: {
        limit,
        orders: '-publishedAt',
      },
    });
    return response.contents;
  } catch {
    return [];
  }
}

/** ブログ記事詳細の取得 */
export async function getBlogPost(id: string): Promise<BlogPost | null> {
  if (!client) return null;
  try {
    const response = await client.getListDetail<BlogPost>({
      endpoint: 'insights',
      contentId: id,
    });
    return response;
  } catch {
    return null;
  }
}

// ============================================
// フォールバックデータ（microCMS未設定時）
// ============================================

export function getDefaultNavigation(): NavItem[] {
  return [
    { id: '1', label: 'ホーム', slug: '/', order: 1 },
    { id: '2', label: 'サービス', slug: '/services/', order: 2 },
    { id: '3', label: '方法論', slug: '/methodology/', order: 3 },
    { id: '4', label: 'インサイト', slug: '/insights/', order: 4 },
    { id: '5', label: 'デモ', slug: '/showcase/bizbok-demo/', order: 5 },
    { id: '6', label: 'お問い合わせ', slug: '/contact/', order: 6 },
  ];
}
