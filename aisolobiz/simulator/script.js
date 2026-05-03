/* =========================================================
 * AIで一人個人事業の教科書 収支シミュレーター v1.0
 *
 * 計算前提（2026年4月時点・東京23区基準）：
 *  - 所得税：累進5/10/20/23/33/40/45%＋復興特別2.1%
 *  - 住民税：所得割10%＋均等割5,000円・基礎控除43万・調整控除2,500円
 *  - 国保：所得割13.7%＋均等割66,000円・上限109万（東京23区）
 *  - 国民年金：月17,510円（年210,120円）
 *  - 青色：65万（e-Tax要件）／55万（紙）／10万（簡易）／白色0
 *  - 基礎控除：所得税48万・住民税43万
 *  - iDeCo（〜68,000/月）／小規模共済（〜70,000/月）／国民年金基金（iDeCo合算で68,000/月）
 *  - 専従者給与：あり（経費化＋配偶者控除消滅）／なし
 *
 * 副業モード：給与＋事業所得の合算累進
 * 専業モード：事業所得のみ＋国保＋国民年金
 * ======================================================== */

(() => {
'use strict';

let DATA = null;
let DEBOUNCE_TIMER = null;
const MAN = 10000;

/* =========================================================
 * 1. ユーティリティ
 * ======================================================== */
function fmtMan(yen, opts = {}) {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  const sign = yen < 0 ? '-' : '';
  const abs = Math.abs(yen);
  const man = Math.floor(abs / 100) / 100;
  return sign + man.toLocaleString('ja-JP', {
    minimumFractionDigits: opts.dp ?? 1,
    maximumFractionDigits: opts.dp ?? 1
  });
}

function fmtManInt(yen) {
  if (yen === null || yen === undefined || isNaN(yen)) return '-';
  return Math.round(yen / MAN).toLocaleString('ja-JP');
}

/* =========================================================
 * 2. 給与所得控除（2026年版）
 *  〜162.5万：55万固定／〜180万：×40-10万／〜360万：×30+8万／
 *  〜660万：×20+44万／〜850万：×10+110万／850万超：195万固定
 * ======================================================== */
function calcSalaryDeduction(salaryYen) {
  if (salaryYen <= 0) return 0;
  for (const b of DATA.salary_deduction.brackets) {
    if (b.upToYen === null || salaryYen <= b.upToYen) {
      if (b.fixedYen !== null) return b.fixedYen;
      return Math.max(0, Math.floor(salaryYen * b.rate + b.constYen));
    }
  }
  return 1950000;
}

/* =========================================================
 * 3. 所得税（累進5-45%・控除額あり）＋復興特別2.1%
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
 * 4. 住民税（所得割10% + 均等割5,000円・基礎控除43万）
 *    調整控除2,500円
 * ======================================================== */
function calcResidentTax(taxableForResidentYen) {
  const rt = DATA.resident_tax;
  let incomeRate = 0;
  if (taxableForResidentYen > 0) {
    incomeRate = Math.max(0, Math.floor(taxableForResidentYen * rt.income_rate - rt.adjustment_deduction_yen));
  }
  return {
    incomeRate,
    perCapita: rt.per_capita_yen,
    total: incomeRate + rt.per_capita_yen
  };
}

/* =========================================================
 * 5. 国保（自治体別マスタ・上限109万）
 *  保険料 = 所得割（事業所得-基礎控除43万）×料率 + 均等割
 *  ※ 介護分は40歳以上で加算
 *  ※ 上限を超えると上限値で固定
 * ======================================================== */
function calcKokuho(businessIncomeYen, municipality, age40Plus) {
  const m = DATA.kokuho_municipalities[municipality] || DATA.kokuho_municipalities['東京23区'];
  // 国保算定基礎所得 = 総所得金額等 - 基礎控除43万
  const base = Math.max(0, businessIncomeYen - 430000);
  let income = base * m.income_rate + m.per_capita_yen;
  if (age40Plus) {
    income += base * m.kaigo_addition_rate + m.kaigo_per_capita_yen;
  }
  return Math.min(Math.floor(income), m.limit_yen);
}

/* =========================================================
 * 6. 青色控除額（申告区分→控除額）
 * ======================================================== */
function getAoiroDeduction(filing) {
  const d = DATA.deductions;
  if (filing === 'aoiro65')  return d.aoiro_etax_yen;
  if (filing === 'aoiro55')  return d.aoiro_paper_yen;
  if (filing === 'aoiro10')  return d.aoiro_simple_yen;
  return d.shiroiro_yen; // 白色
}

/* =========================================================
 * 7. 配偶者控除・配偶者特別控除（簡易版）
 *  - 給与収入103万以下：配偶者控除38万
 *  - 給与収入〜150万：配偶者特別控除38万
 *  - 給与収入〜201万：段階的に控除減（簡易直線で近似）
 *  - 201万超：0
 * ======================================================== */
function calcSpouseDeduction(spouseIncomeYen, dependents) {
  const d = DATA.deductions;
  let spouse = 0;
  if (spouseIncomeYen <= 1030000) {
    spouse = d.spouse_deduction_yen;
  } else if (spouseIncomeYen <= 1500000) {
    spouse = d.spouse_deduction_yen;
  } else if (spouseIncomeYen <= 2010000) {
    // 直線で減額（150→201万で38万→0）
    const ratio = 1 - (spouseIncomeYen - 1500000) / (2010000 - 1500000);
    spouse = Math.max(0, Math.floor(d.spouse_deduction_yen * ratio));
  } else {
    spouse = 0;
  }
  // 扶養控除：扶養家族数×38万
  const dep = dependents * d.dependent_deduction_yen;
  return spouse + dep;
}

/* =========================================================
 * 8. 副業モード計算
 *  入力：給与・事業所得・経費・申告区分・自治体・配偶者・扶養数
 *  本業の給与社保は給与年収から逆算（簡易：給与×14.4%）
 * ======================================================== */
function calcFukugyou(input) {
  const revenue = input.revenueMan * MAN;
  const expense = input.expenseMan * MAN;
  const salaryIncomeYen = input.salaryIncomeMan * MAN;

  // 給与所得
  const salaryDeduction = calcSalaryDeduction(salaryIncomeYen);
  const salaryIncome = Math.max(0, salaryIncomeYen - salaryDeduction);

  // 給与社保（簡易：14.4%）
  const kyuyoShaho = Math.floor(salaryIncomeYen * 0.144);

  // 事業所得（青色控除前）
  const businessGross = revenue - expense;
  const aoiroDeduction = getAoiroDeduction(input.filing);
  // 青色控除は所得を超えない（赤字に拡大はしない）
  const aoiroApplied = Math.min(Math.max(0, businessGross), aoiroDeduction);
  const businessIncome = businessGross - aoiroApplied;

  // 合計所得
  const totalIncome = salaryIncome + businessIncome;

  // 控除（基礎・配偶者・扶養）
  const basicDed = DATA.deductions.basic_deduction_income_tax_yen;
  const spouseDed = calcSpouseDeduction(input.spouseIncomeMan * MAN, input.dependents);

  // 所得税課税所得 = 合計所得 - 給与社保 - 基礎 - 配偶者・扶養
  const taxableIncomeTax = Math.max(0, totalIncome - kyuyoShaho - basicDed - spouseDed);
  const { incomeTax, reconstructionTax } = calcIncomeTax(taxableIncomeTax);

  // 住民税課税所得 = 合計所得 - 給与社保 - 住民税基礎控除43万 - 配偶者・扶養（住民税は33万/扶養）
  const residentBasicDed = DATA.resident_tax.basic_deduction_yen;
  const residentSpouseDed = spouseDed > 0 ? Math.floor(spouseDed * (330000 / 380000)) : 0;
  const taxableResident = Math.max(0, totalIncome - kyuyoShaho - residentBasicDed - residentSpouseDed);
  const resident = calcResidentTax(taxableResident);

  // 副業者は本業給与の手取りもカウント
  const salaryNet = salaryIncomeYen - kyuyoShaho;

  // 合計税
  const totalTax = incomeTax + reconstructionTax + resident.total;

  // 手取り = 給与手取り + 事業所得 - 税
  // ※ 事業所得は経費控除後の純粋なキャッシュ（青色控除は会計上の控除なので手取りには含めない）
  const businessCash = revenue - expense;
  const takeHome = salaryNet + businessCash - totalTax;

  return {
    mode: 'fukugyou',
    revenue, expense,
    salaryIncomeYen, salaryDeduction, salaryIncome, kyuyoShaho, salaryNet,
    businessGross, aoiroApplied, businessIncome, businessCash,
    totalIncome,
    basicDed, spouseDed, residentSpouseDed,
    taxableIncomeTax, taxableResident,
    incomeTax, reconstructionTax, resident,
    kokuho: 0, nenkin: 0, kyosaiDeduction: 0, senjusha: 0,
    totalTax,
    takeHome
  };
}

/* =========================================================
 * 9. 専業モード計算
 *  入力：年商・経費・申告区分・自治体・iDeCo/共済/基金/専従者
 *  国保・国民年金あり、給与なし
 * ======================================================== */
function calcSengyou(input) {
  const revenue = input.revenueMan * MAN;
  const expense = input.expenseMan * MAN;

  // 専従者給与（経費化）
  const senjusha = input.senjushaOn ? input.senjushaMonthMan * MAN * 12 : 0;

  // 事業所得（控除前）= 年商 - 経費 - 専従者給与
  const businessGross = revenue - expense - senjusha;

  // 青色控除
  const aoiroDeduction = getAoiroDeduction(input.filing);
  const aoiroApplied = Math.min(Math.max(0, businessGross), aoiroDeduction);

  // 事業所得（青色控除後）
  const businessIncome = businessGross - aoiroApplied;

  // 国保（事業所得ベース）
  const kokuho = calcKokuho(businessIncome, input.municipality, input.age40Plus);

  // 国民年金
  const nenkin = DATA.kokumin_nenkin.yearly_yen;

  // iDeCo＋共済＋基金（所得控除）
  const idecoYearly = (input.idecoMonth || 0) * 12;
  const kyosaiYearly = (input.kyosaiMonth || 0) * 12;
  const kikinYearly = (input.kikinMonth || 0) * 12;
  // iDeCo+基金の合算は月68,000・年816,000まで
  const idecoKikinTotal = Math.min(idecoYearly + kikinYearly, DATA.ideco.max_yearly_yen);
  // 小規模共済単独で月70,000・年840,000まで
  const kyosaiCapped = Math.min(kyosaiYearly, DATA.shokibo_kyosai.max_yearly_yen);
  const kyosaiDeduction = idecoKikinTotal + kyosaiCapped;

  // 配偶者控除：専従者にしている場合は使えない
  const spouseDed = input.senjushaOn ? 0 : calcSpouseDeduction(0, 0); // 配偶者収入0前提
  const dependentsDed = (input.dependents || 0) * DATA.deductions.dependent_deduction_yen;
  const spouseAndDep = spouseDed + dependentsDed;

  // 基礎控除
  const basicDed = DATA.deductions.basic_deduction_income_tax_yen;

  // 所得税課税所得 = 事業所得 - 国保 - 国民年金 - 共済 - 基礎 - 配偶者・扶養
  const taxableIncomeTax = Math.max(0,
    businessIncome - kokuho - nenkin - kyosaiDeduction - basicDed - spouseAndDep
  );
  const { incomeTax, reconstructionTax } = calcIncomeTax(taxableIncomeTax);

  // 住民税課税所得 = 事業所得 - 国保 - 国民年金 - 共済 - 住民税基礎43万 - 配偶者・扶養（33万分）
  const residentBasicDed = DATA.resident_tax.basic_deduction_yen;
  const residentSpouseDed = spouseDed > 0 ? Math.floor(spouseDed * (330000 / 380000)) : 0;
  const taxableResident = Math.max(0,
    businessIncome - kokuho - nenkin - kyosaiDeduction - residentBasicDed - residentSpouseDed - dependentsDed
  );
  const resident = calcResidentTax(taxableResident);

  const totalTax = incomeTax + reconstructionTax + resident.total;

  // 手取り = 年商 - 経費 - 専従者給与 - 国保 - 国民年金 - 共済 - 税
  // ※ 専従者給与は本人ではなく配偶者の取り分なので世帯としては残るが、本シミュは「本人手取り」を表示
  const takeHome = revenue - expense - senjusha - kokuho - nenkin - kyosaiDeduction - totalTax;

  return {
    mode: 'sengyou',
    revenue, expense, senjusha,
    businessGross, aoiroApplied, businessIncome, businessCash: businessIncome,
    salaryIncomeYen: 0, salaryDeduction: 0, salaryIncome: 0, kyuyoShaho: 0, salaryNet: 0,
    totalIncome: businessIncome,
    basicDed, spouseDed: spouseAndDep, residentSpouseDed,
    taxableIncomeTax, taxableResident,
    incomeTax, reconstructionTax, resident,
    kokuho, nenkin, kyosaiDeduction,
    idecoYearly, kyosaiYearlyCapped: kyosaiCapped, kikinYearly,
    totalTax,
    takeHome
  };
}

/* =========================================================
 * 10. 6つの壁判定
 *  副業：103/106/130/150/200万
 *  専業：1000万（インボイス）
 *  共通：法人成り（課税所得600万 or 年商800万）
 * ======================================================== */
function judgeWalls(result, input) {
  const walls = [];
  const W = DATA.wall_thresholds;
  const businessGross = result.businessGross; // 経費後・控除前の事業所得相当
  const businessIncome = result.businessIncome; // 青色控除後

  if (input.mode === 'fukugyou') {
    const fW = W.fukugyou;
    // 200万：副業所得20万・住民税申告必要ライン
    if (businessGross >= fW.wall_200.yen && businessGross < 1030000) {
      walls.push({
        level: 'yellow',
        label: '【副業の壁】住民税申告必要',
        text: `事業所得が20万円超：所得税は申告不要でも、住民税は別途申告が必要です。`
      });
    }
    if (businessGross >= 1030000 && businessGross < 1060000) {
      walls.push({
        level: 'yellow',
        label: '【103万の壁】配偶者控除',
        text: `事業所得103万超：配偶者の配偶者控除（38万）の対象から外れます。`
      });
    }
    if (input.spouseShahoFuyo && businessGross >= 1300000) {
      walls.push({
        level: 'red',
        label: '【130万の壁】社保被扶養者の壁',
        text: `事業所得130万超：配偶者の社会保険被扶養者から外れます。年30〜50万円の負担増。`
      });
    } else if (input.spouseShahoFuyo && businessGross >= 1060000) {
      walls.push({
        level: 'yellow',
        label: '【106万の壁】社保適用拡大ライン',
        text: `パート給与換算で106万：今後の社保適用拡大の対象になる可能性があります。`
      });
    }
    if (businessGross >= 1500000 && businessGross < 2010000) {
      walls.push({
        level: 'yellow',
        label: '【150万の壁】配偶者特別控除減額帯',
        text: `事業所得150万超：配偶者特別控除が段階的に減額されます。`
      });
    }
    if (businessGross >= 3000000) {
      walls.push({
        level: 'blue',
        label: '【副業300万の壁】事業性',
        text: `売上300万超：副業を「事業所得」として認められやすい。帳簿があればAI関連経費もしっかり経費化可能。`
      });
    }
  }

  if (input.mode === 'sengyou') {
    if (businessIncome >= W.sengyou.wall_kiso_48.yen) {
      walls.push({
        level: 'green',
        label: '【48万の壁】基礎控除超え',
        text: `事業所得48万超：所得税課税所得が発生しています。青色65万＋共済の積み上げで節税余地あり。`
      });
    }
    if (result.revenue >= W.sengyou.wall_invoice_1000.yen) {
      walls.push({
        level: 'red',
        label: '【1,000万の壁】消費税課税事業者',
        text: `年商1,000万超：消費税の課税事業者になります（2年後課税）。インボイス2割特例 or 簡易課税の検討を。`
      });
    }
  }

  // 法人成り判定（共通）
  if (result.taxableIncomeTax >= W.sengyou.wall_houjin_600.yen
      || result.revenue >= W.sengyou.wall_houjin_revenue_800.yen) {
    walls.push({
      level: 'red',
      label: '【法人成り検討ライン】',
      text: `課税所得600万 or 年商800万を超えました。法人成りで税負担が下がる可能性が高い。法人版シミュレーターで試算を。`
    });
  }

  return walls;
}

/* =========================================================
 * 11. 弥生CTAの判定
 * ======================================================== */
function judgeYayoiCta(result, input) {
  const ctas = [];
  const businessGross = result.businessGross;

  // 開業前/未開業を想定して、副業少額帯と青色推奨を出し分け
  if (businessGross < 500000 && input.mode === 'fukugyou') {
    // 副業少額帯（事業所得<50万）：白色申告
    ctas.push({
      key: 'shiroiro',
      url: DATA.yayoi_cta.shiroiro.url,
      label: DATA.yayoi_cta.shiroiro.label,
      sub: DATA.yayoi_cta.shiroiro.subtext
    });
  } else if (businessGross >= 500000) {
    // 青色推奨
    ctas.push({
      key: 'aoiro',
      url: DATA.yayoi_cta.aoiro.url,
      label: DATA.yayoi_cta.aoiro.label,
      sub: DATA.yayoi_cta.aoiro.subtext
    });
  }

  // 開業届：副業モード or 売上が小さいときに併設
  if (input.mode === 'fukugyou' || businessGross < 1000000) {
    ctas.push({
      key: 'kigyou',
      url: DATA.yayoi_cta.kigyou.url,
      label: DATA.yayoi_cta.kigyou.label,
      sub: DATA.yayoi_cta.kigyou.subtext
    });
  }

  return ctas;
}

/* =========================================================
 * 12. UI入力取得
 * ======================================================== */
function getInputs() {
  const mode = document.querySelector('.mode-btn.active').dataset.mode;
  const industry = document.getElementById('industry').value;
  const revenueMan = parseFloat(document.getElementById('revenue').value) || 0;
  const expenseMan = parseFloat(document.getElementById('expense').value) || 0;
  const aiExpenseMan = parseFloat(document.getElementById('ai-expense').value) || 0;
  const municipality = document.getElementById('municipality').value;
  const filing = document.querySelector('input[name="filing"]:checked').value;

  // 副業
  const salaryIncomeMan = parseFloat(document.getElementById('salary-income').value) || 0;
  const spouseIncomeMan = parseFloat(document.getElementById('spouse-income').value) || 0;
  const dependents = parseInt(document.getElementById('dependents').value) || 0;
  const spouseShahoFuyo = document.getElementById('spouse-shaho-fuyo').checked;
  const jumin = (document.querySelector('input[name="jumin"]:checked') || {}).value || 'ordinary';

  // 専業
  const idecoMonth = parseFloat(document.getElementById('ideco-month').value) || 0;
  const kyosaiMonth = parseFloat(document.getElementById('kyosai-month').value) || 0;
  const kikinMonth = parseFloat(document.getElementById('kikin-month').value) || 0;
  const senjushaOn = document.getElementById('senjusha-on').checked;
  const senjushaMonthMan = parseFloat(document.getElementById('senjusha-month').value) || 0;
  const age40Plus = document.getElementById('age-over40').checked;

  return {
    mode, industry, revenueMan, expenseMan, aiExpenseMan, municipality, filing,
    salaryIncomeMan, spouseIncomeMan, dependents, spouseShahoFuyo, jumin,
    idecoMonth, kyosaiMonth, kikinMonth, senjushaOn, senjushaMonthMan, age40Plus
  };
}

/* =========================================================
 * 13. メイン計算→UI更新
 * ======================================================== */
function recompute() {
  if (!DATA) return;
  const input = getInputs();
  const result = input.mode === 'fukugyou' ? calcFukugyou(input) : calcSengyou(input);
  renderResultCard(result, input);
  renderPL(result, input);
  renderWarnings(result, input);
  renderYayoiCta(result, input);
  renderHoujinSection(result, input);
}

/* =========================================================
 * 14. UI描画：結果カード
 * ======================================================== */
function renderResultCard(res, input) {
  document.getElementById('total-take-home').textContent = fmtMan(res.takeHome) + ' 万円';
  document.getElementById('monthly-take-home').textContent = fmtMan(res.takeHome / 12);
  document.getElementById('business-income').textContent = fmtMan(res.businessIncome);

  const filingMap = {
    aoiro65: '青色65万控除',
    aoiro55: '青色55万控除',
    aoiro10: '青色10万控除',
    shiroiro: '白色申告'
  };
  document.getElementById('filing-label').textContent = filingMap[input.filing];
  if (input.mode === 'fukugyou') {
    document.getElementById('mode-label').textContent =
      `副業モード（給与${input.salaryIncomeMan}万＋事業${input.revenueMan}万）`;
    document.getElementById('result-label').textContent = '年間手取り（給与＋事業の合計）';
  } else {
    document.getElementById('mode-label').textContent =
      `専業モード（${input.municipality}・${input.age40Plus ? '40歳以上' : '40歳未満'}）`;
    document.getElementById('result-label').textContent = '年間手取り（事業所得ベース）';
  }
}

/* =========================================================
 * 15. UI描画：詳細P&L
 * ======================================================== */
function renderPL(res, input) {
  const $ = id => document.getElementById(id);
  const setMinus = (id, val) => {
    const el = $(id);
    if (!el) return;
    el.textContent = fmtMan(val);
    if (val > 0) el.classList.add('minus'); else el.classList.remove('minus');
  };

  $('pl-revenue').textContent = fmtMan(res.revenue);
  $('pl-expense').textContent = fmtMan(res.expense);
  $('pl-ai-expense').textContent = fmtMan(input.aiExpenseMan * MAN);
  $('pl-senjusha').textContent = fmtMan(res.senjusha || 0);
  $('pl-business-income').textContent = fmtMan(res.businessGross);
  $('pl-aoiro').textContent = fmtMan(res.aoiroApplied);
  $('pl-business-income-net').textContent = fmtMan(res.businessIncome);

  $('pl-salary-income').textContent = fmtMan(res.salaryIncome);
  $('pl-salary-deduction').textContent = fmtMan(res.salaryDeduction);
  $('pl-kokuho').textContent = fmtMan(res.kokuho);
  $('pl-nenkin').textContent = fmtMan(res.nenkin);
  $('pl-kyuyo-shaho').textContent = fmtMan(res.kyuyoShaho);
  $('pl-kyosai-deduction').textContent = fmtMan(res.kyosaiDeduction);
  $('pl-kiso').textContent = fmtMan(res.basicDed);
  $('pl-spouse-deduction').textContent = fmtMan(res.spouseDed);
  $('pl-taxable').textContent = fmtMan(res.taxableIncomeTax);
  $('pl-incometax').textContent = fmtMan(res.incomeTax);
  $('pl-reconst').textContent = fmtMan(res.reconstructionTax);
  $('pl-resident').textContent = fmtMan(res.resident.total);
  $('pl-total-tax').textContent = fmtMan(res.totalTax);
  $('pl-take-home').textContent = fmtMan(res.takeHome);
}

/* =========================================================
 * 16. UI描画：6つの壁
 * ======================================================== */
function renderWarnings(res, input) {
  const area = document.getElementById('warning-area');
  area.innerHTML = '';
  const walls = judgeWalls(res, input);
  for (const w of walls) {
    const div = document.createElement('div');
    div.className = `warning-item ${w.level}`;
    div.innerHTML = `<span class="wlabel">${w.label}</span><span>${w.text}</span>`;
    area.appendChild(div);
  }
}

/* =========================================================
 * 17. UI描画：弥生CTA
 * ======================================================== */
function renderYayoiCta(res, input) {
  const area = document.getElementById('yayoi-cta-area');
  area.innerHTML = '';
  const ctas = judgeYayoiCta(res, input);
  for (const c of ctas) {
    const a = document.createElement('a');
    a.className = 'yayoi-cta';
    a.href = c.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `
      <div class="cta-text">
        <div class="cta-label">${c.label}</div>
        <div class="cta-sub">${c.sub}</div>
      </div>
      <span class="cta-arrow">→</span>
    `;
    area.appendChild(a);
  }
}

/* =========================================================
 * 18. UI描画：法人成り推奨
 * ======================================================== */
function renderHoujinSection(res, input) {
  const sec = document.getElementById('houjin-section');
  const text = document.getElementById('houjin-text');
  const W = DATA.wall_thresholds.sengyou;
  const taxable = res.taxableIncomeTax;
  const revenue = res.revenue;

  const showByTaxable = taxable >= W.wall_houjin_600.yen;
  const showByRevenue = revenue >= W.wall_houjin_revenue_800.yen;

  if (showByTaxable || showByRevenue) {
    sec.classList.add('show');
    let reason = [];
    if (showByTaxable) reason.push(`課税所得${fmtMan(taxable)}万円（>600万）`);
    if (showByRevenue) reason.push(`年商${fmtMan(revenue)}万円（>800万）`);
    text.innerHTML = `
      <strong style="color:#0066FF;">${reason.join('・')}</strong>。
      法人化で年30〜80万円の節税が見込める可能性があります。
      役員報酬の3パターン比較・社保・消費税まで含めて法人版シミュレーターで詳細試算してください。
    `;
  } else {
    sec.classList.remove('show');
  }
}

/* =========================================================
 * 19. 業種選択時のデフォルト値自動入力
 * ======================================================== */
function applyIndustryDefaults() {
  const ind = document.getElementById('industry').value;
  const data = DATA.industries[ind];
  if (!data) return;
  document.getElementById('revenue').value = data.default_revenue;
  document.getElementById('revenue-slider').value = data.default_revenue;
  document.getElementById('expense').value = data.default_expense;
  document.getElementById('ai-expense').value = data.default_ai_expense;
  document.getElementById('industry-comment').textContent = data.comment;
}

/* =========================================================
 * 20. モード切替UI
 * ======================================================== */
function setupModeToggle() {
  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      // 副業/専業エリア表示切替
      document.querySelectorAll('.mode-fukugyou-only').forEach(el => {
        el.style.display = mode === 'fukugyou' ? '' : 'none';
      });
      document.querySelectorAll('.mode-sengyou-only').forEach(el => {
        el.style.display = mode === 'sengyou' ? '' : 'none';
      });
      // モードコメント
      const c = document.getElementById('mode-comment');
      if (c) {
        c.textContent = mode === 'fukugyou'
          ? '給与＋事業所得で副業6パターンを試算（給与400万モデル相当）'
          : '事業所得＋国保＋国民年金で専業6パターンを試算（東京23区）';
      }
      triggerRecompute();
    });
  });
}

