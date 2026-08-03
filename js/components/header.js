import { KANJI_CATEGORIES } from '../data.js';

export function createHeader(container, callbacks) {
  container.innerHTML = `
    <div class="header-title-group">
      <div class="header-logo">漢</div>
      <h1 class="header-title">
        かん字マスター
        <span class="header-badge">小２</span>
      </h1>
    </div>

    <div class="header-center">
      <button type="button" class="btn-pill btn-pill--light" data-action="category">
        <span class="cat-emoji"></span>
        <span class="cat-name"></span>
        <span class="btn-pill-tag">変更</span>
      </button>
      <button type="button" class="btn-pill btn-pill--dark" data-action="all-kanji">
        <span>📖</span>
        <span>漢字いちらん</span>
      </button>
    </div>

    <div class="header-right">
      <div class="header-progress">
        <span class="header-progress-label">Progress</span>
        <div class="header-progress-bar-row">
          <div class="header-progress-track">
            <div class="header-progress-fill" style="width:0%"></div>
          </div>
          <span class="header-progress-count"></span>
        </div>
      </div>

      <div class="combo-badge">
        <span class="combo-fire">🔥</span>
        <div>
          <span class="combo-number">0</span>
          <span class="combo-label">コンボ！</span>
        </div>
      </div>

      <button type="button" class="sound-toggle" data-action="sound" title="音をオン・オフ"></button>
    </div>
  `;

  const els = {
    catEmoji: container.querySelector('.cat-emoji'),
    catName: container.querySelector('.cat-name'),
    progressFill: container.querySelector('.header-progress-fill'),
    progressCount: container.querySelector('.header-progress-count'),
    comboNumber: container.querySelector('.combo-number'),
    soundToggle: container.querySelector('.sound-toggle'),
  };

  container.querySelector('[data-action="category"]').addEventListener('click', () => callbacks.onOpenCategoryModal());
  container.querySelector('[data-action="all-kanji"]').addEventListener('click', () => callbacks.onOpenAllKanjiModal());
  els.soundToggle.addEventListener('click', () => callbacks.onToggleSound());

  function update(state) {
    const categoryInfo = KANJI_CATEGORIES.find((c) => c.id === state.currentCategory);
    els.catEmoji.textContent = categoryInfo?.emoji || '';
    els.catName.textContent = categoryInfo?.name || '';

    const progressPercent = state.totalKanji > 0 ? Math.min(100, Math.round((state.clearedCount / state.totalKanji) * 100)) : 0;
    els.progressFill.style.width = `${progressPercent}%`;
    els.progressCount.textContent = `${state.clearedCount}/${state.totalKanji}`;

    els.comboNumber.textContent = String(state.combo);

    els.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
    els.soundToggle.classList.toggle('is-off', !state.soundEnabled);
  }

  return { update };
}
