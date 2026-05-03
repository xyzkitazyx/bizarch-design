import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  simulate,
  fmtMan,
  buildWarnings,
  buildSensitivity,
  runTests,
  type SimulatorInput,
  type PatternKey,
  type ScenarioResult,
} from '../lib/simulator/calc';
import { INDUSTRIES, type IndustryKey } from '../lib/simulator/data';

/* =========================================================
 * 共通のSVGアイコン群（Heroicons stroke-1.5）
 * ======================================================== */
const IconBuilding = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
  </svg>
);

const IconCoin = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconWallet = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
  </svg>
);

const IconUser = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

const IconBolt = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconReceipt = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
  </svg>
);

const IconChartBar = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

const IconDoc = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const IconTrend = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
);

const IconWarning = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

/* =========================================================
 * デフォルト入力
 * ======================================================== */
const DEFAULT_INDUSTRY: IndustryKey = '受託開発';
const DEFAULT_INPUT: SimulatorInput = {
  industry: DEFAULT_INDUSTRY,
  revenueMan: INDUSTRIES[DEFAULT_INDUSTRY].default_revenue,
  sgaMan: INDUSTRIES[DEFAULT_INDUSTRY].default_sga,
  age40Plus: false,
  pattern: 'optimal',
  customSalaryMan: INDUSTRIES[DEFAULT_INDUSTRY].default_salary_monthly,
  options: {
    tousanboshi: false,
    shokibo: false,
    ideco: false,
    shataku: false,
  },
  rentMonthMan: 15,
  ctTaxable: false,
  ctMethod: 'simplified',
};

const PATTERN_LABELS: Record<PatternKey, string> = {
  optimal: '①節税最適',
  maxTakeHome: '②手取り最大',
  micro: '③マイクロ法人型',
  custom: 'カスタム',
};

const INDUSTRY_KEYS = Object.keys(INDUSTRIES) as IndustryKey[];

/* =========================================================
 * カウントアップ（万円表示・小数2桁）
 * ======================================================== */
function CountUp({ valueYen, dp = 2 }: { valueYen: number; dp?: number }) {
  const [display, setDisplay] = useState(valueYen);
  const fromRef = useRef(valueYen);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startedAt.current = null;
    const target = valueYen;
    const from = fromRef.current;
    const dur = 350;
    let raf = 0;
    const step = (ts: number) => {
      if (startedAt.current === null) startedAt.current = ts;
      const elapsed = ts - startedAt.current;
      const t = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueYen]);

  return <span>{fmtMan(display, dp)}</span>;
}

/* =========================================================
 * 数値スライダー（バインド付き）
 * ======================================================== */
function SliderRow({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-electric-blue h-1.5"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-right focus:outline-none focus:border-electric-blue"
      />
    </div>
  );
}

/* =========================================================
 * メインコンポーネント
 * ======================================================== */
