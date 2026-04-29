/* =========================================================
 * AIで一人起業の教科書 シミュレーター v1.0
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
 * ======================================================== */

(() => {
'use strict';

/* =========================================================
 * 1. グローバル変数（data.json 読込結果）
 * ======================================================== */
let DATA = null;          // data.json のロード結果
let DEBOUNCE_TIMER = null; // 入力デバウンス
const MAN = 10000;        // 万→円の係数

/* =========================================================
 * 2. ユーティリティ
 * ======================================================== */

/** 円→千円単位で切り捨て */
function roundToK(yen) {
  return Math.floor(yen / 1000) * 1000;
}

/** 円→万円表示（小数2桁・切り捨て） */
function fmtMan(yen, opts = {}) {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  const sign = yen < 0 ? '-' : '';
  const abs = Math.abs(yen);
  const man = Math.floor(abs / 100) / 100; // 切り捨てで2桁
  return sign + man.toLocaleString('ja-JP', {
    minimumFractionDigits: opts.dp ?? 2,
    maximumFractionDigits: opts.dp ?? 2
  });
}

/** 円→万円・整数表示 */
function fmtManInt(yen) {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  return Math.round(yen / MAN).toLocaleString('ja-JP');
}

/* =========================================================
 * 3. 標準報酬月額の等級変換
 *    - actualMonthlyYen を等級表で検索 → 標報円を返す
 *    - type: 'kenpo' or 'kosei'
 * ======================================================== */
function getSyuhoYen(actualMonthlyYen, type) {
  const table = DATA.syuho_table[type];
  // 上限超過 → 最終等級（健保50等級1,390,000・厚年32等級650,000）
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (row.upperYen === null) {
      // 最終等級
      if (actualMonthlyYen >= row.lowerYen) return row.syuhoYen;
    } else {
      if (actualMonthlyYen >= row.lowerYen && actualMonthlyYen < row.upperYen) {
        return row.syuhoYen;
      }
    }
  }
  // 想定外：最低等級を返す
  return table[0].syuhoYen;
}

/* =========================================================
 * 4. 社会保険料の計算
 *    入力：役員報酬月額（円）, age40Plus, microMode（パターン③特例）
 *    返却：個人負担, 会社負担, 内訳
 *    料率（合計）:
 *      健保 9.85% + 子育て 0.23% = 10.08%
 *      介護 1.62%（40歳以上）
 *      厚生年金 18.30%
 *    折半：個人＝合計÷2、会社＝合計÷2
 * ======================================================== */
function calcSocialInsurance(monthlySalaryYen, age40Plus, microMode) {
  const si = DATA.social_insurance;
  let kenpoSyuho, koseiSyuho;

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
  const indivMonthly = (kenpoMonthlyTotal + kaigoMonthlyTotal + koseiMonthlyTotal) / 2;
  const corpMonthly  = indivMonthly;

  return {
    kenpoSyuho,
    koseiSyuho,
    individualYearly: Math.round(indivMonthly * 12),
    corporateYearly:  Math.round(corpMonthly * 12),
    breakdown: {
      kenpo:  Math.round(kenpoMonthlyTotal * 12),
      kaigo:  Math.round(kaigoMonthlyTotal * 12),
      kosei:  Math.round(koseiMonthlyTotal * 12)
    }
  };
}

/* =========================================================
 * 5. 給与所得控除（円表記、2026年版）
 *    境界：162.5万→74万固定／〜180万 ×40-10／〜360万 ×30+8／
 *           〜660万 ×20+44／〜850万 ×10+110／850万超 195万固定
 * ======================================================== */
function calcSalaryDeduction(salaryYen) {
  for (const b of DATA.salary_deduction.brackets) {
    if (b.upToYen === null || salaryYen <= b.upToYen) {
      if (b.fixedYen !== null) return b.fixedYen;
      return Math.floor(salaryYen * b.rate + b.constYen);
    }
  }
  return 1950000; // フォールバック
}

/* =========================================================
 * 6. 基礎控除（所得税・2026年版）
 *    合計所得帯別：132万以下=104万／〜336万=88万／〜489万=68万／
 *                  〜655万=63万／〜2,350万=62万／2,500万超は段階0
 * ======================================================== */
function calcBasicDeduction(totalIncomeYen) {
  for (const b of DATA.basic_deduction.brackets) {
    if (b.upToYen === null || totalIncomeYen <= b.upToYen) {
      return b.amountYen;
    }
  }
  return 0;
}

/* =========================================================
 * 7. 所得税（累進5-45%・控除額あり）＋復興特別2.1%
 * ======================================================== */
function calcIncomeTax(taxableYen) {
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
 * 8. 住民税
 *    住民税課税所得 = 給与所得 - 個人社保 - 住民税基礎控除43万
 *    所得割 = 課税所得 × 10%
 *    調整控除 2,500円、均等割 5,000円
 *    課税所得≦0 なら所得割0、均等割のみ発生
 * ======================================================== */
function calcResidentTax(salaryIncomeYen, individualSiYen) {
  const rt = DATA.resident_tax;
  const taxableForResident = Math.max(0, salaryIncomeYen - individualSiYen - rt.basic_deduction_yen);
  let incomeTaxResident = 0;
  if (taxableForResident > 0) {
    incomeTaxResident = Math.max(0, Math.floor(taxableForResident * rt.income_rate - rt.adjustment_deduction_yen));
  }
  const perCapita = rt.per_capita_yen;
  return {
    taxable: taxableForResident,
    incomeTaxResident,
    perCapita,
    total: incomeTaxResident + perCapita
  };
}

/* =========================================================
 * 9. 法人税等の計算
 *    入力：法人所得（円）
 *    出力：法人税・住民税均等割・住民税法人税割・事業税・特別法人事業税・防衛・合計
 *    赤字（法人所得≦0）：法人税0／均等割70,000のみ
 * ======================================================== */
function calcCorporateTax(corpIncomeYen) {
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
      isLoss: true
    };
  }

  // 法人税：800万以下15%、超過23.2%
  let corpTax = 0;
  if (corpIncomeYen <= t.corp_threshold_yen) {
    corpTax = Math.floor(corpIncomeYen * t.corp_below_8m);
  } else {
    corpTax = Math.floor(t.corp_threshold_yen * t.corp_below_8m
                       + (corpIncomeYen - t.corp_threshold_yen) * t.corp_above_8m);
  }

  // 法人住民税法人税割：法人税×7%（1,000万超は10.4%）
  let localRate = 0;
  if (corpTax <= t.local_excess_threshold_corptax_yen) {
    localRate = Math.floor(corpTax * t.local_income_rate);
  } else {
    localRate = Math.floor(
      t.local_excess_threshold_corptax_yen * t.local_income_rate
      + (corpTax - t.local_excess_threshold_corptax_yen) * t.local_income_rate_excess
    );
  }

  // 法人事業税：400万まで3.5%／〜800万 5.3%／超 7.0%（累進ブラケット）
  let bizTax = 0;
  let prev = 0;
  for (const br of t.business_tax_brackets) {
    const cap = br.upToYen === null ? Infinity : br.upToYen;
    // 当ブラケットに割り当てる金額 = min(所得, cap) - prev
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

  // 特別法人事業税：事業税×37%
  const spBizTax = Math.floor(bizTax * t.special_business_tax_rate);

  // 防衛特別法人税：(法人税-500万)×4%（500万控除）
  let defenseTax = 0;
  if (corpTax > t.defense_tax.deduction_yen) {
    defenseTax = Math.floor((corpTax - t.defense_tax.deduction_yen) * t.defense_tax.rate);
  }

  const total = corpTax + t.local_per_capita_yen + localRate + bizTax + spBizTax + defenseTax;

  return {
    corpIncome: corpIncomeYen,
    corpTax,
    localFixed: t.local_per_capita_yen,
    localRate,
    bizTax,
    spBizTax,
    defenseTax,
    total,
    isLoss: false
  };
}

/* =========================================================
 * 10. 消費税の概算計算
 *    課税事業者でない or 年商1,000万以下なら0
 *    簡易課税（サービス業）：売上消費税 ×（1-0.5）= 売上 ÷ 1.1 × 0.1 × 0.5
 *    本則課税：(売上-販管費) ÷ 1.1 × 0.1 (簡略)
 * ======================================================== */
function calcConsumptionTax(revenueYen, sgaYen, isTaxable, method) {
  if (!isTaxable) return 0;
  const rate = DATA.consumption_tax.rate;
  const salesTax = revenueYen / (1 + rate) * rate;
  if (method === 'simplified') {
    return Math.floor(salesTax * (1 - DATA.consumption_tax.simplified_service_rate));
  }
  // 本則：販管費分を仕入控除（簡略）
  const purchaseTax = sgaYen / (1 + rate) * rate;
  return Math.max(0, Math.floor(salesTax - purchaseTax));
}

/* =========================================================
 * 11. 個人サイド計算（役員報酬→社保→税）
 *    入力：役員報酬年額・個人社保年額・追加所得控除（小規模・iDeCo等）
 *    返却：給与所得・課税所得・所得税・住民税・手取り
 * ======================================================== */
function calcPersonal(salaryYearlyYen, individualSiYen, additionalDeductionYen) {
  // 給与所得控除
  const salaryDeduction = calcSalaryDeduction(salaryYearlyYen);
  // 給与所得
  const salaryIncome = Math.max(0, salaryYearlyYen - salaryDeduction);
  // 基礎控除（合計所得＝給与所得）
  const basicDeduction = calcBasicDeduction(salaryIncome);
  // 所得税課税所得
  const taxable = Math.max(0, salaryIncome - basicDeduction - individualSiYen - additionalDeductionYen);
  // 所得税＋復興
  const { incomeTax, reconstructionTax } = calcIncomeTax(taxable);
  // 住民税
  const resident = calcResidentTax(salaryIncome, individualSiYen + additionalDeductionYen);

  const totalPersonalTax = incomeTax + reconstructionTax + resident.total;
  const takeHome = salaryYearlyYen - individualSiYen - totalPersonalTax;

  return {
    salaryYearly:   salaryYearlyYen,
    salaryDeduction,
    salaryIncome,
    basicDeduction,
    additionalDeduction: additionalDeductionYen,
    taxable,
    incomeTax,
    reconstructionTax,
    resident,
    totalPersonalTax,
    takeHome
  };
}

/* =========================================================
 * 12. 単一シナリオの計算
 *    入力：シナリオオブジェクト（年商・販管費・役員報酬月額・年齢・各オプション）
 *    出力：会社P&L＋個人P&L＋総手取り
 * ======================================================== */
function calcScenario(scn) {
  const revenue   = scn.revenueMan * MAN;
  const sga       = scn.sgaMan * MAN;
  const salaryMo  = scn.salaryMonthlyMan * MAN;
  const salaryYr  = salaryMo * 12;
  const microMode = scn.pattern === 'micro';

  // 社保計算
  const si = calcSocialInsurance(salaryMo, scn.age40Plus, microMode);

  // 節税オプション（会社側損金・個人側所得控除）
  const opt = scn.options || {};
  // 会社側損金：倒産防止共済、社宅
  let corpDeduction = 0;
  if (opt.tousanboshi) corpDeduction += 2400000; // 年240万
  if (opt.shataku) {
    const rentMonth = (scn.rentMonthMan || 0) * MAN;
    corpDeduction += Math.floor(rentMonth * 12 * 0.5); // 50%法人負担
  }
  // 個人側所得控除：小規模企業共済（年84万）、iDeCo（年27.6万）
  let personalDeduction = 0;
  if (opt.shokibo) personalDeduction += 840000;
  if (opt.ideco)   personalDeduction += 276000;

  // 消費税
  const ct = calcConsumptionTax(revenue, sga, scn.ctTaxable, scn.ctMethod);

  // 法人所得 = 売上 - 販管費 - 役員報酬 - 会社負担社保 - 損金オプション
  const corpIncome = revenue - sga - salaryYr - si.corporateYearly - corpDeduction;
  const corp = calcCorporateTax(corpIncome);

  // 内部留保 = 法人所得 - 法人税合計 - 消費税
  const retained = corpIncome - corp.total - ct;

  // 個人サイド
  const pers = calcPersonal(salaryYr, si.individualYearly, personalDeduction);

  // 経営者総手取り
  const totalTakeHome = pers.takeHome + retained;

  return {
    scn,
    revenue, sga, salaryYr, salaryMo,
    si, corpDeduction, personalDeduction, ct,
    corp,
    retained,
    pers,
    totalTakeHome
  };
}

/* =========================================================
 * 13. パターン①節税最適：役員報酬を全探索して総手取り最大点を求める
 *     刻み：月10万円→月1万円の二段階で精度確保
 * ======================================================== */
function findOptimalSalary(baseScn) {
  let bestMan = 0;
  let bestTotal = -Infinity;

  // 第1段階：月10万円刻み（0〜200万）
  for (let m = 0; m <= 200; m += 10) {
    const sc = { ...baseScn, salaryMonthlyMan: m, pattern: 'optimal' };
    const r = calcScenario(sc);
    if (r.totalTakeHome > bestTotal) {
      bestTotal = r.totalTakeHome;
      bestMan = m;
    }
  }

  // 第2段階：±10万円の範囲を月1万円刻みで再探索
  const lo = Math.max(0, bestMan - 10);
  const hi = Math.min(200, bestMan + 10);
  for (let m = lo; m <= hi; m += 1) {
    const sc = { ...baseScn, salaryMonthlyMan: m, pattern: 'optimal' };
    const r = calcScenario(sc);
    if (r.totalTakeHome > bestTotal) {
      bestTotal = r.totalTakeHome;
      bestMan = m;
    }
  }

  return bestMan;
}

/* =========================================================
 * 14. パターン②手取り最大：個人手取り最大点を全探索
 * ======================================================== */
function findMaxTakeHomeSalary(baseScn) {
  let bestMan = 0;
  let bestPersonal = -Infinity;

  for (let m = 0; m <= 250; m += 10) {
    const sc = { ...baseScn, salaryMonthlyMan: m, pattern: 'maxTakeHome' };
    const r = calcScenario(sc);
    if (r.pers.takeHome > bestPersonal) {
      bestPersonal = r.pers.takeHome;
      bestMan = m;
    }
  }
  // 第2段階
  const lo = Math.max(0, bestMan - 10);
  const hi = Math.min(250, bestMan + 10);
  for (let m = lo; m <= hi; m += 1) {
    const sc = { ...baseScn, salaryMonthlyMan: m, pattern: 'maxTakeHome' };
    const r = calcScenario(sc);
    if (r.pers.takeHome > bestPersonal) {
      bestPersonal = r.pers.takeHome;
      bestMan = m;
    }
  }
  return bestMan;
}

/* =========================================================
 * 15. UI入力の取得
 * ======================================================== */
function getInputs() {
  const industry  = document.getElementById('industry').value;
  const revenueMan = parseFloat(document.getElementById('revenue').value) || 0;
  const sgaMan     = parseFloat(document.getElementById('sga').value) || 0;
  const age40Plus  = document.querySelector('input[name="age"]:checked').value === 'over40';
  const pattern    = document.querySelector('input[name="pattern"]:checked').value;
  const customSalaryMan = parseFloat(document.getElementById('customSalary').value) || 0;

  const opts = {
    tousanboshi: document.getElementById('opt-tousanboshi').checked,
    shokibo:     document.getElementById('opt-shokibo').checked,
    ideco:       document.getElementById('opt-ideco').checked,
    shataku:     document.getElementById('opt-shataku').checked
  };
  const rentMonthMan = parseFloat(document.getElementById('rentMonth').value) || 0;

  const ctTaxable = document.getElementById('ct-taxable').checked;
  const ctMethod  = document.querySelector('input[name="ctMethod"]:checked').value;

  return {
    industry, revenueMan, sgaMan, age40Plus,
    pattern, customSalaryMan,
    options: opts, rentMonthMan,
    ctTaxable, ctMethod
  };
}

/* =========================================================
 * 16. パターンごとの月額役員報酬を決定
 * ======================================================== */
function decideSalary(input, pattern) {
  const baseScn = {
    revenueMan: input.revenueMan,
    sgaMan: input.sgaMan,
    age40Plus: input.age40Plus,
    options: input.options,
    rentMonthMan: input.rentMonthMan,
    ctTaxable: input.ctTaxable,
    ctMethod: input.ctMethod
  };
  if (pattern === 'optimal')      return findOptimalSalary(baseScn);
  if (pattern === 'maxTakeHome')  return findMaxTakeHomeSalary(baseScn);
  if (pattern === 'micro')        return 4.5; // 月45,000円
  if (pattern === 'custom')       return input.customSalaryMan;
  return 50;
}

/* =========================================================
 * 17. メイン計算→UI更新
 * ======================================================== */
function recompute() {
  if (!DATA) return;

  const input = getInputs();

  // 3パターン全部計算（比較表用）
  const patternLabels = ['optimal', 'maxTakeHome', 'micro'];
  const results = {};
  for (const p of patternLabels) {
    const salaryMan = decideSalary(input, p);
    const scn = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: p,
      salaryMonthlyMan: salaryMan,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod
    };
    results[p] = calcScenario(scn);
  }

  // 選択されたパターンの結果（カスタムの場合は手動値で計算）
  let activeResult;
  if (input.pattern === 'custom') {
    const scn = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: 'custom',
      salaryMonthlyMan: input.customSalaryMan,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod
    };
    activeResult = calcScenario(scn);
  } else {
    activeResult = results[input.pattern];
  }

  // UI更新
  renderResultCard(activeResult, input.pattern);
  renderCompareTable(results);
  renderPL(activeResult);
  renderSensitivity(activeResult, input);
  renderWarnings(activeResult);
}

