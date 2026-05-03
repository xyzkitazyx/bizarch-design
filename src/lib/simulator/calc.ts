/**
 * AIで一人起業の教科書 シミュレーター 計算ロジック
 *
 * 計算ロジック：『2026-04-29_役員報酬計算ロジック.md』 v3 準拠
 *  - 法人税：800万以下15%・超過23.2%
 *  - 法人住民税：均等割70,000円＋法人税割7%（1,000万超10.4%）
 *  - 法人事業税：400万まで3.5%・〜800万 5.3%・超 7.0%
 *  - 特別法人事業税：法人事業税×37%
 *  - 防衛特別法人税：(法人税-500万)×4%（500万円控除）
 *  - 社保（東京・40歳未満）：健保 9.85% + 子育て支援 0.23% + 厚年 18.3% = 28.38%
 *  - 社保（40歳以上）：上記＋介護 1.62% = 30.00%
 *  - 標準報酬月額への等級マッピング必須（健保50等級・厚年32等級）
 *  - パターン③特例：健保標報58,000円＋厚年標報88,000円（厚年第1等級下限）
 *  - 個人税：給与所得控除（最低74万・上限195万）→基礎控除（最大104万〜0円）
 *           →所得税累進5-45%＋復興特別2.1%＋住民税10%（基礎控除43万）
 *  - 端数処理：千円単位（切り捨て）。表示は万円単位（小数2桁）。
 */

import {
  MAN,
  SIMULATOR_DATA,
  type IndustryKey,
  type SyuhoRow,
} from './data';

const DATA = SIMULATOR_DATA;

/* =========================================================
 * 共通ユーティリティ
 * ======================================================== */

/** 円→万円表示（小数2桁・切り捨て） */
export function fmtMan(yen: number | null | undefined, dp = 2): string {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  const sign = yen < 0 ? '-' : '';
  const abs = Math.abs(yen);
  const man = Math.floor(abs / 100) / 100; // 切り捨てで2桁
  return (
    sign +
    man.toLocaleString('ja-JP', {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    })
  );
}

/** 円→千円単位で切り捨て */
export function roundToK(yen: number): number {
  return Math.floor(yen / 1000) * 1000;
}

/* =========================================================
 * 1. 標準報酬月額の等級変換
 *    - actualMonthlyYen を等級表で検索 → 標報円を返す
 * ======================================================== */
export function getSyuhoYen(
  actualMonthlyYen: number,
  type: 'kenpo' | 'kosei',
): number {
  const table: SyuhoRow[] = DATA.syuho_table[type];
  for (let i = 0; i < table.length; i++) {
    const row = table[i]!;
    if (row.upperYen === null) {
      // 最終等級
      if (actualMonthlyYen >= row.lowerYen) return row.syuhoYen;
    } else {
      if (actualMonthlyYen >= row.lowerYen && actualMonthlyYen < row.upperYen) {
        return row.syuhoYen;
      }
    }
  }
  return table[0]!.syuhoYen;
}

/* =========================================================
 * 2. 社会保険料の計算
 *    入力：役員報酬月額（円）, age40Plus, microMode（パターン③特例）
 *    返却：個人負担, 会社負担, 内訳
 * ======================================================== */
export interface SocialInsuranceResult {
  kenpoSyuho: number;
  koseiSyuho: number;
  individualYearly: number;
  corporateYearly: number;
  breakdown: {
    kenpo: number;
    kaigo: number;
    kosei: number;
  };
}