/* =========================================================
 * 21. イベントハンドラ登録
 * ======================================================== */
function setupEvents() {
  document.getElementById('industry').addEventListener('change', () => {
    applyIndustryDefaults();
    triggerRecompute();
  });

  document.getElementById('revenue-slider').addEventListener('input', e => {
    document.getElementById('revenue').value = e.target.value;
    triggerRecompute();
  });
  document.getElementById('revenue').addEventListener('input', e => {
    document.getElementById('revenue-slider').value = e.target.value;
    triggerRecompute();
  });

  const numIds = ['expense', 'ai-expense', 'salary-income', 'spouse-income',
                  'dependents', 'ideco-month', 'kyosai-month', 'kikin-month',
                  'senjusha-month'];
  numIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', triggerRecompute);
  });

  document.getElementById('municipality').addEventListener('change', triggerRecompute);

  document.querySelectorAll('input[name="filing"], input[name="jumin"]').forEach(el => {
    el.addEventListener('change', triggerRecompute);
  });

  ['spouse-shaho-fuyo', 'age-over40'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', triggerRecompute);
  });

  // 専従者ON/OFFで月額入力を有効/無効化
  const senOn = document.getElementById('senjusha-on');
  const senMonth = document.getElementById('senjusha-month');
  senOn.addEventListener('change', () => {
    senMonth.disabled = !senOn.checked;
    triggerRecompute();
  });
}