/* =========================================================
 * 18. UI描画：結果カード（メイン数値）
 * ======================================================== */
function renderResultCard(res, patternKey) {
  document.getElementById('total-take-home').textContent = fmtMan(res.totalTakeHome) + ' 万円';
  document.getElementById('personal-take-home').textContent = fmtMan(res.pers.takeHome);
  document.getElementById('retained-earnings').textContent  = fmtMan(res.retained);

  const patternLabels = {
    optimal:     '①節税最適',
    maxTakeHome: '②手取り最大',
    micro:       '③マイクロ法人型',
    custom:      'カスタム'
  };
  document.getElementById('pattern-label').textContent = patternLabels[patternKey];
  document.getElementById('salary-label').textContent =
    `役員報酬：月${res.scn.salaryMonthlyMan}万円・年${(res.scn.salaryMonthlyMan*12).toLocaleString()}万円`;
}

/* =========================================================
 * 19. UI描画：3パターン比較表（最大値ハイライト）
 * ======================================================== */
function renderCompareTable(results) {
  const fields = [
    ['salary',     r => r.scn.salaryMonthlyMan + '万円/月'],
    ['annualsalary', r => fmtMan(r.salaryYr)],
    ['corpinc',    r => fmtMan(r.corp.corpIncome)],
    ['corptax',    r => fmtMan(r.corp.total + r.ct)],
    ['perscost',   r => fmtMan(r.si.individualYearly + r.pers.totalPersonalTax)],
    ['personal',   r => fmtMan(r.pers.takeHome)],
    ['retained',   r => fmtMan(r.retained)],
    ['total',      r => fmtMan(r.totalTakeHome)]
  ];

  const idMap = { optimal: 'opt', maxTakeHome: 'max', micro: 'micro' };

  for (const [field, formatter] of fields) {
    for (const pat of ['optimal', 'maxTakeHome', 'micro']) {
      const cell = document.getElementById(`cmp-${idMap[pat]}-${field}`);
      if (cell) cell.textContent = formatter(results[pat]);
    }
  }

  // 最大の総手取りパターンをハイライト
  const totals = {
    optimal:     results.optimal.totalTakeHome,
    maxTakeHome: results.maxTakeHome.totalTakeHome,
    micro:       results.micro.totalTakeHome
  };
  const winner = Object.keys(totals).reduce((a, b) => totals[a] >= totals[b] ? a : b);

  // 既存ハイライトを除去
  document.querySelectorAll('.compare-table td.winner').forEach(td => td.classList.remove('winner'));
  // 全列ハイライト
  const winId = idMap[winner];
  for (const [field] of fields) {
    const cell = document.getElementById(`cmp-${winId}-${field}`);
    if (cell) cell.classList.add('winner');
  }
}

