export function createFooter(container) {
  container.innerHTML = `
    <div class="footer-status">
      <div class="footer-status__dot"></div>
      <span class="footer-status__text"></span>
    </div>
    <a
      class="footer-credit"
      href="https://github.com/KanjiVG/kanjivg"
      target="_blank"
      rel="noopener noreferrer"
      title="書き順データはKanjiVGを参考に作成しています（CC BY-SA 3.0）"
    >書き順データ: KanjiVG (CC BY-SA 3.0)</a>
    <div class="footer-progress-text"></div>
  `;

  const els = {
    statusText: container.querySelector('.footer-status__text'),
    progressText: container.querySelector('.footer-progress-text'),
  };

  function update(state) {
    els.statusText.textContent = `Touch / Stylus Active: ${state.isWatermarkOn ? 'なぞり書きモード (銀)' : 'チャレンジモード (金)'}`;
    els.progressText.textContent = `テーマ: ${state.categoryName} (${state.indexInCategory}/${state.totalInCategory})`;
  }

  return { update };
}