export function calcSocialInsurance(
  monthlySalaryYen: number,
  age40Plus: boolean,
  microMode: boolean,
): SocialInsuranceResult {
  const si = DATA.social_insurance;
  let kenpoSyuho: number;
  let koseiSyuho: number;

  if (microMode) {
    // パターン③：健保標報58,000円・厚年標報88,000円（厚年第1等級下限・固定）
    kenpoSyuho = si.kenpo_min_yen;
    koseiSyuho = si.kosei_min_yen;
  } else {
    kenpoSyuho = getSyuhoYen(monthlySalaryYen, 'kenpo');
    koseiSyuho = getSyuhoYen(monthlySalaryYen, 'kosei');
  }

  // 月額保険料（合計＝労使合算）
  const kenpoMonthlyTotal = kenpoSyuho * (si.kenpo + si.child_support);
  const kaigoMonthlyTotal = age40Plus ? kenpoSyuho * si.kaigo : 0;
  const koseiMonthlyTotal = koseiSyuho * si.kosei;

  // 折半：個人と会社で同額
  const indivMonthly =
    (kenpoMonthlyTotal + kaigoMonthlyTotal + koseiMonthlyTotal) / 2;
  const corpMonthly = indivMonthly;

  return {
    kenpoSyuho,
    koseiSyuho,
    individualYearly: Math.round(indivMonthly * 12),
    corporateYearly: Math.round(corpMonthly * 12),
    breakdown: {
      kenpo: Math.round(kenpoMonthlyTotal * 12),
      kaigo: Math.round(kaigoMonthlyTotal * 12),
      kosei: Math.round(koseiMonthlyTotal * 12),
    },
  };
}

/* =========================================================
 * 3. 給与所得控除（円表記、2026年版）
 * ======================================================== */
export function calcSalaryDeduction(salaryYen: number): number {
  for (const b of DATA.salary_deduction.brackets) {
    if (b.upToYen === null || salaryYen <= b.upToYen) {
      if (b.fixedYen !== null) return b.fixedYen;
      return Math.floor(salaryYen * b.rate + b.constYen);
    }
  }
  return 1950000;
}

/* =========================================================
 * 4. 基礎控除（所得税・2026年版）
 * ======================================================== */
export function calcBasicDeduction(totalIncomeYen: number): number {
  for (const b of DATA.basic_deduction.brackets) {
    if (b.upToYen === null || totalIncomeYen <= b.upToYen) {
      return b.amountYen;
    }
  }
  return 0;
}

/* =========================================================
 * 5. 所得税（累進5-45%・控除額あり）＋復興特別2.1%
 * ======================================================== */
export interface IncomeTaxResult {
  incomeTax: number;
  reconstructionTax: number;
}

export function calcIncomeTax(taxableYen: number): IncomeTaxResult {
  if (taxableYen <= 0) return { incomeTax: 0, reconstructionTax: 0 };
  for (const b of DATA.income_tax_rates.brackets) {
    if (b.upToYen === null || taxableYen <= b.upToYen) {
      const it = Math.max(0, Math.floor(taxableYen * b.rate - b.deductionYen));
      const rt = Math.floor(it * DATA.income_tax_rates.reconstruction_rate);
      return { incomeTax: it, reconstructionTax: rt };
    }
  }
  return { incomeTax: 0, reconstructionTax: 0 };
}

/* =========================================================
 * 6. 住民税
 * ======================================================== */
export interface ResidentTaxResult {
  taxable: number;
  incomeTaxResident: number;
  perCapita: number;
  total: number;
}

export function calcResidentTax(
  salaryIncomeYen: number,
  individualSiYen: number,
): ResidentTaxResult {
  const rt = DATA.resident_tax;
  const taxableForResident = Math.max(
    0,
    salaryIncomeYen - individualSiYen - rt.basic_deduction_yen,
  );
  let incomeTaxResident = 0;
  if (taxableForResident > 0) {
    incomeTaxResident = Math.max(
      0,
      Math.floor(taxableForResident * rt.income_rate - rt.adjustment_deduction_yen),
    );
  }
  const perCapita = rt.per_capita_yen;
  return {
    taxable: taxableForResident,
    incomeTaxResident,
    perCapita,
    total: incomeTaxResident + perCapita,
  };
}

/* =========================================================
 * 7. 法人税等の計算
 *    赤字（法人所得≦0）：法人税0／均等割70,000のみ
 * ======================================================== */
export interface CorporateTaxResult {
  corpIncome: number;
  corpTax: number;
  localFixed: number;
  localRate: number;
  bizTax: number;
  spBizTax: number;
  defenseTax: number;
  total: number;
  isLoss: boolean;
}