/* =========================================================
 * 20. UI描画：詳細P&L
 * ======================================================== */
function renderPL(res) {
  const $ = id => document.getElementById(id);

  // 会社サイド
  $('pl-revenue').textContent       = fmtMan(res.revenue);
  $('pl-sga').textContent           = fmtMan(res.sga);
  // うちAIツール代（業種×Tierから推定）
  const aiInfo = getAIToolsCost();
  if (aiInfo) {
    const annual = aiInfo.annualMid;
    const ratio = res.sga > 0 ? Math.round((annual / (res.sga / 10000)) * 100) : 0;
    $('pl-ai-tools').textContent = `約${annual.toFixed(0)}万円（販管費の約${ratio}%）`;
  } else {
    $('pl-ai-tools').textContent = '-';
  }
  $('pl-salary').textContent        = fmtMan(res.salaryYr);
  $('pl-corp-si').textContent       = fmtMan(res.si.corporateYearly);
  $('pl-corp-deduct').textContent   = fmtMan(res.corpDeduction);
  $('pl-corp-income').textContent   = fmtMan(res.corp.corpIncome);
  $('pl-corptax').textContent       = fmtMan(res.corp.corpTax);
  $('pl-localtax-fixed').textContent = fmtMan(res.corp.localFixed);
  $('pl-localtax-rate').textContent  = fmtMan(res.corp.localRate);
  $('pl-bizax').textContent         = fmtMan(res.corp.bizTax);
  $('pl-spbizax').textContent       = fmtMan(res.corp.spBizTax);
  $('pl-defense').textContent       = fmtMan(res.corp.defenseTax);
  $('pl-ct').textContent            = fmtMan(res.ct);
  $('pl-corp-totaltax').textContent = fmtMan(res.corp.total + res.ct);
  $('pl-retained').textContent      = fmtMan(res.retained);

  // 個人サイド
  $('pl-pers-salary').textContent     = fmtMan(res.pers.salaryYearly);
  $('pl-pers-si').textContent         = fmtMan(res.si.individualYearly);
  $('pl-pers-salded').textContent     = fmtMan(res.pers.salaryDeduction);
  $('pl-pers-salaryinc').textContent  = fmtMan(res.pers.salaryIncome);
  $('pl-pers-basicded').textContent   = fmtMan(res.pers.basicDeduction);
  $('pl-pers-otherded').textContent   = fmtMan(res.pers.additionalDeduction);
  $('pl-pers-taxable').textContent    = fmtMan(res.pers.taxable);
  $('pl-pers-incometax').textContent  = fmtMan(res.pers.incomeTax);
  $('pl-pers-reconst').textContent    = fmtMan(res.pers.reconstructionTax);
  $('pl-pers-resident').textContent   = fmtMan(res.pers.resident.incomeTaxResident);
  $('pl-pers-resident-fixed').textContent = fmtMan(res.pers.resident.perCapita);
  $('pl-pers-totaltax').textContent   = fmtMan(res.pers.totalPersonalTax);
  $('pl-pers-takehome').textContent   = fmtMan(res.pers.takeHome);
}

