// =====================================================
// PHP API 呼び出しヘルパー（Day 2 完全版対応）
// xserver上の cms2.bizarch-design.com/api/*.php を叩く
// CSRFトークン + Bearerトークンの両方をサポート
// =====================================================

// 開発時はローカルダミー、本番はサブドメインルート配下
const API_BASE =
  typeof window !== 'undefined' && window.location.hostname.includes('bizarch-design.com')
    ? 'https://cms2.bizarch-design.com/api'
    : '/api';

// ---------- 型定義 ----------
export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export interface AuthResponse {
  ok: true;
  user: { id: string; name: string; role?: string };
  token: string;
  csrfToken?: string;
}

export interface SiteMeta {
  id: 'aisolobiz' | 'aistartup' | 'corp';
  name: string;
  domain: string;
  description: string;
  themeColor: string;
}

export interface SiteData {
  html: string;
  css: string;
  components: any;
  styles: any;
}

export interface LoadResponse {
  ok: true;
  site: string;
  name?: string;
  pages?: Array<{ slug: string; title: string; html: string; css: string; components?: any; styles?: any }>;
  theme?: any;
  data: SiteData | null;
  updatedAt: string | null;
  lastModified?: string | null;
}

export interface SaveResponse {
  ok: true;
  site: string;
  page?: string;
  savedAt: string;
}

export interface PublishResponse {
  ok: true;
  site: string;
  publishedAt: string;
  pages?: string[];
  urls?: string[];
  note?: string;
  warning?: string;
}

export interface MediaUploadResponse {
  ok: true;
  url: string;
  path?: string;
  filename?: string;
  name?: string;
  size?: number;
  mime?: string;
  width?: number | null;
  height?: number | null;
}

// ---------- トークン管理 ----------
const TOKEN_KEY = 'cms2_token';
const CSRF_KEY = 'cms2_csrf';

export function saveToken(token: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function clearToken() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CSRF_KEY);
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function saveCsrf(token: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CSRF_KEY, token);
}

function getCsrf(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(CSRF_KEY) ?? '';
}

// CSRFトークンを取得（なければサーバから取り直す）
async function ensureCsrf(): Promise<string> {
  const cached = getCsrf();
  if (cached) return cached;
  try {
    const res = await fetch(`${API_BASE}/auth.php`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-CMS2-Token': getToken() },
    });
    if (!res.ok) return '';
    const body = await res.json().catch(() => null);
    const t = body?.csrfToken ?? '';
    if (t) saveCsrf(t);
    return t;
  } catch {
    return '';
  }
}

// ---------- fetch ラッパ ----------
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (init.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CMS2-Token': token,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (method === 'POST') {
    const csrf = await ensureCsrf();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* */
  }
  // レスポンスがcsrfTokenを含んでいたら更新
  if (body?.csrfToken) saveCsrf(body.csrfToken);
  if (!res.ok || (body && body.ok === false)) {
    const err = body?.error ?? `API ${path} failed: ${res.status}`;
    const e: any = new Error(err);
    e.code = body?.code;
    e.status = res.status;
    throw e;
  }
  return body as T;
}

// ---------- サイト一覧（メタ） ----------
export const SITES: SiteMeta[] = [
  {
    id: 'aisolobiz',
    name: 'AIで一人起業.biz',
    domain: 'aisolobiz.bizarch-design.com',
    description: '個人事業主・副業向け / AIで一人起業の教科書',
    themeColor: '#0066FF',
  },
  {
    id: 'aistartup',
    name: 'AI Startup Studio',
    domain: 'aistartup.bizarch-design.com',
    description: 'スタートアップ・法人向け / AI事業構築',
    themeColor: '#8A2BE2',
  },
  {
    id: 'corp',
    name: 'bizarch-design 本体',
    domain: 'bizarch-design.com',
    description: 'コーポレート / 事業構造の設計コンサル',
    themeColor: '#FF7A59',
  },
];

// ---------- 個別関数（後方互換） ----------
export async function login(id: string, password: string): Promise<AuthResponse> {
  const res = await call<AuthResponse>('auth.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', id, password }),
  });
  if (res.csrfToken) saveCsrf(res.csrfToken);
  return res;
}

export async function logout(): Promise<{ ok: true }> {
  try {
    return await call<{ ok: true }>('auth.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' }),
    });
  } finally {
    clearToken();
  }
}

export async function loadSite(siteId: string): Promise<LoadResponse> {
  return call<LoadResponse>(`load.php?site=${encodeURIComponent(siteId)}`);
}

export async function saveSite(
  siteId: string,
  payload: { html: string; css: string; components: any; styles: any }
): Promise<SaveResponse> {
  return call<SaveResponse>('save.php', {
    method: 'POST',
    body: JSON.stringify({ site: siteId, ...payload }),
  });
}

export async function publishSite(siteId: string): Promise<PublishResponse> {
  return call<PublishResponse>('publish.php', {
    method: 'POST',
    body: JSON.stringify({ site: siteId }),
  });
}

export async function uploadMedia(siteId: string, file: File): Promise<MediaUploadResponse> {
  const fd = new FormData();
  fd.append('site', siteId);
  fd.append('file', file);
  const token = getToken();
  const csrf = await ensureCsrf();
  const headers: Record<string, string> = { 'X-CMS2-Token': token };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(`${API_BASE}/media.php`, {
    method: 'POST',
    headers,
    body: fd,
    credentials: 'include',
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* */
  }
  if (body?.csrfToken) saveCsrf(body.csrfToken);
  if (!res.ok || (body && body.ok === false)) {
    throw new Error(body?.error ?? 'media upload failed');
  }
  return body as MediaUploadResponse;
}

// ---------- 統合API名前空間（推奨） ----------
export const api = {
  /** ログイン → トークン + CSRFを永続化 */
  async login(id: string, password: string) {
    const res = await login(id, password);
    saveToken(res.token);
    if (res.csrfToken) saveCsrf(res.csrfToken);
    return res;
  },
  /** ログアウト（サーバセッション破棄 + ローカル消去） */
  async logout() {
    return logout();
  },
  /** サイトデータ取得 */
  async loadSite(siteId: string) {
    return loadSite(siteId);
  },
  /** サイトデータ保存 */
  async saveSite(siteId: string, payload: { html: string; css: string; components: any; styles: any }) {
    return saveSite(siteId, payload);
  },
  /** メディアアップロード */
  async uploadMedia(siteId: string, file: File) {
    return uploadMedia(siteId, file);
  },
  /** サイト公開 */
  async publishSite(siteId: string) {
    return publishSite(siteId);
  },
  /** トークン保存（直接） */
  saveToken,
  /** トークン取得 */
  getToken,
  /** CSRFトークン取得（取得済みのもの） */
  getCsrf,
  /** トークン削除（ローカルのみ） */
  clearToken,
  /** 認証済みか */
  isAuthenticated,
  /** APIベースURL（GrapesJS asset manager 用） */
  baseUrl: API_BASE,
};