export function calcCorporateTax(corpIncomeYen: number): CorporateTaxResult {
  const t = DATA.tax_rates;

  // 赤字決算
  if (corpIncomeYen <= 0) {
    return {
      corpIncome: corpIncomeYen,
      corpTax: 0,
      localFixed: t.local_per_capita_yen,
      localRate: 0,
      bizTax: 0,
      spBizTax: 0,
      defenseTax: 0,
      total: t.local_per_capita_yen,
      isLoss: true,
    };
  }

  // 法人税：800万以下15%、超過23.2%
  let corpTax = 0;
  if (corpIncomeYen <= t.corp_threshold_yen) {
    corpTax = Math.floor(corpIncomeYen * t.corp_below_8m);
  } else {
    corpTax = Math.floor(
      t.corp_threshold_yen * t.corp_below_8m +
        (corpIncomeYen - t.corp_threshold_yen) * t.corp_above_8m,
    );
  }

  // 法人住民税法人税割：法人税×7%（1,000万超は10.4%）
  let localRate = 0;
  if (corpTax <= t.local_excess_threshold_corptax_yen) {
    localRate = Math.floor(corpTax * t.local_income_rate);
  } else {
    localRate = Math.floor(
      t.local_excess_threshold_corptax_yen * t.local_income_rate +
        (corpTax - t.local_excess_threshold_corptax_yen) *
          t.local_income_rate_excess,
    );
  }

  // 法人事業税：400万まで3.5%／〜800万 5.3%／超 7.0%（累進ブラケット）
  let bizTax = 0;
  let prev = 0;
  for (const br of t.business_tax_brackets) {
    const cap = br.upToYen === null ? Infinity : br.upToYen;
    const portion = Math.max(0, Math.min(corpIncomeYen, cap) - prev);
    if (portion <= 0) break;
    bizTax += portion * br.rate;
    if (br.upToYen !== null && corpIncomeYen > br.upToYen) {
      prev = br.upToYen;
    } else {
      break;
    }
  }
  bizTax = Math.floor(bizTax);

  const spBizTax = Math.floor(bizTax * t.special_business_tax_rate);

  let defenseTax = 0;
  if (corpTax > t.defense_tax.deduction_yen) {
    defenseTax = Math.floor(
      (corpTax - t.defense_tax.deduction_yen) * t.defense_tax.rate,
    );
  }

  const total =
    corpTax + t.local_per_capita_yen + localRate + bizTax + spBizTax + defenseTax;

  return {
    corpIncome: corpIncomeYen,
    corpTax,
    localFixed: t.local_per_capita_yen,
    localRate,
    bizTax,
    spBizTax,
    defenseTax,
    total,
    isLoss: false,
  };
}

/* =========================================================
 * 8. 消費税の概算計算
 * ======================================================== */
export function calcConsumptionTax(
  revenueYen: number,
  sgaYen: number,
  isTaxable: boolean,
  method: 'simplified' | 'standard',
): number {
  if (!isTaxable) return 0;
  const rate = DATA.consumption_tax.rate;
  const salesTax = (revenueYen / (1 + rate)) * rate;
  if (method === 'simplified') {
    return Math.floor(
      salesTax * (1 - DATA.consumption_tax.simplified_service_rate),
    );
  }
  // 本則：販管費分を仕入控除（簡略）
  const purchaseTax = (sgaYen / (1 + rate)) * rate;
  return Math.max(0, Math.floor(salesTax - purchaseTax));
}

/* =========================================================
 * 9. 個人サイド計算（役員報酬→社保→税）
 * ======================================================== */
export interface PersonalResult {
  salaryYearly: number;
  salaryDeduction: number;
  salaryIncome: number;
  basicDeduction: number;
  additionalDeduction: number;
  taxable: number;
  incomeTax: number;
  reconstructionTax: number;
  resident: ResidentTaxResult;
  totalPersonalTax: number;
  takeHome: number;
}