/* =========================================================
 * 21. UI描画：感度分析（基準±10万円・5段階）
 * ======================================================== */
function renderSensitivity(baseRes, input) {
  const tbody = document.querySelector('#sens-table tbody');
  tbody.innerHTML = '';
  const base = baseRes.scn.salaryMonthlyMan;
  const offsets = [-10, -5, 0, +5, +10];

  for (const off of offsets) {
    const m = Math.max(0, base + off);
    const scn = {
      revenueMan: input.revenueMan,
      sgaMan: input.sgaMan,
      age40Plus: input.age40Plus,
      pattern: 'custom',
      salaryMonthlyMan: m,
      options: input.options,
      rentMonthMan: input.rentMonthMan,
      ctTaxable: input.ctTaxable,
      ctMethod: input.ctMethod
    };
    const r = calcScenario(scn);
    const diff = r.totalTakeHome - baseRes.totalTakeHome;
    const tr = document.createElement('tr');
    if (off === 0) tr.classList.add('baseline-row');
    const diffClass = diff > 0 ? 'diff-positive' : (diff < 0 ? 'diff-negative' : '');
    tr.innerHTML = `
      <td>月${m.toLocaleString()}万円${off === 0 ? '（基準）' : (off > 0 ? ` (+${off})` : ` (${off})`)}</td>
      <td>${fmtMan(r.pers.takeHome)}</td>
      <td>${fmtMan(r.retained)}</td>
      <td>${fmtMan(r.totalTakeHome)}</td>
      <td class="${diffClass}">${off === 0 ? '-' : (diff > 0 ? '+' : '') + fmtMan(diff)}</td>
    `;
    tbody.appendChild(tr);
  }
}

