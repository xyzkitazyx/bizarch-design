import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ケイパビリティマップデータ（フロントエンド内蔵 / 本番ではPython CGI APIから取得）
const CAPABILITY_MAPS: Record<string, {
  name: string;
  domains: { name: string; capabilities: string[]; color: string }[];
}> = {
  saas: {
    name: 'SaaS 企業',
    domains: [
      { name: 'プロダクト開発', capabilities: ['要件定義', '設計・アーキテクチャ', '開発・テスト', 'リリース管理'], color: '#0066FF' },
      { name: 'カスタマーサクセス', capabilities: ['オンボーディング', 'ヘルススコア管理', 'チャーン防止', 'アップセル'], color: '#8A2BE2' },
      { name: 'セールス & マーケティング', capabilities: ['リード生成', 'ナーチャリング', '商談管理', '契約・更新'], color: '#0066FF' },
      { name: 'データ & アナリティクス', capabilities: ['データ基盤', 'KPI管理', '予測分析', 'レポーティング'], color: '#8A2BE2' },
    ],
  },
  manufacturing: {
    name: '製造業',
    domains: [
      { name: '生産管理', capabilities: ['生産計画', '工程管理', '品質管理', '在庫管理'], color: '#0066FF' },
      { name: 'サプライチェーン', capabilities: ['調達', '物流', '倉庫管理', '需要予測'], color: '#8A2BE2' },
      { name: '研究開発', capabilities: ['技術開発', '製品設計', '試作・評価', '知財管理'], color: '#0066FF' },
      { name: '営業・サービス', capabilities: ['顧客管理', '見積・受注', 'アフターサービス', 'フィードバック収集'], color: '#8A2BE2' },
    ],
  },
  finance: {
    name: '金融業',
    domains: [
      { name: 'リスク管理', capabilities: ['信用リスク', '市場リスク', 'オペリスク', 'コンプライアンス'], color: '#0066FF' },
      { name: '商品・サービス', capabilities: ['商品開発', '価格設定', 'チャネル管理', '顧客セグメント'], color: '#8A2BE2' },
      { name: 'オペレーション', capabilities: ['決済処理', '口座管理', '本人確認', 'レポーティング'], color: '#0066FF' },
      { name: 'デジタル変革', capabilities: ['DX推進', 'API基盤', 'データ活用', 'AI導入'], color: '#8A2BE2' },
    ],
  },
};

type Industry = 'saas' | 'manufacturing' | 'finance';
type Phase = 'select' | 'loading' | 'result';

const industries: { key: Industry; label: string; icon: string }[] = [
  { key: 'saas', label: 'SaaS', icon: '☁️' },
  { key: 'manufacturing', label: '製造業', icon: '🏭' },
  { key: 'finance', label: '金融業', icon: '🏦' },
];