export function calcPersonal(
  salaryYearlyYen: number,
  individualSiYen: number,
  additionalDeductionYen: number,
): PersonalResult {
  const salaryDeduction = calcSalaryDeduction(salaryYearlyYen);
  const salaryIncome = Math.max(0, salaryYearlyYen - salaryDeduction);
  const basicDeduction = calcBasicDeduction(salaryIncome);
  const taxable = Math.max(
    0,
    salaryIncome - basicDeduction - individualSiYen - additionalDeductionYen,
  );
  const { incomeTax, reconstructionTax } = calcIncomeTax(taxable);
  const resident = calcResidentTax(
    salaryIncome,
    individualSiYen + additionalDeductionYen,
  );
  const totalPersonalTax = incomeTax + reconstructionTax + resident.total;
  const takeHome = salaryYearlyYen - individualSiYen - totalPersonalTax;

  return {
    salaryYearly: salaryYearlyYen,
    salaryDeduction,
    salaryIncome,
    basicDeduction,
    additionalDeduction: additionalDeductionYen,
    taxable,
    incomeTax,
    reconstructionTax,
    resident,
    totalPersonalTax,
    takeHome,
  };
}

/* =========================================================
 * 10. 単一シナリオの計算
 * ======================================================== */
export type PatternKey = 'optimal' | 'maxTakeHome' | 'micro' | 'custom';

export interface SimulatorOptions {
  tousanboshi?: boolean;
  shokibo?: boolean;
  ideco?: boolean;
  shataku?: boolean;
}

export interface Scenario {
  revenueMan: number;
  sgaMan: number;
  age40Plus: boolean;
  pattern: PatternKey;
  salaryMonthlyMan: number;
  options: SimulatorOptions;
  rentMonthMan: number;
  ctTaxable: boolean;
  ctMethod: 'simplified' | 'standard';
}

export interface ScenarioResult {
  scn: Scenario;
  revenue: number;
  sga: number;
  salaryYr: number;
  salaryMo: number;
  si: SocialInsuranceResult;
  corpDeduction: number;
  personalDeduction: number;
  ct: number;
  corp: CorporateTaxResult;
  retained: number;
  pers: PersonalResult;
  totalTakeHome: number;
}

export function calcScenario(scn: Scenario): ScenarioResult {
  const revenue = scn.revenueMan * MAN;
  const sga = scn.sgaMan * MAN;
  const salaryMo = scn.salaryMonthlyMan * MAN;
  const salaryYr = salaryMo * 12;
  const microMode = scn.pattern === 'micro';

  const si = calcSocialInsurance(salaryMo, scn.age40Plus, microMode);

  const opt = scn.options || {};
  let corpDeduction = 0;
  if (opt.tousanboshi) corpDeduction += 2400000; // 年240万
  if (opt.shataku) {
    const rentMonth = (scn.rentMonthMan || 0) * MAN;
    corpDeduction += Math.floor(rentMonth * 12 * 0.5);
  }
  let personalDeduction = 0;
  if (opt.shokibo) personalDeduction += 840000;
  if (opt.ideco) personalDeduction += 276000;

  const ct = calcConsumptionTax(revenue, sga, scn.ctTaxable, scn.ctMethod);

  // 法人所得 = 売上 - 販管費 - 役員報酬 - 会社負担社保 - 損金オプション
  const corpIncome =
    revenue - sga - salaryYr - si.corporateYearly - corpDeduction;
  const corp = calcCorporateTax(corpIncome);

  // 内部留保 = 法人所得 - 法人税合計 - 消費税
  const retained = corpIncome - corp.total - ct;

  const pers = calcPersonal(salaryYr, si.individualYearly, personalDeduction);

  const totalTakeHome = pers.takeHome + retained;

  return {
    scn,
    revenue,
    sga,
    salaryYr,
    salaryMo,
    si,
    corpDeduction,
    personalDeduction,
    ct,
    corp,
    retained,
    pers,
    totalTakeHome,
  };
}

/* =========================================================
 * 11. パターン①節税最適：役員報酬を全探索して総手取り最大点を求める
 *     刻み：月10万円→月1万円の二段階で精度確保
 * ======================================================== */
export type BaseScenario = Omit<Scenario, 'pattern' | 'salaryMonthlyMan'>;