/* =========================================================
 * 22. UI描画：警告表示
 * ======================================================== */
function renderWarnings(res) {
  const area = document.getElementById('warning-area');
  area.innerHTML = '';
  const warnings = [];

  if (res.corp.corpIncome < 0) {
    warnings.push('赤字決算：法人税はゼロですが、住民税均等割70,000円のみ発生します。');
  }
  if (res.corp.corpTax > DATA.tax_rates.defense_tax.deduction_yen) {
    warnings.push(`防衛特別法人税が発生：法人税 ${fmtMan(res.corp.corpTax)} 万円が500万円を超えています。`);
  }
  if (res.corp.corpTax > DATA.tax_rates.local_excess_threshold_corptax_yen) {
    warnings.push('法人税1,000万円超：住民税法人税割が10.4%の超過税率に切替わります。');
  }
  if (res.si.kenpoSyuho >= DATA.social_insurance.kenpo_max_yen) {
    warnings.push('健保標準報酬月額が上限（139万円）に到達しました。');
  }
  if (res.si.koseiSyuho >= DATA.social_insurance.kosei_max_yen) {
    warnings.push('厚生年金標準報酬月額が上限（65万円）に到達しました。');
  }
  if (res.scn.salaryMonthlyMan < 4.5 && res.scn.pattern !== 'micro') {
    warnings.push('役員報酬が月45,000円未満：社保の最低等級下限を下回るため計算結果が不正確になる可能性があります。');
  }

  for (const w of warnings) {
    const div = document.createElement('div');
    div.className = 'warning-item';
    div.textContent = '⚠ ' + w;
    area.appendChild(div);
  }
}