export default function BizbokDemo() {
  const [selected, setSelected] = useState<Industry | null>(null);
  const [phase, setPhase] = useState<Phase>('select');

  const handleAnalyze = useCallback(() => {
    if (!selected) return;
    setPhase('loading');
    // 疑似的な解析時間
    setTimeout(() => setPhase('result'), 2200);
  }, [selected]);

  const handleReset = useCallback(() => {
    setPhase('select');
    setSelected(null);
  }, []);

  const map = selected ? CAPABILITY_MAPS[selected] : null;

  return (
    <div className="max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {/* ===== Phase 1: 業界選択 ===== */}
        {phase === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            {/* 業界選択カード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {industries.map((ind) => (
                <button
                  key={ind.key}
                  onClick={() => setSelected(ind.key)}
                  className={`
                    relative group p-8 rounded-2xl border-2 transition-all duration-300 text-left
                    ${selected === ind.key
                      ? 'border-electric-blue bg-blue-50/50 shadow-lg shadow-blue-500/10'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }
                  `}
                >
                  {/* Blueprint corner marks */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-electric-blue/20 rounded-tl" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-electric-blue/20 rounded-tr" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-electric-blue/20 rounded-bl" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-electric-blue/20 rounded-br" />

                  <span className="text-3xl mb-4 block">{ind.icon}</span>
                  <h3 className="text-lg font-bold mb-1">{ind.label}</h3>
                  <p className="text-sm text-gray-400">
                    {ind.key === 'saas' && 'プロダクト・CS・セールスを網羅'}
                    {ind.key === 'manufacturing' && '生産・サプライチェーンを最適化'}
                    {ind.key === 'finance' && 'リスク管理・DXを加速'}
                  </p>

                  {/* 選択インジケーター */}
                  {selected === ind.key && (
                    <motion.div
                      layoutId="selected-indicator"
                      className="absolute -top-1 -right-1 w-6 h-6 bg-electric-blue rounded-full flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            {/* 解析ボタン */}
            <div className="text-center">
              <button
                onClick={handleAnalyze}
                disabled={!selected}
                className={`
                  inline-flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-base transition-all duration-300
                  ${selected
                    ? 'bg-gradient-to-r from-electric-blue to-deep-purple text-white hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
                </svg>
                解析開始
              </button>
            </div>
          </motion.div>
        )}

        {/* ===== Phase 2: ローディング ===== */}
        {phase === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            {/* Blueprint回転アニメーション */}
            <div className="relative w-32 h-32 mb-8">
              {/* 外輪 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-electric-blue/30"
              />
              {/* 中輪 */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-4 rounded-full border-2 border-deep-purple/40"
              />
              {/* 内輪 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-8 rounded-full border-2 border-electric-blue/50"
              />
              {/* 中央ドット */}
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-gradient-to-br from-electric-blue to-deep-purple"
              />
            </div>

            {/* ステータステキスト */}
            <motion.div className="text-center">
              <LoadingText />
            </motion.div>
          </motion.div>
        )}

        {/* ===== Phase 3: ケイパビリティマップ結果 ===== */}
        {phase === 'result' && map && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* 結果ヘッダー */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center mb-10"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-electric-blue/10 text-electric-blue text-sm font-medium mb-4">
                {map.name} のケイパビリティマップ
              </span>
              <h3 className="text-2xl font-bold text-gray-900">
                ビジネスアーキテクチャ 分析結果
              </h3>
            </motion.div>

            {/* Blueprint風ケイパビリティマップ */}
            <div className="relative p-8 rounded-2xl border-2 border-electric-blue/10 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
              {/* Blueprint Grid Overlay */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: 'linear-gradient(#0066FF 1px, transparent 1px), linear-gradient(90deg, #0066FF 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Corner decorations */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-electric-blue/30" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-electric-blue/30" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-electric-blue/30" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-electric-blue/30" />

              {/* Domain Grid */}
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                {map.domains.map((domain, domainIdx) => (
                  <motion.div
                    key={domain.name}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.2 + domainIdx * 0.15, duration: 0.5, ease: 'easeOut' }}
                    className="group"
                  >
                    <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                      {/* Domain Header */}
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ background: `linear-gradient(135deg, ${domain.color}, ${domain.color}99)` }}
                        >
                          {String(domainIdx + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{domain.name}</h4>
                          <p className="text-[11px] text-gray-400 tracking-wider uppercase">Domain {String(domainIdx + 1).padStart(2, '0')}</p>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="grid grid-cols-2 gap-2">
                        {domain.capabilities.map((cap, capIdx) => (
                          <motion.div
                            key={cap}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + domainIdx * 0.15 + capIdx * 0.08 }}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50/50 transition-colors group/item"
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: domain.color }}
                            />
                            <span className="text-sm text-gray-700 group-hover/item:text-gray-900 transition-colors">
                              {cap}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Center connection lines (decorative) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 hidden md:block"
              >
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-electric-blue/20 animate-spin" style={{ animationDuration: '20s' }} />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-electric-blue/10 to-deep-purple/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-electric-blue/60">CORE</span>
                </div>
              </motion.div>
            </div>

            {/* 下部アクション */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mt-10"
            >
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:border-gray-300 hover:text-gray-900 transition-all"
              >
                別の業界で再分析
              </button>
              <a
                href="/contact/"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-electric-blue to-deep-purple text-white font-medium text-center hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                詳細コンサルティングを相談する
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ステップ表示のローディングテキスト */
function LoadingText() {
  const steps = [
    '業界データを読み込み中...',
    'ケイパビリティを分析中...',
    'マップを生成中...',
  ];
  const [step, setStep] = useState(0);

  // 段階的にテキストを切り替え
  useState(() => {
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  });

  return (
    <>
      <p className="text-lg font-medium text-gray-900 mb-2">解析中</p>
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-sm text-gray-500"
        >
          {steps[step]}
        </motion.p>
      </AnimatePresence>
      {/* Progress bar */}
      <div className="w-48 h-1 bg-gray-100 rounded-full mt-6 mx-auto overflow-hidden">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
          className="h-full bg-gradient-to-r from-electric-blue to-deep-purple rounded-full"
        />
      </div>
    </>
  );
}