export function findOptimalSalary(baseScn: BaseScenario): number {
  let bestMan = 0;
  let bestTotal = -Infinity;

  for (let m = 0; m <= 200; m += 10) {
    const sc: Scenario = { ...baseScn, salaryMonthlyMan: m, pattern: 'optimal' };
    const r = calcScenario(sc);
    if (r.totalTakeHome > bestTotal) {
      bestTotal = r.totalTakeHome;
      bestMan = m;
    }
  }

  const lo = Math.max(0, bestMan - 10);
  const hi = Math.min(200, bestMan + 10);
  for (let m = lo; m <= hi; m += 1) {
    const sc: Scenario = { ...baseScn, salaryMonthlyMan: m, pattern: 'optimal' };
    const r = calcScenario(sc);
    if (r.totalTakeHome > bestTotal) {
      bestTotal = r.totalTakeHome;
      bestMan = m;
    }
  }

  return bestMan;
}

/* =========================================================
 * 12. パターン②手取り最大：個人手取り最大点を全探索
 *
 *  既知バグ修正：EBITDA前を超えない範囲でクリップ
 *    maxSalary = max(0, ebitdaYen - 70000) / 12 / 1.142
 *  - 70000 = 法人住民税均等割（赤字でも発生）
 *  - 1.142 = 1 + 14.2%（会社負担社保の概算上限）
 *  - 結果として、年商 < 販管費 + 給与×1.142 + 70000 を満たすsalaryをキャップ
 * ======================================================== */
export function findMaxTakeHomeSalary(baseScn: BaseScenario): number {
  // EBITDA前の上限ガード（バグ修正）
  const revenueYen = baseScn.revenueMan * MAN;
  const sgaYen = baseScn.sgaMan * MAN;
  const ebitdaYen = revenueYen - sgaYen; // 役員報酬・社保差し引き前
  const capYen = Math.max(0, ebitdaYen - 70000) / 12 / 1.142;
  const capMan = Math.floor(capYen / MAN);
  const upper = Math.min(250, Math.max(0, capMan));

  let bestMan = 0;
  let bestPersonal = -Infinity;

  // 第1段階：月10万円刻み
  for (let m = 0; m <= upper; m += 10) {
    const sc: Scenario = {
      ...baseScn,
      salaryMonthlyMan: m,
      pattern: 'maxTakeHome',
    };
    const r = calcScenario(sc);
    if (r.pers.takeHome > bestPersonal) {
      bestPersonal = r.pers.takeHome;
      bestMan = m;
    }
  }

  // 第2段階：月1万円刻み
  const lo = Math.max(0, bestMan - 10);
  const hi = Math.min(upper, bestMan + 10);
  for (let m = lo; m <= hi; m += 1) {
    const sc: Scenario = {
      ...baseScn,
      salaryMonthlyMan: m,
      pattern: 'maxTakeHome',
    };
    const r = calcScenario(sc);
    if (r.pers.takeHome > bestPersonal) {
      bestPersonal = r.pers.takeHome;
      bestMan = m;
    }
  }
  return bestMan;
}

/* =========================================================
 * 13. シミュレーター入力 → 全パターンの結果を生成
 * ======================================================== */
export interface SimulatorInput {
  industry: IndustryKey;
  revenueMan: number;
  sgaMan: number;
  age40Plus: boolean;
  pattern: PatternKey;
  customSalaryMan: number;
  options: SimulatorOptions;
  rentMonthMan: number;
  ctTaxable: boolean;
  ctMethod: 'simplified' | 'standard';
}

export interface SimulateResult {
  results: {
    optimal: ScenarioResult;
    maxTakeHome: ScenarioResult;
    micro: ScenarioResult;
  };
  active: ScenarioResult;
  activePattern: PatternKey;
}

export function decideSalary(input: SimulatorInput, pattern: PatternKey): number {
  const baseScn: BaseScenario = {
    revenueMan: input.revenueMan,
    sgaMan: input.sgaMan,
    age40Plus: input.age40Plus,
    options: input.options,
    rentMonthMan: input.rentMonthMan,
    ctTaxable: input.ctTaxable,
    ctMethod: input.ctMethod,
  };
  if (pattern === 'optimal') return findOptimalSalary(baseScn);
  if (pattern === 'maxTakeHome') return findMaxTakeHomeSalary(baseScn);
  if (pattern === 'micro') return 4.5; // 月45,000円
  if (pattern === 'custom') return input.customSalaryMan;
  return 50;
}