export default function SimulatorApp() {
  const [input, setInput] = useState<SimulatorInput>(DEFAULT_INPUT);
  const [debouncedInput, setDebouncedInput] = useState(DEFAULT_INPUT);
  const debounceRef = useRef<number | null>(null);

  // 200ms debounce
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setDebouncedInput(input);
    }, 200);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [input]);

  // 起動時テスト
  useEffect(() => {
    runTests();
  }, []);

  const sim = useMemo(() => simulate(debouncedInput), [debouncedInput]);
  const warnings = useMemo(() => buildWarnings(sim.active), [sim]);
  const sensitivity = useMemo(
    () => buildSensitivity(sim.active, debouncedInput),
    [sim, debouncedInput],
  );

  const handleIndustryChange = (industry: IndustryKey) => {
    const def = INDUSTRIES[industry];
    setInput((prev) => ({
      ...prev,
      industry,
      revenueMan: def.default_revenue,
      sgaMan: def.default_sga,
      customSalaryMan: def.default_salary_monthly,
    }));
  };

  const update = <K extends keyof SimulatorInput>(key: K, val: SimulatorInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  };

  const updateOption = (key: keyof SimulatorInput['options'], val: boolean) => {
    setInput((prev) => ({ ...prev, options: { ...prev.options, [key]: val } }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ============ 左：入力フォーム ============ */}
      <aside className="lg:col-span-1">
        <div className="rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm p-8 hover:border-electric-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all sticky top-24">
          <p className="text-xs font-medium tracking-widest text-electric-blue uppercase mb-2">Inputs</p>
          <h2 className="text-xl font-bold mb-1">前提条件の入力</h2>
          <p className="text-xs text-gray-500 mb-6">業種・年商・役員報酬を変えると右の結果が即座に再計算されます。</p>

          {/* 1. 業種 */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconBuilding />
              1. 業種
            </label>
            <select
              value={input.industry}
              onChange={(e) => handleIndustryChange(e.target.value as IndustryKey)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-electric-blue bg-white"
            >
              {INDUSTRY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1.5">{INDUSTRIES[input.industry].comment}</p>
          </div>

          {/* 2. 年商 */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconCoin />
              2. 年商（万円）
            </label>
            <SliderRow
              value={input.revenueMan}
              onChange={(v) => update('revenueMan', v)}
              min={200}
              max={10000}
              step={100}
            />
          </div>

          {/* 3. 販管費 */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconWallet />
              3. 販管費（万円・年額）
            </label>
            <input
              type="number"
              value={input.sgaMan}
              min={0}
              step={10}
              onChange={(e) => update('sgaMan', Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-electric-blue"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">家賃・ツール・通信費・税理士費用などの固定費合計</p>
          </div>

          {/* 4. 年齢 */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconUser />
              4. 役員の年齢
            </label>
            <div className="space-y-2">
              {[
                { value: false, label: '40歳未満（社保28.38%）' },
                { value: true, label: '40歳以上（社保30.00%・介護込み）' },
              ].map((opt) => (
                <label key={String(opt.value)} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="age"
                    checked={input.age40Plus === opt.value}
                    onChange={() => update('age40Plus', opt.value)}
                    className="accent-electric-blue"
                  />
                  <span className="text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 5. パターン */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconBolt />
              5. 役員報酬パターン
            </label>
            <div className="space-y-2">
              {(['optimal', 'maxTakeHome', 'micro', 'custom'] as PatternKey[]).map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pattern"
                    checked={input.pattern === p}
                    onChange={() => update('pattern', p)}
                    className="accent-electric-blue"
                  />
                  <span className="text-gray-700">
                    {p === 'optimal' && '① 節税最適（自動計算）'}
                    {p === 'maxTakeHome' && '② 手取り最大（自動計算）'}
                    {p === 'micro' && '③ マイクロ法人型（月45,000円）'}
                    {p === 'custom' && 'カスタム（手動入力）'}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-gray-500">役員報酬月額（万円）</span>
              <input
                type="number"
                disabled={input.pattern !== 'custom'}
                value={input.customSalaryMan}
                min={0}
                max={200}
                step={0.5}
                onChange={(e) => update('customSalaryMan', Number(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-right focus:outline-none focus:border-electric-blue disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* 6. 節税オプション */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconCheck />
              6. 節税オプション
            </label>
            <div className="space-y-2">
              {([
                { key: 'tousanboshi', label: '倒産防止共済（年240万まで損金）' },
                { key: 'shokibo', label: '小規模企業共済（月7万・年84万・所得控除）' },
                { key: 'ideco', label: 'iDeCo（月2.3万・年27.6万・所得控除）' },
                { key: 'shataku', label: '社宅制度（家賃年額の50%法人負担）' },
              ] as const).map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!input.options[opt.key]}
                    onChange={(e) => updateOption(opt.key, e.target.checked)}
                    className="accent-electric-blue"
                  />
                  <span className="text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {input.options.shataku && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-gray-500">家賃月額（万円）</span>
                <input
                  type="number"
                  value={input.rentMonthMan}
                  min={0}
                  step={1}
                  onChange={(e) => update('rentMonthMan', Number(e.target.value) || 0)}
                  className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-right focus:outline-none focus:border-electric-blue"
                />
              </div>
            )}
          </div>

          {/* 7. 消費税 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <IconReceipt />
              7. 消費税
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={input.ctTaxable}
                onChange={(e) => update('ctTaxable', e.target.checked)}
                className="accent-electric-blue"
              />
              <span className="text-gray-700">課税事業者である</span>
            </label>
            {input.ctTaxable && (
              <div className="space-y-2 ml-5">
                {([
                  { key: 'simplified', label: '簡易課税（みなし仕入率50%）' },
                  { key: 'standard', label: '本則課税（販管費分の仕入控除）' },
                ] as const).map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="ctMethod"
                      checked={input.ctMethod === opt.key}
                      onChange={() => update('ctMethod', opt.key)}
                      className="accent-electric-blue"
                    />
                    <span className="text-gray-600">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ============ 右：結果表示 ============ */}
      <section className="lg:col-span-2 space-y-8">
        {/* 結果カード（メイン数値） */}
        <ResultCard res={sim.active} pattern={sim.activePattern} />

        {/* 警告 */}
        {warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-900">
                <span className="text-amber-600 flex-shrink-0 mt-0.5">
                  <IconWarning />
                </span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* 3パターン比較表 */}
        <CompareTable results={sim.results} />

        {/* 詳細P&L */}
        <DetailPL res={sim.active} />

        {/* 感度分析 */}
        <Sensitivity rows={sensitivity} baseMonthlyMan={sim.active.scn.salaryMonthlyMan} />

        <p className="text-xs text-gray-400 leading-relaxed">
          ※ 計算前提：東京23区・資本金1,000万円以下・役員1名・定期同額給与。
          扶養家族・iDeCo所得控除・消費税の細部運用は簡略化しています。
          実際の確定申告時には税理士の確認を推奨します。
        </p>
      </section>
    </div>
  );
}

/* =========================================================
 * 結果カード（メイン数値）
 * ======================================================== */
function ResultCard({ res, pattern }: { res: ScenarioResult; pattern: PatternKey }) {
  const monthlyMan = Number(res.scn.salaryMonthlyMan).toFixed(1);
  const yearlyMan = Number(res.scn.salaryMonthlyMan * 12).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 hover:border-electric-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
    >
      {/* Blueprint corner marks */}
      <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-electric-blue/20 rounded-tl pointer-events-none" />
      <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-electric-blue/20 rounded-tr pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-electric-blue/20 rounded-bl pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-electric-blue/20 rounded-br pointer-events-none" />

      <div className="text-xs font-medium tracking-widest text-electric-blue uppercase mb-3">
        Owner&apos;s Annual Take-Home
      </div>
      <div className="text-sm text-gray-500 mb-1">経営者の年間総手取り</div>
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-5xl sm:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-electric-blue to-deep-purple">
          <CountUp valueYen={res.totalTakeHome} />
        </span>
        <span className="text-xl font-bold text-gray-700">万円</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-blue-50/50 p-3">
          <div className="text-[11px] text-gray-500 mb-1">個人手取り</div>
          <div className="text-lg font-bold text-gray-900">
            <CountUp valueYen={res.pers.takeHome} /> <span className="text-xs">万円</span>
          </div>
        </div>
        <div className="rounded-xl bg-purple-50/50 p-3">
          <div className="text-[11px] text-gray-500 mb-1">会社内部留保</div>
          <div className="text-lg font-bold text-gray-900">
            <CountUp valueYen={res.retained} /> <span className="text-xs">万円</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gradient-to-r from-electric-blue/10 to-deep-purple/10 text-electric-blue font-medium">
          {PATTERN_LABELS[pattern]}
        </span>
        <span>役員報酬：月{monthlyMan}万円・年{yearlyMan}万円</span>
      </div>
    </motion.div>
  );
}

/* =========================================================
 * 3パターン比較表
 * ======================================================== */
function CompareTable({
  results,
}: {
  results: { optimal: ScenarioResult; maxTakeHome: ScenarioResult; micro: ScenarioResult };
}) {
  const totals = {
    optimal: results.optimal.totalTakeHome,
    maxTakeHome: results.maxTakeHome.totalTakeHome,
    micro: results.micro.totalTakeHome,
  };
  const winner = (Object.keys(totals) as Array<keyof typeof totals>).reduce(
    (a, b) => (totals[a] >= totals[b] ? a : b),
  );

  const fields: Array<{ label: string; format: (r: ScenarioResult) => string }> = [
    { label: '役員報酬（月額）', format: (r) => `${Number(r.scn.salaryMonthlyMan).toFixed(1)}万円/月` },
    { label: '役員報酬（年額）', format: (r) => fmtMan(r.salaryYr) },
    { label: '法人所得', format: (r) => fmtMan(r.corp.corpIncome) },
    { label: '会社の税金合計', format: (r) => fmtMan(r.corp.total + r.ct) },
    { label: '個人税・社保合計', format: (r) => fmtMan(r.si.individualYearly + r.pers.totalPersonalTax) },
    { label: '役員手取り', format: (r) => fmtMan(r.pers.takeHome) },
    { label: '会社の内部留保', format: (r) => fmtMan(r.retained) },
  ];

  const cols: Array<{ key: 'optimal' | 'maxTakeHome' | 'micro'; label: string }> = [
    { key: 'optimal', label: '①節税最適' },
    { key: 'maxTakeHome', label: '②手取り最大' },
    { key: 'micro', label: '③マイクロ法人型' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-gray-100 bg-white p-8 hover:border-electric-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
    >
      <p className="text-xs font-medium tracking-widest text-electric-blue uppercase mb-2">Comparison</p>
      <h2 className="flex items-center gap-2 text-xl font-bold mb-5">
        <IconChartBar />
        3パターン比較
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">項目</th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`text-right py-2 px-2 text-xs font-medium ${
                    winner === c.key ? 'text-electric-blue' : 'text-gray-500'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.label} className="border-b border-gray-50">
                <td className="py-2 px-2 text-gray-700">{f.label}</td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={`text-right py-2 px-2 font-medium tabular-nums ${
                      winner === c.key ? 'bg-blue-50/30 text-electric-blue' : 'text-gray-700'
                    }`}
                  >
                    {f.format(results[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 bg-gradient-to-r from-blue-50/30 to-purple-50/30">
              <td className="py-3 px-2 font-bold text-gray-900">経営者総手取り</td>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`text-right py-3 px-2 font-black tabular-nums ${
                    winner === c.key
                      ? 'bg-clip-text text-transparent bg-gradient-to-r from-electric-blue to-deep-purple text-base'
                      : 'text-gray-700'
                  }`}
                >
                  {fmtMan(results[c.key].totalTakeHome)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        最大の総手取りが出るパターンをハイライト表示しています。
      </p>
    </motion.div>
  );
}

/* =========================================================
 * 詳細P&L
 * ======================================================== */
function PLRow({
  label,
  value,
  bold = false,
  highlight = false,
  minus = false,
  indent = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  minus?: boolean;
  indent?: boolean;
}) {
  return (
    <tr
      className={`border-b border-gray-50 ${
        highlight ? 'bg-gradient-to-r from-blue-50/30 to-purple-50/30' : ''
      }`}
    >
      <td className={`py-1.5 ${indent ? 'pl-6' : 'pl-2'} ${bold ? 'font-bold' : ''} text-gray-700`}>
        {label}
      </td>
      <td
        className={`py-1.5 pr-2 text-right tabular-nums ${
          bold ? 'font-bold' : ''
        } ${minus ? 'text-gray-500' : 'text-gray-900'}`}
      >
        {minus ? '-' : ''}
        {fmtMan(value)}
      </td>
    </tr>
  );
}

function DetailPL({ res }: { res: ScenarioResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl border border-gray-100 bg-white p-8 hover:border-electric-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
    >
      <p className="text-xs font-medium tracking-widest text-electric-blue uppercase mb-2">Detail</p>
      <h2 className="flex items-center gap-2 text-xl font-bold mb-5">
        <IconDoc />
        詳細P&amp;L（選択中のパターン）
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 会社のP&L */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-gray-900">会社のP&amp;L</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <PLRow label="売上" value={res.revenue} />
              <PLRow label="販管費" value={res.sga} minus />
              <PLRow label="役員報酬" value={res.salaryYr} minus />
              <PLRow label="会社負担社保" value={res.si.corporateYearly} minus />
              <PLRow label="節税オプション（損金）" value={res.corpDeduction} minus />
              <PLRow label="法人所得" value={res.corp.corpIncome} bold />
              <PLRow label="法人税" value={res.corp.corpTax} indent />
              <PLRow label="法人住民税均等割" value={res.corp.localFixed} indent />
              <PLRow label="法人住民税法人税割" value={res.corp.localRate} indent />
              <PLRow label="法人事業税" value={res.corp.bizTax} indent />
              <PLRow label="特別法人事業税" value={res.corp.spBizTax} indent />
              <PLRow label="防衛特別法人税" value={res.corp.defenseTax} indent />
              <PLRow label="消費税" value={res.ct} indent />
              <PLRow label="会社の税金合計" value={res.corp.total + res.ct} bold />
              <PLRow label="税引後利益（内部留保）" value={res.retained} bold highlight />
            </tbody>
          </table>
        </div>

        {/* 個人のP&L */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-gray-900">個人のP&amp;L</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <PLRow label="役員報酬" value={res.pers.salaryYearly} />
              <PLRow label="個人負担社保" value={res.si.individualYearly} minus />
              <PLRow label="給与所得控除" value={res.pers.salaryDeduction} minus />
              <PLRow label="給与所得" value={res.pers.salaryIncome} />
              <PLRow label="基礎控除（所得税）" value={res.pers.basicDeduction} minus />
              <PLRow label="その他所得控除" value={res.pers.additionalDeduction} minus />
              <PLRow label="所得税課税所得" value={res.pers.taxable} bold />
              <PLRow label="所得税" value={res.pers.incomeTax} indent />
              <PLRow label="復興特別所得税" value={res.pers.reconstructionTax} indent />
              <PLRow label="住民税所得割" value={res.pers.resident.incomeTaxResident} indent />
              <PLRow label="住民税均等割" value={res.pers.resident.perCapita} indent />
              <PLRow label="個人税合計" value={res.pers.totalPersonalTax} bold />
              <PLRow label="役員手取り" value={res.pers.takeHome} bold highlight />
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================
 * 感度分析
 * ======================================================== */
function Sensitivity({
  rows,
  baseMonthlyMan,
}: {
  rows: ReturnType<typeof buildSensitivity>;
  baseMonthlyMan: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-gray-100 bg-white p-8 hover:border-electric-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
    >
      <p className="text-xs font-medium tracking-widest text-electric-blue uppercase mb-2">Sensitivity</p>
      <h2 className="flex items-center gap-2 text-xl font-bold mb-5">
        <IconTrend />
        感度分析（役員報酬を±10万円変えると）
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">役員報酬月額</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">役員手取り</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">内部留保</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">総手取り</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">差分（基準比）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBase = r.offset === 0;
              const diffSign = r.diff > 0 ? '+' : r.diff < 0 ? '-' : '';
              const diffColor = r.diff > 0 ? 'text-emerald-600' : r.diff < 0 ? 'text-rose-500' : 'text-gray-400';
              const offsetLabel =
                r.offset === 0
                  ? '（基準）'
                  : r.offset > 0
                    ? ` (+${r.offset})`
                    : ` (${r.offset})`;
              return (
                <tr
                  key={r.offset}
                  className={`border-b border-gray-50 ${isBase ? 'bg-gradient-to-r from-blue-50/40 to-purple-50/40 font-bold' : ''}`}
                >
                  <td className="py-2 px-2 text-gray-700">
                    月{Number(r.monthlyMan).toFixed(1)}万円
                    <span className="text-[11px] text-gray-400">{offsetLabel}</span>
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums text-gray-700">{fmtMan(r.takeHome)}</td>
                  <td className="text-right py-2 px-2 tabular-nums text-gray-700">{fmtMan(r.retained)}</td>
                  <td className="text-right py-2 px-2 tabular-nums text-gray-900 font-medium">{fmtMan(r.totalTakeHome)}</td>
                  <td className={`text-right py-2 px-2 tabular-nums ${diffColor}`}>
                    {isBase ? '-' : `${diffSign}${fmtMan(Math.abs(r.diff))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        基準は現在のパターンの役員報酬月額（月{Number(baseMonthlyMan).toFixed(1)}万円）。緑が増額・赤が減額方向のメリット。
      </p>
    </motion.div>
  );
}
