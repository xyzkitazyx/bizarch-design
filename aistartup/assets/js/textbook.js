/* =========================================================
   /textbook/ ページ制御
   - 進捗バー（scrollY ratio）
   - TOC ハイライト（IntersectionObserver）
   - 既読状態 / 続きから読む（localStorage）
   - モバイル ボトムシートTOC + Back-to-top FAB
========================================================= */
(() => {
  const STORE_KEY = 'aistartup.textbook.progress.v1';

  const chapters = [...document.querySelectorAll('.tb-chapter')];
  const tocLinks = [...document.querySelectorAll('.tb-toc a, .toc-sheet a')];
  const progressFill = document.querySelector('.progress-bar-fill');
  const resumeBar = document.getElementById('resume-bar');
  const resumeLink = document.getElementById('resume-link');

  if (!chapters.length || !progressFill) return;

  // ---------- 1. Progress bar (scroll ratio) ----------
  const updateProgress = () => {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docH > 0 ? Math.min(1, window.scrollY / docH) : 0;
    progressFill.style.width = (ratio * 100).toFixed(1) + '%';
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);

  // ---------- 2. localStorage progress ----------
  const loadProgress = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { read: [], lastChapter: null, lastVisitedAt: null };
    } catch { return { read: [], lastChapter: null, lastVisitedAt: null }; }
  };
  const saveProgress = (p) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (_) {}
  };
  const progress = loadProgress();

  // 既読チェック表示
  const markReadInTOC = (id) => {
    document.querySelectorAll(`a[href="#${id}"]`).forEach(a => a.classList.add('is-read'));
  };
  progress.read.forEach(markReadInTOC);

  // 「続きから読む」表示（最後に到達した章があれば）
  if (progress.lastChapter && resumeBar && resumeLink) {
    const target = document.getElementById(progress.lastChapter);
    if (target) {
      const num = target.dataset.ch || progress.lastChapter.replace('ch-', '');
      const title = target.querySelector('h2')?.textContent.trim() || '';
      resumeLink.href = '#' + progress.lastChapter;
      resumeLink.textContent = `第${num}章「${title}」へ`;
      resumeBar.classList.add('is-visible');
    }
  }

  // ---------- 3. TOC active highlight (scroll-based) ----------
  const setActive = (id) => {
    tocLinks.forEach(a => {
      const isMatch = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-active', isMatch);
    });
  };

  let lastSavedAt = 0;
  const updateActiveChapter = () => {
    const refLine = window.scrollY + window.innerHeight * 0.35;
    let current = chapters[0];
    for (const c of chapters) {
      if (c.offsetTop <= refLine) current = c;
      else break;
    }
    const id = current.id;
    setActive(id);
    if (!progress.read.includes(id)) {
      progress.read.push(id);
      markReadInTOC(id);
    }
    progress.lastChapter = id;
    // 1秒間隔でサンプリング保存（書き込み連発を抑制）
    const now = Date.now();
    if (now - lastSavedAt > 1000) {
      progress.lastVisitedAt = new Date().toISOString();
      saveProgress(progress);
      lastSavedAt = now;
    }
  };
  // 初期実行 + scroll 連動
  updateActiveChapter();
  window.addEventListener('scroll', updateActiveChapter, { passive: true });
  window.addEventListener('resize', updateActiveChapter);

  // ---------- 4. Mobile bottom sheet TOC ----------
  const fab = document.querySelector('.toc-fab');
  const sheet = document.querySelector('.toc-sheet');
  const sheetOverlay = document.querySelector('.toc-sheet-overlay');
  const openSheet = () => {
    sheet?.classList.add('is-open');
    sheetOverlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const closeSheet = () => {
    sheet?.classList.remove('is-open');
    sheetOverlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  };
  fab?.addEventListener('click', openSheet);
  sheetOverlay?.addEventListener('click', closeSheet);
  sheet?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeSheet));

  // ---------- 5. Back-to-top FAB (PC) ----------
  const totop = document.querySelector('.totop-fab');
  if (totop) {
    window.addEventListener('scroll', () => {
      totop.classList.toggle('is-visible', window.scrollY > 600);
    }, { passive: true });
    totop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- 6. Resume bar dismiss ----------
  document.getElementById('resume-dismiss')?.addEventListener('click', () => {
    resumeBar?.classList.remove('is-visible');
  });
})();
