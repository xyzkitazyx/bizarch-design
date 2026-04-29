// Node.js テスト用 — script.jsの計算ロジックをそのまま検証
// 実行: node test_node.js

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf-8'));
const MAN = 10000;

function fmtMan(yen, dp=2) {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  const sign = yen < 0 ? '-' : '';
  const abs = Math.abs(yen);
  const man = Math.floor(abs / 100) / 100;
  return sign + man.toFixed(dp);
}

function getSyuhoYen(actualMonthlyYen, type) {
  const table = DATA.syuho_table[type];
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (row.upperYen === null) {
      if (actualMonthlyYen >= row.lowerYen) return row.syuhoYen;
    } else {
      if (actualMonthlyYen >= row.lowerYen && actualMonthlyYen < row.upperYen) {
        return row.syuhoYen;
      }
    }
  }
  return table[0].syuhoYen;
}

function calcSocialInsurance(monthlySalaryYen, age40Plus, microMode) {
  const si = DATA.social_insurance;
  let kenpoSyuho, koseiSyuho;
  if (microMode) {
    kenpoSyuho = si.kenpo_min_yen;
    koseiSyuho = si.kosei_min_yen;
  } else {
    kenpoSyuho = getSyuhoYen(monthlySalaryYen, 'kenpo');
    koseiSyuho = getSyuhoYen(monthlySalaryYen, 'kosei');
  }
  const kenpoMonthlyTotal = kenpoSyuho * (si.kenpo + si.child_support);
  const kaigoMonthlyTotal = age40Plus ? kenpoSyuho * si.kaigo : 0;
  const koseiMonthlyTotal = koseiSyuho * si.kosei;
  const indivMonthly = (kenpoMonthlyTotal + kaigoMonthlyTotal + koseiMonthlyTotal) / 2;
  return {
    kenpoSyuho, koseiSyuho,
    individualYearly: Math.round(indivMonthly * 12),
    corporateYearly:  Math.round(indivMonthly * 12)
  };
}

function calcSalaryDeduction(salaryYen) {
  for (const b of DATA.salary_deduction.brackets) {
    if (b.upToYen === null || salaryYen <= b.upToYen) {
      if (b.fixedYen !== null) return b.fixedYen;
      return Math.floor(salaryYen * b.rate + b.constYen);
    }
  }
  return 1950000;
}

function calcBasicDeduction(totalIncomeYen) {
  for (const b of DATA.basic_deduction.brackets) {
    if (b.upToYen === null || totalIncomeYen <= b.upToYen) return b.amountYen;
  }
  return 0;
}

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

function calcResidentTax(salaryIncomeYen, individualSiYen) {
  const rt = DATA.resident_tax;
  const taxableForResident = Math.max(0, salaryIncomeYen - individualSiYen - rt.basic_deduction_yen);
  let incomeTaxResident = 0;
  if (taxableForResident > 0) {
    incomeTaxResident = Math.max(0, Math.floor(taxableForResident * rt.income_rate - rt.adjustment_deduction_yen));
  }
  return { taxable: taxableForResident, incomeTaxResident, perCapita: rt.per_capita_yen, total: incomeTaxResident + rt.per_capita_yen };
}

function calcCorporateTax(corpIncomeYen) {
  const t = DATA.tax_rates;
  if (corpIncomeYen <= 0) {
    return { corpIncome: corpIncomeYen, corpTax: 0, localFixed: t.local_per_capita_yen, localRate: 0, bizTax: 0, spBizTax: 0, defenseTax: 0, total: t.local_per_capita_yen };
  }
  let corpTax = 0;
  if (corpIncomeYen <= t.corp_threshold_yen) {
    corpTax = Math.floor(corpIncomeYen * t.corp_below_8m);
  } else {
    corpTax = Math.floor(t.corp_threshold_yen * t.corp_below_8m + (corpIncomeYen - t.corp_threshold_yen) * t.corp_above_8m);
  }
  let localRate = 0;
  if (corpTax <= t.local_excess_threshold_corptax_yen) {
    localRate = Math.floor(corpTax * t.local_income_rate);
  } else {
    localRate = Math.floor(t.local_excess_threshold_corptax_yen * t.local_income_rate + (corpTax - t.local_excess_threshold_corptax_yen) * t.local_income_rate_excess);
  }
  let bizTax = 0;
  let prev = 0;
  for (const br of t.business_tax_brackets) {
    const cap = br.upToYen === null ? Infinity : br.upToYen;
    const portion = Math.max(0, Math.min(corpIncomeYen, cap) - prev);
    if (portion <= 0) break;
    bizTax += portion * br.rate;
    if (br.upToYen !== null && corpIncomeYen > br.upToYen) {
      prev = br.upToYen;
    } else { break; }
  }
  bizTax = Math.floor(bizTax);
  const spBizTax = Math.floor(bizTax * t.special_business_tax_rate);
  let defenseTax = 0;
  if (corpTax > t.defense_tax.deduction_yen) {
    defenseTax = Math.floor((corpTax - t.defense_tax.deduction_yen) * t.defense_tax.rate);
  }
  const total = corpTax + t.local_per_capita_yen + localRate + bizTax + spBizTax + defenseTax;
  return { corpIncome: corpIncomeYen, corpTax, localFixed: t.local_per_capita_yen, localRate, bizTax, spBizTax, defenseTax, total };
}