/* =========================================================
 * 23. 業種選択時のデフォルト値自動入力
 * ======================================================== */
function applyIndustryDefaults() {
  const ind = document.getElementById('industry').value;
  const data = DATA.industries[ind];
  if (!data) return;
  document.getElementById('revenue').value        = data.default_revenue;
  document.getElementById('revenue-slider').value = data.default_revenue;
  document.getElementById('sga').value            = data.default_sga;
  document.getElementById('customSalary').value   = data.default_salary_monthly;
  document.getElementById('industry-comment').textContent = data.comment;
  updateAIToolsDisplay();
}

/* =========================================================
 * 23.5 AIツール代の試算表示（業種×Tier）
 * ======================================================== */
function getAIToolsCost() {
  const ind = document.getElementById('industry').value;
  const tierEl = document.querySelector('input[name="aiTier"]:checked');
  const tier = tierEl ? tierEl.value : 'standard';
  const stack = DATA.ai_tools && DATA.ai_tools.industry_stacks[ind];
  if (!stack) return null;
  const range = stack.monthly_man[tier]; // [min, max] in 万円
  return {
    industry: ind,
    tier: tier,
    stackText: stack.stack,
    monthlyMin: range[0],
    monthlyMax: range[1],
    monthlyMid: (range[0] + range[1]) / 2,
    annualMin: range[0] * 12,
    annualMax: range[1] * 12,
    annualMid: (range[0] + range[1]) / 2 * 12,
    tierMeta: DATA.ai_tools.tiers[tier],
  };
}