function triggerRecompute() {
  if (DEBOUNCE_TIMER) clearTimeout(DEBOUNCE_TIMER);
  DEBOUNCE_TIMER = setTimeout(recompute, 150);
}

/* =========================================================
 * 22. 起動
 * ======================================================== */
async function init() {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
  } catch (e) {
    console.error('data.json の読み込みに失敗:', e);
    document.body.innerHTML = '<div style="padding:30px;font-family:sans-serif;color:#C62828;">'
      + '<h2>data.json を読み込めませんでした</h2>'
      + '<p>ローカルでブラウザのfetch制限に引っかかっています。次のいずれかで起動してください：</p>'
      + '<pre style="background:#F5F5F5;padding:12px;">cd 05_simulator\npython -m http.server 8000\n# → http://localhost:8000 を開く</pre>'
      + '</div>';
    return;
  }
  setupModeToggle();
  setupEvents();
  applyIndustryDefaults();
  recompute();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

// テスト用にエクスポート（Node.js環境のみ）
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
  globalThis.__SIMULATOR__ = {
    setData: (d) => { DATA = d; },
    calcFukugyou, calcSengyou,
    calcSalaryDeduction, calcIncomeTax, calcResidentTax, calcKokuho,
    getAoiroDeduction, calcSpouseDeduction
  };
}

})();
