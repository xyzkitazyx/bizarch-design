/* =========================================================
   Header / Announce Bar / Mobile Drawer 制御
========================================================= */
(() => {
  // --- Hamburger toggle ---
  const hamburger = document.querySelector('.hamburger');
  const drawer = document.querySelector('.nav-mobile');
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('is-open');
      drawer.classList.toggle('is-open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    // ドロワー内のリンクをクリックしたら閉じる
    drawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('is-open');
        drawer.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Announce bar dismiss (localStorage 記憶) ---
  const ANN_KEY = 'aistartup.announce.v1.dismissed';
  const announce = document.querySelector('.announce-bar');
  const annClose = document.querySelector('.announce-close');
  if (announce && localStorage.getItem(ANN_KEY) === '1') {
    announce.classList.add('is-hidden');
    document.documentElement.classList.add('announce-hidden');
  }
  if (annClose) {
    annClose.addEventListener('click', () => {
      announce.classList.add('is-hidden');
      document.documentElement.classList.add('announce-hidden');
      localStorage.setItem(ANN_KEY, '1');
    });
  }

  // --- Active nav highlight (path判定) ---
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('[data-nav-path]').forEach(el => {
    const target = el.dataset.navPath.replace(/\/$/, '') || '/';
    if (target === path || (target !== '/' && path.startsWith(target))) {
      el.classList.add('is-active');
    }
  });
})();