function updateAIToolsDisplay() {
  const info = getAIToolsCost();
  const $ = id => document.getElementById(id);
  if (!info) {
    $('ai-tools-stack').textContent = '業種を選択...';
    $('ai-tools-monthly-amount').textContent = '-';
    $('ai-tools-annual-amount').textContent = '-';
    $('ai-tools-fit').textContent = '-';
    return;
  }
  $('ai-tools-stack').textContent = info.stackText;
  $('ai-tools-monthly-amount').textContent =
    info.monthlyMin === info.monthlyMax
      ? info.monthlyMin.toFixed(1)
      : `${info.monthlyMin.toFixed(1)}〜${info.monthlyMax.toFixed(1)}`;
  $('ai-tools-annual-amount').textContent =
    info.annualMin === info.annualMax
      ? info.annualMin.toFixed(1)
      : `${info.annualMin.toFixed(0)}〜${info.annualMax.toFixed(0)}`;
  $('ai-tools-fit').textContent = `${info.tierMeta.label}：${info.tierMeta.subtitle}（${info.tierMeta.fit}）`;

  // 販管費との整合性チェック
  const sga = parseFloat($('sga').value) || 0;
  const warningEl = $('ai-tools-warning');
  if (sga < info.annualMin) {
    warningEl.textContent =
      `⚠ 販管費 ${sga}万円 が AIツール代の最低想定 ${info.annualMin.toFixed(0)}万円 を下回っています。販管費に他の固定費（事務・通信・税理士等）も含まれるため、${(info.annualMin + 5).toFixed(0)}万円以上を推奨。`;
    warningEl.classList.add('is-active');
  } else {
    warningEl.classList.remove('is-active');
  }
}

/* =========================================================
 * 24. イベントハンドラ登録
 * ======================================================== */
function setupEvents() {
  // 業種選択
  document.getElementById('industry').addEventListener('change', () => {
    applyIndustryDefaults();
    triggerRecompute();
  });

  // 年商：スライダー⇔数値の双方向バインド
  document.getElementById('revenue-slider').addEventListener('input', e => {
    document.getElementById('revenue').value = e.target.value;
    triggerRecompute();
  });
  document.getElementById('revenue').addEventListener('input', e => {
    document.getElementById('revenue-slider').value = e.target.value;
    triggerRecompute();
  });

  // その他の入力すべて
  const ids = ['sga', 'customSalary', 'rentMonth'];
  ids.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'sga') updateAIToolsDisplay();
      triggerRecompute();
    });
  });

  // ラジオボタン
  document.querySelectorAll('input[name="age"], input[name="pattern"], input[name="ctMethod"]').forEach(el => {
    el.addEventListener('change', () => {
      // パターン=customのときだけカスタム入力欄を有効化
      const isCustom = document.querySelector('input[name="pattern"]:checked').value === 'custom';
      document.getElementById('customSalary').disabled = !isCustom;
      triggerRecompute();
    });
  });

  // AIツール代 Tier 切替
  document.querySelectorAll('input[name="aiTier"]').forEach(el => {
    el.addEventListener('change', () => {
      updateAIToolsDisplay();
      triggerRecompute();
    });
  });

  // チェックボックス
  document.querySelectorAll('#opt-tousanboshi, #opt-shokibo, #opt-ideco, #opt-shataku, #ct-taxable').forEach(el => {
    el.addEventListener('change', triggerRecompute);
  });
}

function triggerRecompute() {
  if (DEBOUNCE_TIMER) clearTimeout(DEBOUNCE_TIMER);
  DEBOUNCE_TIMER = setTimeout(recompute, 200);
}

/* =========================================================
 * 25. テストケース検証（コンソール出力）
 *     教科書値と完全一致を確認
 * ======================================================== */
