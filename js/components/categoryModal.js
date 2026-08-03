import { KANJI_CATEGORIES } from '../data.js';

export function createCategoryModal(overlayEl, callbacks) {
  overlayEl.innerHTML = `
    <div class="modal-box modal-box--md">
      <div class="modal-header">
        <div class="modal-header__title-row">
          <span class="modal-header__emoji">🎒</span>
          <h2 class="modal-header__title">漢字のテーマをえらぼう！</h2>
        </div>
        <button type="button" class="modal-close" data-action="close">✕</button>
      </div>
      <div class="category-list"></div>
      <div class="modal-footer">
        <button type="button" class="btn-navy" data-action="close">とじる</button>
      </div>
    </div>
  `;

  const listEl = overlayEl.querySelector('.category-list');

  overlayEl.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onClose());
  });

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.category-card');
    if (card) {
      callbacks.onSelectCategory(card.dataset.id);
      callbacks.onClose();
    }
  });

  function update(state) {
    overlayEl.classList.toggle('hidden', !state.isOpen);
    if (!state.isOpen) return;

    listEl.innerHTML = KANJI_CATEGORIES.map((cat) => {
      const isSelected = cat.id === state.currentCategory;
      return `
        <button type="button" class="category-card ${isSelected ? 'is-selected' : ''}" data-id="${cat.id}">
          <div class="category-card__emoji">${cat.emoji}</div>
          <div>
            <div class="category-card__name">${cat.name}</div>
            <div class="category-card__desc">${cat.description}</div>
          </div>
        </button>
      `;
    }).join('');
  }

  return { update };
}
