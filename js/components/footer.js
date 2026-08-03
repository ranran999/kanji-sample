export function createFooter(container) {
  container.innerHTML = `
    <div class="footer-status">
      <div class="footer-status__dot"></div>
      <span class="footer-status__text"></span>
    </div>
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
