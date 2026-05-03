import type { SiteMeta } from '@/lib/api';

interface Props {
  site: SiteMeta;
  baseUrl: string;
}

export default function SiteCard({ site, baseUrl }: Props) {
  const href = `${baseUrl}/site/${site.id}/`;
  return (
    <a
      href={href}
      className="group relative block rounded-2xl bg-white border border-gray-100 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-brand"
    >
      {/* テーマカラーバー */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${site.themeColor}, #8A2BE2)` }}
      />

      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl text-white font-black grid place-items-center text-lg shadow-md flex-shrink-0"
          style={{ background: site.themeColor }}
        >
          {site.id.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 mb-0.5">{site.name}</h3>
          <p className="text-[11px] text-gray-400 font-mono truncate">{site.domain}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-600 leading-relaxed">{site.description}</p>

      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-electric-blue">
          編集を開く
          <svg className="w-3 h-3 transition-transform group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
            <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[10px] text-gray-300 font-mono">id: {site.id}</span>
      </div>
    </a>
  );
}
