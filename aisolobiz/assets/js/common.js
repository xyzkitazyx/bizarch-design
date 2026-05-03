/* =========================================================
   AIで一人個人事業の教科書 サイト共通JS
   - ハンバーガーメニュー
   - スムーススクロール
   - ヘッダーのスクロール検知（縮小・影）
   - ヒーロー画像のフェードイン
   - 即試算ウィジェット（軽量・所得税概算）
========================================================= */
(function () {
  "use strict";

  /* ----- ヘッダーのスクロール検知 ----- */
  var header = document.querySelector(".site-header");
  if (header) {
    var lastScrolled = false;
    function onScroll() {
      var scrolled = window.scrollY > 8;
      if (scrolled !== lastScrolled) {
        header.classList.toggle("is-scrolled", scrolled);
        lastScrolled = scrolled;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ----- ハンバーガーメニュー ----- */
  var navToggle = document.querySelector(".nav-toggle");
  var globalNav = document.querySelector(".global-nav");
  if (navToggle && globalNav) {
    navToggle.addEventListener("click", function () {
      var open = globalNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // メニュー内リンククリックで閉じる（モバイル）
    globalNav.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.tagName === "A" && globalNav.classList.contains("is-open")) {
        globalNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
    // Escでクローズ
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && globalNav.classList.contains("is-open")) {
        globalNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ----- スムーススクロール（ハッシュアンカー） ----- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href === "#" || href.length < 2) return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    var y = target.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", href);
  });

  /* ----- ヒーロー画像のフェードイン ----- */
  var heroImg = document.querySelector("[data-hero-image]");
  if (heroImg) {
    var reveal = function () { heroImg.classList.add("is-loaded"); };
    if (heroImg.complete && heroImg.naturalWidth > 0) {
      reveal();
    } else {
      heroImg.addEventListener("load", reveal, { once: true });
      heroImg.addEventListener("error", reveal, { once: true });
    }
  }

  /* ----- IntersectionObserverで .reveal をフェードイン ----- */
  var reveals = document.querySelectorAll("[data-reveal]");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    // fallback
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* =========================================================
     即試算ウィジェット（軽量版・所得税＋住民税の概算）
     ========================================================= */
  // 所得税：累進（復興特別2.1%含めて簡易表現）
  function incomeTax(taxable) {
    if (taxable <= 0) return 0;
    var t = 0;
    if (taxable <= 1_950_000)         t = taxable * 0.05;
    else if (taxable <= 3_300_000)    t = taxable * 0.10 -    97_500;
    else if (taxable <= 6_950_000)    t = taxable * 0.20 -   427_500;
    else if (taxable <= 9_000_000)    t = taxable * 0.23 -   636_000;
    else if (taxable <= 18_000_000)   t = taxable * 0.33 - 1_536_000;
    else if (taxable <= 40_000_000)   t = taxable * 0.40 - 2_796_000;
    else                              t = taxable * 0.45 - 4_796_000;
    return Math.max(0, t * 1.021); // 復興特別所得税2.1%
  }
  function residentTax(taxable) {
    if (taxable <= 0) return 0;
    return taxable * 0.10 + 5000; // 住民税10%＋均等割5,000円（概算）
  }
  // 給与所得控除（概算）
  function salaryDeduction(salary) {
    if (salary <= 0) return 0;
    if (salary <= 1_625_000) return 550_000;
    if (salary <= 1_800_000) return salary * 0.40 -  100_000;
    if (salary <= 3_600_000) return salary * 0.30 +   80_000;
    if (salary <= 6_600_000) return salary * 0.20 +  440_000;
    if (salary <= 8_500_000) return salary * 0.10 + 1_100_000;
    return 1_950_000;
  }
  function fmtMan(yen) {
    var man = Math.round(yen / 1_000) / 10;
    return man.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  }
  function fmtMan0(yen) {
    return Math.round(yen / 10_000).toLocaleString("ja-JP");
  }

  var widget = document.querySelector("[data-quick-sim]");
  if (widget) {
    var modeBtns = widget.querySelectorAll("[data-mode]");
    var inRevenue = widget.querySelector('[data-input="revenue"]');
    var inExpense = widget.querySelector('[data-input="expense"]');
    var inSalary  = widget.querySelector('[data-input="salary"]');
    var rowSalary = widget.querySelector("[data-row-salary]");

    var outBiz       = widget.querySelector('[data-out="biz-income"]');
    var outTaxable   = widget.querySelector('[data-out="taxable"]');
    var outIncomeTax = widget.querySelector('[data-out="income-tax"]');
    var outResident  = widget.querySelector('[data-out="resident-tax"]');
    var outNet       = widget.querySelector('[data-out="net"]');
    var outTotalTax  = widget.querySelector('[data-out="total-tax"]');
    var outNote      = widget.querySelector('[data-out="note"]');

    var mode = "solo"; // 'solo' = 専業 / 'side' = 副業

    function setMode(m) {
      mode = m;
      modeBtns.forEach(function (b) {
        var on = b.getAttribute("data-mode") === m;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (rowSalary) rowSalary.style.display = (m === "side") ? "" : "none";
      compute();
    }

    function num(el) {
      var v = parseFloat((el && el.value) || "0");
      return isNaN(v) ? 0 : v * 10_000; // 入力は万円→円に換算
    }

    function compute() {
      var revenue = num(inRevenue);
      var expense = num(inExpense);
      var bizIncome = Math.max(0, revenue - expense);

      // 控除：青色65万＋基礎48万
      var blue = 650_000;
      var basic = 480_000;

      // 専業：国保（所得割13.7%＋均等割66,000円・上限109万）＋国民年金 約21万
      // 副業：給与の社保は本業で支払い済として、副業所得は単純加算（簡易計算）
      var socialIns = 0;
      var taxable = 0;
      var note = "";

      if (mode === "solo") {
        // 国保所得（おおむね事業所得から33万を引いた額×13.7% + 66,000）。簡易：bizIncome * 0.137 + 66,000
        var kokuho = Math.min(bizIncome * 0.137 + 66_000, 1_090_000);
        var nenkin = 210_000;
        socialIns = Math.max(0, kokuho + nenkin);
        taxable = Math.max(0, bizIncome - blue - socialIns - basic);
        note = "専業：青色65万＋国保（概算）＋国民年金21万＋基礎48万を控除";
      } else {
        // 副業：給与所得（控除後）と事業所得を合算
        var salary = num(inSalary);
        var sDed = salaryDeduction(salary);
        var salaryIncome = Math.max(0, salary - sDed);
        // 給与の社保は本業負担として、副業の控除は青色65万＋基礎48万
        var combined = salaryIncome + Math.max(0, bizIncome - blue);
        taxable = Math.max(0, combined - basic);
        note = "副業：給与所得（控除後）＋事業所得（青色65万後）−基礎48万";
      }

      var ix = incomeTax(taxable);
      var rx = residentTax(taxable);
      var totalTax = ix + rx;
      var net;
      if (mode === "solo") {
        net = Math.max(0, bizIncome - socialIns - totalTax);
      } else {
        // 副業の手取り増 ≒ 事業所得 − 事業に対する追加税負担
        // 簡易：bizIncome − (totalTax の事業所得相当分)。ここでは副業による「追加負担」を概算。
        // 給与のみの場合の課税所得（ベース）と比較して差分税で算出
        var sal = num(inSalary);
        var sDed2 = salaryDeduction(sal);
        var baseTaxable = Math.max(0, sal - sDed2 - basic);
        var baseTax = incomeTax(baseTaxable) + residentTax(baseTaxable);
        var addTax = Math.max(0, totalTax - baseTax);
        net = Math.max(0, bizIncome - addTax);
        // 表示も差分に書き換え
        ix = Math.max(0, ix - incomeTax(baseTaxable));
        rx = Math.max(0, rx - residentTax(baseTaxable));
        totalTax = ix + rx;
      }

      if (outBiz)       outBiz.textContent       = fmtMan0(bizIncome);
      if (outTaxable)   outTaxable.textContent   = fmtMan0(taxable);
      if (outIncomeTax) outIncomeTax.textContent = fmtMan(ix);
      if (outResident)  outResident.textContent  = fmtMan(rx);
      if (outTotalTax)  outTotalTax.textContent  = fmtMan(totalTax);
      if (outNet)       outNet.textContent       = fmtMan0(net);
      if (outNote)      outNote.textContent      = note;
    }

    modeBtns.forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
    });
    [inRevenue, inExpense, inSalary].forEach(function (el) {
      if (el) el.addEventListener("input", compute);
    });

    setMode("solo");
  }

  /* ----- フッター年号 ----- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