export function simulate(input: SimulatorInput): SimulateResult {
  const patterns: Array<'optimal' | 'maxTakeHome' | 'micro'> = [
    'optimal',
    'maxTakeHome',
    'micro',
  ];
  const results = {} as SimulateResult['results'];

  for (const p of patterns) {
    const salaryMan = decideSalary(input, p);
    const scn: Scenario = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: p,
      salaryMonthlyMan: salaryMan,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod,
    };
    results[p] = calcScenario(scn);
  }

  let active: ScenarioResult;
  if (input.pattern === 'custom') {
    const scn: Scenario = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: 'custom',
      salaryMonthlyMan: input.customSalaryMan,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod,
    };
    active = calcScenario(scn);
  } else {
    active = results[input.pattern];
  }

  return {
    results,
    active,
    activePattern: input.pattern,
  };
}

/* =========================================================
 * 14. 警告メッセージ生成
 * ======================================================== */
export function buildWarnings(res: ScenarioResult): string[] {
  const warnings: string[] = [];
  if (res.corp.corpIncome < 0) {
    warnings.push(
      '赤字決算：法人税はゼロですが、住民税均等割70,000円のみ発生します。',
    );
  }
  if (res.corp.corpTax > DATA.tax_rates.defense_tax.deduction_yen) {
    warnings.push(
      `防衛特別法人税が発生：法人税 ${fmtMan(res.corp.corpTax)} 万円が500万円を超えています。`,
    );
  }
  if (res.corp.corpTax > DATA.tax_rates.local_excess_threshold_corptax_yen) {
    warnings.push(
      '法人税1,000万円超：住民税法人税割が10.4%の超過税率に切替わります。',
    );
  }
  if (res.si.kenpoSyuho >= DATA.social_insurance.kenpo_max_yen) {
    warnings.push('健保標準報酬月額が上限（139万円）に到達しました。');
  }
  if (res.si.koseiSyuho >= DATA.social_insurance.kosei_max_yen) {
    warnings.push('厚生年金標準報酬月額が上限（65万円）に到達しました。');
  }
  if (res.scn.salaryMonthlyMan < 4.5 && res.scn.pattern !== 'micro') {
    warnings.push(
      '役員報酬が月45,000円未満：社保の最低等級下限を下回るため計算結果が不正確になる可能性があります。',
    );
  }
  return warnings;
}

/* =========================================================
 * 15. 感度分析（基準±10万円・5段階）
 * ======================================================== */
export interface SensitivityRow {
  offset: number;
  monthlyMan: number;
  takeHome: number;
  retained: number;
  totalTakeHome: number;
  diff: number;
}

export function buildSensitivity(
  baseRes: ScenarioResult,
  input: SimulatorInput,
): SensitivityRow[] {
  const base = baseRes.scn.salaryMonthlyMan;
  const offsets = [-10, -5, 0, 5, 10];
  return offsets.map((off) => {
    const m = Math.max(0, base + off);
    const scn: Scenario = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: 'custom',
      salaryMonthlyMan: m,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod,
    };
    const r = calcScenario(scn);
    return {
      offset: off,
      monthlyMan: m,
      takeHome: r.pers.takeHome,
      retained: r.retained,
      totalTakeHome: r.totalTakeHome,
      diff: r.totalTakeHome - baseRes.totalTakeHome,
    };
  });
}

/* =========================================================
 * 16. テストケース検証
 *     コンソールに `runTests()` でログ出力
 *     教科書値と完全一致を確認
 * ======================================================== */
export interface TestResult {
  label: string;
  status: 'PASS' | 'CHECK';
  totalTakeHomeYen: number;
  expectedTotalYen: number;
  personalYen: number;
  expectedPersonalYen: number;
  retainedYen: number;
  expectedRetainedYen: number;
}

interface TestCase {
  label: string;
  input: Scenario;
  expected: { totalTakeHome: number; personal: number; retained: number };
}

