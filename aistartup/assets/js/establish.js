/* =========================================================
   /establish/ ページの「現在地カード」制御
   - localStorage から教科書進捗・PDF DL履歴を読んで
     ユーザーの状態に合わせた次の一手を提示
========================================================= */
(() => {
  const card = document.getElementById('location-card');
  const text = document.getElementById('location-text');
  if (!card || !text) return;

  const safeParse = (k) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); }
    catch { return null; }
  };

  const textbookProg = safeParse('aistartup.textbook.progress.v1');
  const dlProg       = safeParse('aistartup.textbook.dl.v1');

  const readCount = textbookProg?.read?.length || 0;
  const lastChapter = textbookProg?.lastChapter || null;
  const dlAt = dlProg?.downloadedAt ? new Date(dlProg.downloadedAt) : null;

  // ステートが何もない → デフォルト表示のまま
  if (readCount === 0 && !dlAt) return;

  const facts = [];
  if (readCount > 0) {
    facts.push(`📖 <strong>教科書</strong> ${readCount}/13章読了`);
  }
  if (dlAt) {
    const d = `${dlAt.getFullYear()}/${dlAt.getMonth()+1}/${dlAt.getDate()}`;
    facts.push(`⬇ <strong>PDF</strong> ダウンロード済み（${d}）`);
  }

  // 次の一手の判定
  let nextStep = '';
  if (readCount >= 12) {
    nextStep = '次の一手：<strong>このページの STEP 1 から会社設立を進める</strong>';
  } else if (readCount >= 6) {
    nextStep = '次の一手：<strong>第7章「AIツール早見表」以降を読む</strong>か、設立準備を始める';
  } else if (readCount > 0) {
    nextStep = `次の一手：<strong>教科書の続きから読む</strong>（前回：${lastChapter ? lastChapter.replace('ch-', '第') + '章' : '途中'}）`;
  } else if (dlAt) {
    nextStep = '次の一手：<strong>PDFを読みつつ、設立準備の5項目を決める</strong>';
  }

  card.classList.remove('is-default');
  text.innerHTML = facts.join('<br>') + (nextStep ? `<br><br>${nextStep}` : '');
})();
