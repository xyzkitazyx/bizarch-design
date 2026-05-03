import { useState } from 'react';
import { SITES, api, type SiteMeta } from '@/lib/api';

type Device = 'desktop' | 'tablet' | 'mobile';

interface Props {
  siteId: string;
  baseUrl: string;
  onDeviceChange?: (d: Device) => void;
  onSave?: () => Promise<void> | void;
  onPublish?: () => Promise<void> | void;
  onLogout?: () => Promise<void> | void;
}

export default function TopBar({ siteId, baseUrl, onDeviceChange, onSave, onPublish, onLogout }: Props) {
  const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
  const [device, setDevice] = useState<Device>('desktop');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string>('');

  function pickDevice(d: Device) {
    setDevice(d);
    onDeviceChange?.(d);
  }

  async function handleSave() {
    setSaving(true);
    setStatus('保存中...');
    try {
      if (onSave) {
        await onSave();
      } else {
        await api.saveSite(siteId, { html: '', css: '', components: null, styles: null });
      }
      setStatus('保存しました');
    } catch (e) {
      setStatus('保存に失敗しました');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(''), 2000);
    }
  }

  async function handlePublish() {
    if (!confirm(`「${site.name}」を公開しますか？`)) return;
    setPublishing(true);
    setStatus('公開中...');
    try {
      if (onPublish) {
        await onPublish();
      } else {
        await api.publishSite(siteId);
      }
      setStatus('公開しました');
    } catch (e) {
      setStatus('公開に失敗しました');
    } finally {
      setPublishing(false);
      setTimeout(() => setStatus(''), 3000);
    }
  }

  async function handleLogout() {
    if (!confirm('ログアウトしますか？')) return;
    if (onLogout) {
      await onLogout();
    } else {
      await api.logout().catch(() => api.clearToken());
      window.location.href = `${baseUrl}/`;
    }
  }

  return (
    <header className="flex items-center justify-between h-12 px-3 bg-editor-panel border-b border-editor-border text-editor-text z-30">
      {/* 左：ロゴ + サイト切替 */}
      <div className="flex items-center gap-3">
        <a
          href={`${baseUrl}/dashboard/`}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition"
          title="ダッシュボードへ戻る"
        >
          <span className="w-7 h-7 rounded-md bg-gradient-brand grid place-items-center text-white font-black text-sm">
            B
          </span>
          <span className="text-sm font-bold hidden sm:inline">CMS2</span>
        </a>
        <div className="h-5 w-px bg-editor-border" />
        <SiteSwitcher current={site} baseUrl={baseUrl} />
      </div>

      {/* 中央：デバイス切替 */}
      <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
        <DeviceButton label="PC" active={device === 'desktop'} onClick={() => pickDevice('desktop')} icon={iconDesktop} />
        <DeviceButton label="Tab" active={device === 'tablet'} onClick={() => pickDevice('tablet')} icon={iconTablet} />
        <DeviceButton label="SP" active={device === 'mobile'} onClick={() => pickDevice('mobile')} icon={iconMobile} />
      </div>

      {/* 右：保存・公開・ログアウト */}
      <div className="flex items-center gap-2">
        {status && <span className="text-xs text-editor-muted hidden md:inline">{status}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 border border-editor-border hover:bg-white/10 transition disabled:opacity-50"
          title="Ctrl+S でも保存できます"
        >
          {saving ? '保存中' : '保存'}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-soft-coral text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {publishing ? '公開中' : '公開する'}
        </button>
        <div className="h-5 w-px bg-editor-border mx-1" />
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md text-editor-muted hover:text-editor-text hover:bg-white/5 transition"
          title="ログアウト"
          aria-label="ログアウト"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function DeviceButton({
  label, active, onClick, icon,
}: { label: string; active: boolean; onClick: () => void; icon: JSX.Element }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition ${
        active
          ? 'bg-electric-blue text-white shadow'
          : 'text-editor-muted hover:text-editor-text hover:bg-white/5'
      }`}
      aria-pressed={active}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SiteSwitcher({ current, baseUrl }: { current: SiteMeta; baseUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium hover:bg-white/5 transition"
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: current.themeColor }}
        />
        <span className="font-bold">{current.name}</span>
        <svg className="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-editor-panel border border-editor-border rounded-lg shadow-xl py-1 z-50"
          onMouseLeave={() => setOpen(false)}
        >
          {SITES.map((s) => (
            <a
              key={s.id}
              href={`${baseUrl}/site/${s.id}/`}
              className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition ${
                s.id === current.id ? 'bg-white/5' : ''
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: s.themeColor }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold">{s.name}</div>
                <div className="text-editor-muted text-[10px] font-mono truncate">{s.domain}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const iconDesktop = (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="2" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const iconTablet = (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
    <rect x="2.5" y="1.5" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
const iconMobile = (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
    <rect x="3.5" y="1.5" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
