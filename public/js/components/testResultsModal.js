export function createTestResultsModal(overlayEl, callbacks) {
  overlayEl.innerHTML = `
    <div class="modal-box modal-box--lg">
      <div class="modal-header">
        <div class="modal-header__title-row">
          <span class="modal-header__emoji">📋</span>
          <h2 class="modal-header__title">テストのけっか</h2>
        </div>
        <button type="button" class="modal-close" data-action="close">✕</button>
      </div>

      <div class="test-results-grid"></div>

      <div class="modal-footer">
        <button type="button" class="btn-navy" data-action="close">とじる</button>
      </div>
    </div>
  `;

  const els = {
    grid: overlayEl.querySelector('.test-results-grid'),
  };

  overlayEl.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onClose());
  });

  function update(state) {
    overlayEl.classList.toggle('hidden', !state.isOpen);
    if (!state.isOpen) return;

    if (state.snapshots.length === 0) {
      els.grid.innerHTML = '<div class="all-kanji-empty">まだ かいた かん字が ありません</div>';
      return;
    }

    els.grid.innerHTML = state.snapshots
      .map((snap) => {
        const isCorrect = snap.outcome === 'correct';
        const badgeClass = isCorrect ? 'correct' : 'fail';
        const badgeText = isCorrect ? '⭕ せいかい' : '✗ ふせいかい';
        return `
          <div class="test-result-card ${badgeClass}">
            <img class="test-result-card__img" src="${snap.imageDataUrl}" alt="${snap.character}" />
            <div class="test-result-card__footer">
              <span class="test-result-card__char">${snap.character}</span>
              <span class="test-result-card__badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  return { update };
}
