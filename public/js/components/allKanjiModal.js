import { KANJI_CATEGORIES } from '../data.js';

export function createAllKanjiModal(overlayEl, callbacks) {
  let searchTerm = '';
  let selectedCatFilter = 'all';
  let allKanjiList = [];
  let progressMap = {};

  overlayEl.innerHTML = `
    <div class="modal-box modal-box--lg">
      <div class="modal-header">
        <div>
          <div class="modal-header__title-row">
            <span class="modal-header__emoji">📖</span>
            <h2 class="modal-header__title">かん字・ひらがな・カタカナ いちらん</h2>
          </div>
          <div class="modal-header__stats">
            <span class="gold-count"></span>
            <span class="silver-count"></span>
          </div>
        </div>
        <button type="button" class="modal-close" data-action="close">✕</button>
      </div>

      <div class="modal-filters">
        <input type="text" class="modal-search-input" placeholder="漢字や読みでさがす (例: うみ, カイ, 海)..." />
        <select class="modal-select">
          <option value="all">すべてのテーマ</option>
          ${KANJI_CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="all-kanji-grid"></div>

      <div class="modal-footer modal-footer--between">
        <div>タッチすると、その漢字の練習に移動できます。</div>
        <button type="button" class="btn-navy" data-action="close">とじる</button>
      </div>
    </div>
  `;

  const els = {
    goldCount: overlayEl.querySelector('.gold-count'),
    silverCount: overlayEl.querySelector('.silver-count'),
    searchInput: overlayEl.querySelector('.modal-search-input'),
    catSelect: overlayEl.querySelector('.modal-select'),
    grid: overlayEl.querySelector('.all-kanji-grid'),
  };

  overlayEl.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onClose());
  });

  els.searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderGrid();
  });

  els.catSelect.addEventListener('change', (e) => {
    selectedCatFilter = e.target.value;
    renderGrid();
  });

  els.grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.all-kanji-tile');
    if (tile) {
      callbacks.onSelectKanji(tile.dataset.id);
      callbacks.onClose();
    }
  });

  function renderGrid() {
    const filtered = allKanjiList.filter((k) => {
      const matchesSearch =
        !searchTerm ||
        k.character.includes(searchTerm) ||
        k.readings.onyomi.some((o) => o.includes(searchTerm)) ||
        k.readings.kunyomi.some((ku) => ku.includes(searchTerm)) ||
        k.meaning.includes(searchTerm);
      const matchesCat = selectedCatFilter === 'all' || k.category === selectedCatFilter;
      return matchesSearch && matchesCat;
    });

    const goldCount = Object.values(progressMap).filter((p) => p.clearGrade === 'gold').length;
    const silverCount = Object.values(progressMap).filter((p) => p.clearGrade === 'silver').length;
    els.goldCount.textContent = `🥇 金メダル(透かし無し): ${goldCount}字`;
    els.silverCount.textContent = `🥈 銀メダル(透かしアリ): ${silverCount}字`;

    if (filtered.length === 0) {
      els.grid.innerHTML = '<div class="all-kanji-empty">みつかりませんでした</div>';
      return;
    }

    els.grid.innerHTML = filtered
      .map((item) => {
        const progress = progressMap[item.id];
        const clearGrade = progress?.clearGrade || 'none';
        const classes = ['all-kanji-tile'];
        if (clearGrade === 'gold') classes.push('is-gold');
        else if (clearGrade === 'silver') classes.push('is-silver');

        let stamp = '';
        if (clearGrade === 'gold') stamp = '<span class="all-kanji-tile__stamp gold">金</span>';
        else if (clearGrade === 'silver') stamp = '<span class="all-kanji-tile__stamp silver">銀</span>';

        const title = `${item.character}: ${item.readings.kunyomi[0] || item.readings.onyomi[0] || ''}`;
        return `<button type="button" class="${classes.join(' ')}" data-id="${item.id}" title="${title}"><span>${item.character}</span>${stamp}</button>`;
      })
      .join('');
  }

  function update(state) {
    overlayEl.classList.toggle('hidden', !state.isOpen);
    if (!state.isOpen) return;
    allKanjiList = state.allKanjiList;
    progressMap = state.progressMap;
    renderGrid();
  }

  return { update };
}
