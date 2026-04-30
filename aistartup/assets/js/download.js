/* =========================================================
   /download/ ページ制御
   - DLボタンクリック → 確認モーダル表示
   - モーダル内DLボタン → 実DLトリガー + サンクスstateへ切り替え
   - localStorage に DL履歴記録
========================================================= */
(() => {
  const PDF_URL = '/assets/ai-solo-startup-textbook_v1.pdf';
  const PDF_FILENAME = 'ai-solo-startup-textbook_v1.pdf';
  const DL_KEY = 'aistartup.textbook.dl.v1';

  const openBtn = document.getElementById('open-dl-modal');
  const overlay = document.getElementById('dl-modal');
  const cancelBtn = document.getElementById('dl-cancel');
  const confirmBtn = document.getElementById('dl-confirm');
  const stateInitial = document.getElementById('dl-state-initial');
  const stateThanks = document.getElementById('dl-state-thanks');

  if (!openBtn || !overlay) return;

  const openModal = () => {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    confirmBtn?.focus();
  };
  const closeModal = () => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    openBtn.focus();
  };

  openBtn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  confirmBtn?.addEventListener('click', () => {
    // 実DL（aタグclickをプログラム的に）
    const a = document.createElement('a');
    a.href = PDF_URL;
    a.download = PDF_FILENAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // localStorage 記録
    try {
      localStorage.setItem(DL_KEY, JSON.stringify({
        downloadedAt: new Date().toISOString(),
        version: 'v1',
      }));
    } catch (_) { /* ignore */ }

    // モーダル閉じてサンクスstateへ
    closeModal();
    if (stateInitial && stateThanks) {
      stateInitial.classList.remove('is-active');
      stateThanks.classList.add('is-active');
      // スムーズに上へスクロール
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // 既にDL済みなら、DLボタン横に小さくチェック表示（任意の体験向上）
  try {
    const prev = localStorage.getItem(DL_KEY);
    if (prev) {
      const note = document.getElementById('dl-prior-note');
      if (note) note.style.display = 'block';
    }
  } catch (_) { /* ignore */ }
})();
