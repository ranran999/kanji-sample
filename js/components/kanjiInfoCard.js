import { maskAnswerInText } from '../kanjiText.js';

export function createKanjiInfoCard(container, callbacks) {
  container.innerHTML = `
    <div class="readings-card">
      <span class="readings-card__label">おんよみ / くんよみ</span>
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

      <button type="button" class="watermark-toggle" data-action="watermark">
        <div class="watermark-toggle__left">
          <span class="watermark-toggle__emoji"></span>
          <div>
            <div class="watermark-toggle__label"></div>
            <div class="watermark-toggle__grade"></div>
          </div>
        </div>
        <span class="watermark-toggle__switch">切替</span>
      </button>

      <button type="button" class="btn-next" data-action="next">
        <span class="btn-next__text">NEXT!</span>
        <span class="btn-next__icon">👉</span>
      </button>
    </div>
  `;

  const els = {
    onyomi: container.querySelector('.readings-card__onyomi'),
    kunyomi: container.querySelector('.readings-card__kunyomi'),
    meaning: container.querySelector('.readings-card__meaning'),
    example: container.querySelector('.readings-card__example'),
    demoBtn: container.querySelector('[data-action="demo"]'),
    demoLabel: container.querySelector('.demo-label'),
    watermarkBtn: container.querySelector('[data-action="watermark"]'),
    watermarkEmoji: container.querySelector('.watermark-toggle__emoji'),
    watermarkLabel: container.querySelector('.watermark-toggle__label'),
    watermarkGrade: container.querySelector('.watermark-toggle__grade'),
  };

  els.demoBtn.addEventListener('click', () => callbacks.onPlayDemo());
  container.querySelector('[data-action="clear"]').addEventListener('click', () => callbacks.onClearCanvas());
  els.watermarkBtn.addEventListener('click', () => callbacks.onToggleWatermark());
  container.querySelector('[data-action="next"]').addEventListener('click', () => callbacks.onNextKanji());

  function update(state) {
    const kanji = state.kanji;
    els.onyomi.textContent = kanji.readings.onyomi.length > 0 ? kanji.readings.onyomi.join(' ・ ') : 'なし';
    els.kunyomi.textContent = kanji.readings.kunyomi.length > 0 ? kanji.readings.kunyomi.join(' ・ ') : 'なし';
    els.meaning.textContent = maskAnswerInText(kanji.meaning, kanji);
    els.example.textContent =
      kanji.examples.length > 0 ? `「${maskAnswerInText(kanji.examples[0].sentence, kanji)}」` : '';
    els.example.style.display = kanji.examples.length > 0 ? '' : 'none';

    els.demoBtn.disabled = state.isDemoPlaying;
    els.demoLabel.textContent = state.isDemoPlaying ? 'さいせい中' : 'みほん';

    els.watermarkBtn.classList.toggle('off', !state.isWatermarkOn);
    els.watermarkBtn.classList.toggle('on', state.isWatermarkOn);
    els.watermarkEmoji.textContent = state.isWatermarkOn ? '🥈' : '🥇';
    els.watermarkLabel.textContent = state.isWatermarkOn ? 'なぞり書きモード' : 'チャレンジモード';
    els.watermarkGrade.textContent = state.isWatermarkOn ? '透かしアリ (銀)' : '透かし無し (金)';
  }

  return { update };
}