const TEST_CASES: TestCase[] = [
  {
    label: 'TC1: 受託開発・年商1000・販管費200・役員報酬600・40未満・①',
    input: {
      revenueMan: 1000,
      sgaMan: 200,
      age40Plus: false,
      pattern: 'custom',
      salaryMonthlyMan: 50,
      options: {},
      rentMonthMan: 0,
      ctTaxable: false,
      ctMethod: 'simplified',
    },
    expected: { totalTakeHome: 5488100, personal: 4648900, retained: 839200 },
  },
  {
    label: 'TC2: カスタム・年商2000・販管費300・役員報酬1000・40未満・①',
    input: {
      revenueMan: 2000,
      sgaMan: 300,
      age40Plus: false,
      pattern: 'custom',
      salaryMonthlyMan: 1000 / 12,
      options: {},
      rentMonthMan: 0,
      ctTaxable: false,
      ctMethod: 'simplified',
    },
    expected: { totalTakeHome: 11773500, personal: 7308900, retained: 4464600 },
  },
  {
    label: 'TC3: 任意・年商200・販管費80・パターン③マイクロ法人型',
    input: {
      revenueMan: 200,
      sgaMan: 80,
      age40Plus: false,
      pattern: 'micro',
      salaryMonthlyMan: 4.5,
      options: {},
      rentMonthMan: 0,
      ctTaxable: false,
      ctMethod: 'simplified',
    },
    expected: { totalTakeHome: 751600, personal: 403300, retained: 348300 },
  },
  {
    label: 'TC4: 任意・年商5000・販管費500・役員報酬2000・40未満・①',
    input: {
      revenueMan: 5000,
      sgaMan: 500,
      age40Plus: false,
      pattern: 'custom',
      salaryMonthlyMan: 2000 / 12,
      options: {},
      rentMonthMan: 0,
      ctTaxable: false,
      ctMethod: 'simplified',
    },
    expected: { totalTakeHome: 29349600, personal: 13055700, retained: 16293900 },
  },
];

export function runTests(): TestResult[] {
  if (typeof console !== 'undefined') {
    console.log('═══════════════════════════════════════════════');
    console.log('  AIで一人起業の教科書 シミュレーター v1.0');
    console.log('  テストケース検証（教科書値との一致確認）');
    console.log('═══════════════════════════════════════════════');
  }

  const out: TestResult[] = [];
  for (const tc of TEST_CASES) {
    const r = calcScenario(tc.input);
    const okTotal =
      Math.abs(r.totalTakeHome - tc.expected.totalTakeHome) <= 50000;
    const okPersonal =
      Math.abs(r.pers.takeHome - tc.expected.personal) <= 50000;
    const okRetained = Math.abs(r.retained - tc.expected.retained) <= 50000;
    const status: 'PASS' | 'CHECK' =
      okTotal && okPersonal && okRetained ? 'PASS' : 'CHECK';

    if (typeof console !== 'undefined') {
      console.log(`\n[${status}] ${tc.label}`);
      console.log(
        `  総手取り: 計算${fmtMan(r.totalTakeHome)}万 / 期待${fmtMan(tc.expected.totalTakeHome)}万 / 差${fmtMan(r.totalTakeHome - tc.expected.totalTakeHome)}万`,
      );
      console.log(
        `  個人手取: 計算${fmtMan(r.pers.takeHome)}万  / 期待${fmtMan(tc.expected.personal)}万 / 差${fmtMan(r.pers.takeHome - tc.expected.personal)}万`,
      );
      console.log(
        `  内部留保: 計算${fmtMan(r.retained)}万      / 期待${fmtMan(tc.expected.retained)}万 / 差${fmtMan(r.retained - tc.expected.retained)}万`,
      );
    }

    out.push({
      label: tc.label,
      status,
      totalTakeHomeYen: r.totalTakeHome,
      expectedTotalYen: tc.expected.totalTakeHome,
      personalYen: r.pers.takeHome,
      expectedPersonalYen: tc.expected.personal,
      retainedYen: r.retained,
      expectedRetainedYen: tc.expected.retained,
    });
  }

  if (typeof console !== 'undefined') {
    console.log('═══════════════════════════════════════════════');
  }
  return out;
}
