import { maskAnswerInText, maskAnswerInHtml } from '../kanjiText.js';

export function createKanjiInfoCard(container, callbacks) {
  container.innerHTML = `
    <div class="readings-card">
      <span class="readings-card__label"></span>
      <div class="readings-card__readings">
        <div class="readings-card__onyomi"></div>
        <div class="readings-card__divider"></div>
        <div class="readings-card__kunyomi"></div>
      </div>
      <div class="readings-card__meaning-block">
        <p class="readings-card__meaning"></p>
        <div class="readings-card__example"></div>
      </div>
    </div>

    <div class="action-stack">
      <div class="action-stack__row">
        <button type="button" class="btn-3d btn-3d--teal" data-action="demo">
          <span class="btn-3d__icon">👀</span>
          <span class="demo-label">みほん</span>
        </button>
        <button type="button" class="btn-3d btn-3d--outline-red" data-action="clear">
          <span class="btn-3d__icon">🗑️</span>
          <span>けす</span>
        </button>
      </div>

      <button type="button" class="btn-next" data-action="next">
        <span class="btn-next__text">次へ</span>
        <span class="btn-next__icon">👉</span>
      </button>
    </div>
  `;

  const els = {
    label: container.querySelector('.readings-card__label'),
    onyomi: container.querySelector('.readings-card__onyomi'),
    divider: container.querySelector('.readings-card__divider'),
    kunyomi: container.querySelector('.readings-card__kunyomi'),
    meaning: container.querySelector('.readings-card__meaning'),
    example: container.querySelector('.readings-card__example'),
    demoBtn: container.querySelector('[data-action="demo"]'),
    demoLabel: container.querySelector('.demo-label'),
  };

  els.demoBtn.addEventListener('click', () => callbacks.onPlayDemo());
  container.querySelector('[data-action="clear"]').addEventListener('click', () => callbacks.onClearCanvas());
  container.querySelector('[data-action="next"]').addEventListener('click', () => callbacks.onNextKanji());

  function update(state) {
    const kanji = state.kanji;
    // Hiragana/katakana don't have on'yomi/kun'yomi -- that split is a
    // kanji-specific linguistic distinction, so showing it for kana would
    // be flatly wrong. Show a single reading instead.
    const isKana = kanji.category === 'hiragana' || kanji.category === 'katakana';
    els.label.textContent = isKana ? 'よみ方（ローマ字）' : 'おんよみ / くんよみ';
    els.onyomi.classList.toggle('hidden', isKana);
    els.divider.classList.toggle('hidden', isKana);
    if (isKana) {
      els.kunyomi.textContent = kanji.readings.kunyomi[0] || kanji.readings.onyomi[0] || '';
    } else {
      els.onyomi.textContent = kanji.readings.onyomi.length > 0 ? kanji.readings.onyomi.join(' ・ ') : 'なし';
      els.kunyomi.textContent = kanji.readings.kunyomi.length > 0 ? kanji.readings.kunyomi.join(' ・ ') : 'なし';
    }
    els.meaning.textContent = maskAnswerInText(kanji.meaning, kanji);
    els.example.innerHTML =
      kanji.examples.length > 0 ? `「${maskAnswerInHtml(kanji.examples[0].sentence, kanji)}」` : '';
    els.example.style.display = kanji.examples.length > 0 ? '' : 'none';

    els.demoBtn.disabled = state.isDemoPlaying || state.isTestMode;
    els.demoLabel.textContent = state.isDemoPlaying ? 'さいせい中' : 'みほん';
  }

  return { update };
}