function calcPersonal(salaryYearlyYen, individualSiYen, additionalDeductionYen) {
  const salaryDeduction = calcSalaryDeduction(salaryYearlyYen);
  const salaryIncome = Math.max(0, salaryYearlyYen - salaryDeduction);
  const basicDeduction = calcBasicDeduction(salaryIncome);
  const taxable = Math.max(0, salaryIncome - basicDeduction - individualSiYen - additionalDeductionYen);
  const { incomeTax, reconstructionTax } = calcIncomeTax(taxable);
  const resident = calcResidentTax(salaryIncome, individualSiYen + additionalDeductionYen);
  const totalPersonalTax = incomeTax + reconstructionTax + resident.total;
  const takeHome = salaryYearlyYen - individualSiYen - totalPersonalTax;
  return { salaryYearly: salaryYearlyYen, salaryDeduction, salaryIncome, basicDeduction, taxable, incomeTax, reconstructionTax, resident, totalPersonalTax, takeHome };
}

function calcScenario(scn) {
  const revenue = scn.revenueMan * MAN;
  const sga = scn.sgaMan * MAN;
  const salaryMo = scn.salaryMonthlyMan * MAN;
  const salaryYr = salaryMo * 12;
  const microMode = scn.pattern === 'micro';
  const si = calcSocialInsurance(salaryMo, scn.age40Plus, microMode);
  const corpIncome = revenue - sga - salaryYr - si.corporateYearly;
  const corp = calcCorporateTax(corpIncome);
  const retained = corpIncome - corp.total;
  const pers = calcPersonal(salaryYr, si.individualYearly, 0);
  const totalTakeHome = pers.takeHome + retained;
  return { scn, revenue, sga, salaryYr, salaryMo, si, corp, retained, pers, totalTakeHome };
}

const cases = [
  {
    label: 'TC1: 受託開発・年商1000・販管費200・役員報酬600・40未満・①',
    input: { revenueMan: 1000, sgaMan: 200, age40Plus: false, pattern: 'custom', salaryMonthlyMan: 50 },
    expected: { totalTakeHome: 5488100, personal: 4648900, retained: 839200 }
  },
  {
    label: 'TC2: カスタム・年商2000・販管費300・役員報酬1000・40未満・①',
    input: { revenueMan: 2000, sgaMan: 300, age40Plus: false, pattern: 'custom', salaryMonthlyMan: 1000/12 },
    expected: { totalTakeHome: 11773500, personal: 7308900, retained: 4464600 }
  },
  {
    label: 'TC3: 任意・年商200・販管費80・パターン③マイクロ法人',
    input: { revenueMan: 200, sgaMan: 80, age40Plus: false, pattern: 'micro', salaryMonthlyMan: 4.5 },
    expected: { totalTakeHome: 751600, personal: 403300, retained: 348300 }
  },
  {
    label: 'TC4: 任意・年商5000・販管費500・役員報酬2000・40未満・①',
    input: { revenueMan: 5000, sgaMan: 500, age40Plus: false, pattern: 'custom', salaryMonthlyMan: 2000/12 },
    expected: { totalTakeHome: 29349600, personal: 13055700, retained: 16293900 }
  }
];

console.log('═══════════════════════════════════════════════');
console.log('  シミュレーター計算検証');
console.log('═══════════════════════════════════════════════');

for (const tc of cases) {
  const r = calcScenario(tc.input);
  const totalDiff = r.totalTakeHome - tc.expected.totalTakeHome;
  const personalDiff = r.pers.takeHome - tc.expected.personal;
  const retainedDiff = r.retained - tc.expected.retained;

  console.log(`\n${tc.label}`);
  console.log(`  社保: 健保標報¥${r.si.kenpoSyuho.toLocaleString()} / 厚年標報¥${r.si.koseiSyuho.toLocaleString()} / 個人${fmtMan(r.si.individualYearly)}万 / 会社${fmtMan(r.si.corporateYearly)}万`);
  console.log(`  会社: 法人所得${fmtMan(r.corp.corpIncome)}万 / 法人税${fmtMan(r.corp.corpTax)}万 / 均等割${fmtMan(r.corp.localFixed)}万 / 法人税割${fmtMan(r.corp.localRate)}万 / 事業税${fmtMan(r.corp.bizTax)}万 / 特別${fmtMan(r.corp.spBizTax)}万 / 防衛${fmtMan(r.corp.defenseTax)}万 = 合計${fmtMan(r.corp.total)}万`);
  console.log(`  個人: 給与控${fmtMan(r.pers.salaryDeduction)}万 / 給与所得${fmtMan(r.pers.salaryIncome)}万 / 基礎控${fmtMan(r.pers.basicDeduction)}万 / 課税所得${fmtMan(r.pers.taxable)}万 / 所税${fmtMan(r.pers.incomeTax)}万＋復興${fmtMan(r.pers.reconstructionTax)}万＋住民${fmtMan(r.pers.resident.total)}万 = 計${fmtMan(r.pers.totalPersonalTax)}万`);
  console.log(`  総手取り: 計算 ${fmtMan(r.totalTakeHome)}万 / 期待 ${fmtMan(tc.expected.totalTakeHome)}万 / 差 ${fmtMan(totalDiff)}万`);
  console.log(`  個人手取: 計算 ${fmtMan(r.pers.takeHome)}万  / 期待 ${fmtMan(tc.expected.personal)}万 / 差 ${fmtMan(personalDiff)}万`);
  console.log(`  内部留保: 計算 ${fmtMan(r.retained)}万      / 期待 ${fmtMan(tc.expected.retained)}万 / 差 ${fmtMan(retainedDiff)}万`);
}
