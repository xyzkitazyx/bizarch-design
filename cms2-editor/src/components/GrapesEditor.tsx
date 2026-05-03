import { useEffect, useRef, useState, useCallback } from 'react';
import TopBar from './TopBar';
import { api } from '@/lib/api';
import { buildGrapesConfig } from '@/lib/grapesConfig';

interface Props {
  siteId: string;
  baseUrl: string;
}

type Device = 'desktop' | 'tablet' | 'mobile';
type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export default function GrapesEditor({ siteId, baseUrl }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>('エディタを準備しています...');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ----- Toast -----
  const pushToast = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, tone === 'error' ? 5000 : 2800);
  }, []);

  // ----- 認証チェック -----
  useEffect(() => {
    if (!api.isAuthenticated()) {
      window.location.href = `${baseUrl}/`;
    }
  }, [baseUrl]);

  // ----- GrapesJS 初期化 -----
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // 動的importでSSRフリーに
        const grapesjs = (await import('grapesjs')).default;
        // @ts-ignore - css import via vite
        await import('grapesjs/dist/css/grapes.min.css');

        if (cancelled || !canvasRef.current) return;

        // Asset Manager のアップロードURLは未設定（後でカスタムフックで処理）
        const config = buildGrapesConfig(canvasRef.current, {
          siteId,
          authToken: api.getToken(),
        });
        const editor = grapesjs.init(config);
        editorRef.current = editor;

        // ----- Asset Manager: drag&dropでファイルが追加されたら独自API経由でアップロード -----
        const am = editor.AssetManager;

        // GrapesJSは uploadFile を上書きできる
        // FileList を受けて独自APIへPOSTし、レスポンスを assets に追加
        editor.on('asset:custom', () => {
          /* placeholder */
        });

        // GrapesJSのデフォルトアップロード挙動を奪い、独自APIに飛ばす
        const origUpload = (am as any).upload;
        (am as any).upload = async (files: FileList) => {
          const list: File[] = files ? Array.from(files) : [];
          for (const file of list) {
            try {
              pushToast('info', `${file.name} をアップロード中...`);
              const r = await api.uploadMedia(siteId, file);
              am.add({ src: r.url, name: r.filename ?? file.name, type: 'image' });
              pushToast('success', `${file.name} をアップロードしました`);
            } catch (e) {
              pushToast('error', `${file.name} のアップロードに失敗しました`);
            }
          }
        };

        // ----- 既存サイトデータの読み込み -----
        try {
          setLoading('サイトデータを読み込み中...');
          const res = await api.loadSite(siteId);
          if (res.data) {
            // components を優先、なければ生HTMLをsetComponents
            if (res.data.components) {
              try {
                editor.setComponents(res.data.components);
              } catch {
                editor.setComponents(res.data.html ?? '');
              }
            } else if (res.data.html) {
              editor.setComponents(res.data.html);
            }
            if (res.data.styles) {
              try {
                editor.setStyle(res.data.styles);
              } catch {
                if (res.data.css) editor.setStyle(res.data.css);
              }
            } else if (res.data.css) {
              editor.setStyle(res.data.css);
            }
            pushToast('info', '既存データを読み込みました');
          } else {
            pushToast('info', '新規サイトです。ブロックを追加して編集を始めましょう');
          }
        } catch (loadErr: any) {
          if (loadErr?.status === 401) {
            // トークン切れ
            api.clearToken();
            pushToast('error', '認証が切れました。再ログインしてください');
            setTimeout(() => (window.location.href = `${baseUrl}/`), 1500);
            return;
          }
          // API未デプロイ／ネット切断時はスタブ動作
          console.warn('[cms2] loadSite failed, starting empty', loadErr);
          pushToast('info', 'API未接続：空キャンバスで開始します');
        }

        setLoading(null);
        setReady(true);

        // キーボードショートカット: Ctrl+S で保存
        const onKeydown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            void handleSave();
          }
        };
        window.addEventListener('keydown', onKeydown);
        // クリーンアップ用に retain
        (editor as any).__cms2_keydown = onKeydown;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'GrapesJSの読み込みに失敗しました';
        setError(msg);
        setLoading(null);
        pushToast('error', msg);
      }
    })();

    return () => {
      cancelled = true;
      try {
        const ed = editorRef.current;
        if (ed?.__cms2_keydown) window.removeEventListener('keydown', ed.__cms2_keydown);
        ed?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // ----- デバイス切替 -----
  function handleDevice(d: Device) {
    if (!editorRef.current) return;
    const map: Record<Device, string> = {
      desktop: 'desktop',
      tablet: 'tablet',
      mobile: 'mobile',
    };
    editorRef.current.setDevice(map[d]);
  }

  // ----- 保存 -----
  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const payload = {
        html: editor.getHtml(),
        css: editor.getCss(),
        components: editor.getComponents(),
        styles: editor.getStyle(),
      };
      await api.saveSite(siteId, payload);
      pushToast('success', '保存しました');
    } catch (e: any) {
      const msg = e?.message ?? '保存に失敗しました';
      pushToast('error', msg);
      throw e;
    }
  }, [siteId, pushToast]);

  // ----- 公開 -----
  const handlePublish = useCallback(async () => {
    try {
      // 公開前に最新を保存
      await handleSave();
      const res = await api.publishSite(siteId);
      const note = res.warning ?? res.note ?? '';
      pushToast('success', `公開しました${note ? `（${note}）` : ''}`);
    } catch (e: any) {
      const msg = e?.message ?? '公開に失敗しました';
      pushToast('error', msg);
      throw e;
    }
  }, [siteId, handleSave, pushToast]);

  // ----- ログアウト -----
  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      api.clearToken();
    }
    window.location.href = `${baseUrl}/`;
  }, [baseUrl]);

  return (
    <div className="editor-shell">
      <TopBar
        siteId={siteId}
        baseUrl={baseUrl}
        onDeviceChange={handleDevice}
        onSave={handleSave}
        onPublish={handlePublish}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 min-h-0">
        {/* 左サイドバー：ブロック・レイヤー */}
        <aside className="w-64 flex-shrink-0 border-r border-editor-border bg-editor-panel flex flex-col">
          <Tab title="ブロック" />
          <div id="cms2-blocks" className="flex-1 overflow-auto p-2 text-xs" />
          <Tab title="レイヤー" />
          <div id="cms2-layers" className="h-40 overflow-auto p-2 text-xs border-t border-editor-border" />
        </aside>

        {/* 中央：キャンバス */}
        <main className="flex-1 min-w-0 bg-editor-bg relative">
          {(!ready || loading) && !error && (
            <div className="absolute inset-0 grid place-items-center text-editor-muted text-sm z-10 bg-editor-bg/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-editor-muted border-t-electric-blue animate-spin" />
                <span>{loading ?? 'エディタを読み込み中...'}</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center px-6 z-10">
              <div className="max-w-md text-center">
                <div className="text-soft-coral font-bold mb-2">読み込みエラー</div>
                <p className="text-xs text-editor-muted leading-relaxed mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-md text-xs font-bold bg-electric-blue text-white hover:opacity-90 transition"
                >
                  再読み込み
                </button>
              </div>
            </div>
          )}
          <div ref={canvasRef} className="w-full h-full" />
        </main>

        {/* 右サイドバー：プロパティ */}
        <aside className="w-72 flex-shrink-0 border-l border-editor-border bg-editor-panel flex flex-col">
          <Tab title="セレクタ" />
          <div id="cms2-selectors" className="px-2 py-2 text-xs" />
          <Tab title="スタイル" />
          <div id="cms2-styles" className="flex-1 overflow-auto p-2 text-xs border-t border-editor-border" />
          <Tab title="プロパティ" />
          <div id="cms2-traits" className="h-40 overflow-auto p-2 text-xs border-t border-editor-border" />
        </aside>
      </div>

      {/* トースト通知 */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold border min-w-[200px] max-w-sm transition-all ${
              t.tone === 'success'
                ? 'bg-emerald-500/95 text-white border-emerald-400'
                : t.tone === 'error'
                ? 'bg-soft-coral/95 text-white border-soft-coral'
                : 'bg-editor-panel/95 text-editor-text border-editor-border'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tab({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-editor-muted bg-black/20">
      {title}
    </div>
  );
}
