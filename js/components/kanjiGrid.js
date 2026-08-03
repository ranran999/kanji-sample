export function createKanjiGrid(container, callbacks) {
  container.innerHTML = `
    <div class="category-mobile-bar">
      <span class="category-mobile-bar__name"></span>
      <button type="button" class="category-mobile-bar__btn" data-action="category">テーマをかえる</button>
    </div>

    <div class="card kanji-grid-card">
      <div class="kanji-grid-card__header">
        <h2 class="kanji-grid-card__title">きょうの かん字</h2>
        <span class="kanji-grid-card__subtitle"></span>
      </div>
      <div class="kanji-grid"></div>
    </div>

    <div class="stars-card">
      <p class="stars-card__label">TOTAL STARS</p>
      <div class="stars-card__value-row">
        <span class="stars-card__icon">⭐</span>
        <span class="stars-card__value">0</span>
      </div>
    </div>
  `;

  const els = {
    mobileBarName: container.querySelector('.category-mobile-bar__name'),
    subtitle: container.querySelector('.kanji-grid-card__subtitle'),
    grid: container.querySelector('.kanji-grid'),
    starsValue: container.querySelector('.stars-card__value'),
  };

  container.querySelector('[data-action="category"]').addEventListener('click', () => callbacks.onOpenCategoryModal());

  els.grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.kanji-tile');
    if (tile) callbacks.onSelectKanji(tile.dataset.id);
  });

  function update(state) {
    els.mobileBarName.textContent = `テーマ: ${state.categoryName}`;
    els.subtitle.textContent = state.categoryName;
    els.starsValue.textContent = state.totalStars.toLocaleString();

    els.grid.innerHTML = state.kanjiList
      .map((item) => {
        const progress = state.progressMap[item.id];
        const clearGrade = progress?.clearGrade || 'none';
        const isSelected = item.id === state.currentKanjiId;

        const classes = ['kanji-tile'];
        if (isSelected) classes.push('is-selected');
        else if (clearGrade === 'gold') classes.push('is-gold');
        else if (clearGrade === 'silver') classes.push('is-silver');

        let stamp = '';
        if (!isSelected && clearGrade === 'gold') stamp = '<span class="kanji-tile__stamp gold">金</span>';
        else if (!isSelected && clearGrade === 'silver') stamp = '<span class="kanji-tile__stamp silver">銀</span>';

        return `<div class="${classes.join(' ')}" data-id="${item.id}"><span>${item.character}</span>${stamp}</div>`;
      })
      .join('');
  }

  return { update };
}