function runTestCases() {
  console.log('═══════════════════════════════════════════════');
  console.log('  AIで一人起業の教科書 シミュレーター v1.0');
  console.log('  テストケース検証（教科書値との一致確認）');
  console.log('═══════════════════════════════════════════════');

  const cases = [
    {
      label: 'TC1: 受託開発・年商1000・販管費200・役員報酬600・40未満・①',
      input: {
        revenueMan: 1000, sgaMan: 200, age40Plus: false,
        pattern: 'custom', salaryMonthlyMan: 50,
        options: {}, rentMonthMan: 0,
        ctTaxable: false, ctMethod: 'simplified'
      },
      expected: { totalTakeHome: 5488100, personal: 4648900, retained: 839200 }
    },
    {
      label: 'TC2: カスタム・年商2000・販管費300・役員報酬1000・40未満・①',
      input: {
        revenueMan: 2000, sgaMan: 300, age40Plus: false,
        pattern: 'custom', salaryMonthlyMan: 1000/12, // 月83.33...
        options: {}, rentMonthMan: 0,
        ctTaxable: false, ctMethod: 'simplified'
      },
      expected: { totalTakeHome: 11773500, personal: 7308900, retained: 4464600 }
    },
    {
      label: 'TC3: 任意・年商200・販管費80・パターン③マイクロ法人型',
      input: {
        revenueMan: 200, sgaMan: 80, age40Plus: false,
        pattern: 'micro', salaryMonthlyMan: 4.5,
        options: {}, rentMonthMan: 0,
        ctTaxable: false, ctMethod: 'simplified'
      },
      expected: { totalTakeHome: 751600, personal: 403300, retained: 348300 }
    },
    {
      label: 'TC4: 任意・年商5000・販管費500・役員報酬2000・40未満・①',
      input: {
        revenueMan: 5000, sgaMan: 500, age40Plus: false,
        pattern: 'custom', salaryMonthlyMan: 2000/12, // 月166.67
        options: {}, rentMonthMan: 0,
        ctTaxable: false, ctMethod: 'simplified'
      },
      expected: { totalTakeHome: 29349600, personal: 13055700, retained: 16293900 }
    }
  ];

  for (const tc of cases) {
    const r = calcScenario(tc.input);
    const okTotal    = Math.abs(r.totalTakeHome - tc.expected.totalTakeHome) <= 50000; // 5万円誤差許容
    const okPersonal = Math.abs(r.pers.takeHome  - tc.expected.personal)     <= 50000;
    const okRetained = Math.abs(r.retained       - tc.expected.retained)     <= 50000;
    const status = (okTotal && okPersonal && okRetained) ? 'PASS' : 'CHECK';

    console.log(`\n[${status}] ${tc.label}`);
    console.log(`  総手取り: 計算${fmtMan(r.totalTakeHome)}万 / 期待${fmtMan(tc.expected.totalTakeHome)}万 / 差${fmtMan(r.totalTakeHome - tc.expected.totalTakeHome)}万`);
    console.log(`  個人手取: 計算${fmtMan(r.pers.takeHome)}万  / 期待${fmtMan(tc.expected.personal)}万 / 差${fmtMan(r.pers.takeHome - tc.expected.personal)}万`);
    console.log(`  内部留保: 計算${fmtMan(r.retained)}万      / 期待${fmtMan(tc.expected.retained)}万 / 差${fmtMan(r.retained - tc.expected.retained)}万`);
    console.log(`  社保詳細: 個人${fmtMan(r.si.individualYearly)}万 / 会社${fmtMan(r.si.corporateYearly)}万 / 健保標報¥${r.si.kenpoSyuho.toLocaleString()} / 厚年標報¥${r.si.koseiSyuho.toLocaleString()}`);
    console.log(`  法人税内訳: 法人税${fmtMan(r.corp.corpTax)}万・均等割${fmtMan(r.corp.localFixed)}万・法人税割${fmtMan(r.corp.localRate)}万・事業税${fmtMan(r.corp.bizTax)}万・特別事業${fmtMan(r.corp.spBizTax)}万・防衛${fmtMan(r.corp.defenseTax)}万 = 合計${fmtMan(r.corp.total)}万`);
    console.log(`  個人税内訳: 所得税${fmtMan(r.pers.incomeTax)}万＋復興${fmtMan(r.pers.reconstructionTax)}万＋住民${fmtMan(r.pers.resident.total)}万 = 計${fmtMan(r.pers.totalPersonalTax)}万`);
  }
  console.log('═══════════════════════════════════════════════');
}

/* =========================================================
 * 26. 起動
 * ======================================================== */
async function init() {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
  } catch (e) {
    console.error('data.json の読み込みに失敗しました:', e);
    document.body.innerHTML = '<div style="padding:30px;font-family:sans-serif;color:#C62828;">'
      + '<h2>data.json を読み込めませんでした</h2>'
      + '<p>このシミュレーターはローカルでも動作しますが、ブラウザがfetch()でローカルファイルへのアクセスを拒否することがあります。'
      + '<br>その場合は次のいずれかで起動してください：</p>'
      + '<pre style="background:#F5F5F5;padding:12px;">cd 05_simulator\npython -m http.server 8000\n# → http://localhost:8000 を開く</pre>'
      + '<p>または VSCode の Live Server / npx serve など。</p>'
      + '</div>';
    return;
  }

  setupEvents();
  applyIndustryDefaults();
  recompute();
  runTestCases();
}

document.addEventListener('DOMContentLoaded', init);

})();
