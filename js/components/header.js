import { KANJI_CATEGORIES } from '../data.js';

export function createHeader(container, callbacks) {
  container.innerHTML = `
    <div class="header-row header-row--brand">
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
          <span class="btn-pill-tag">かえる</span>
        </button>
        <button type="button" class="btn-pill btn-pill--dark" data-action="all-kanji">
          <span>📖</span>
          <span>漢字いちらん</span>
        </button>
      </div>
    </div>

    <div class="header-row header-row--tools">
      <div class="header-progress">
        <span class="header-progress-label">できた かず</span>
        <div class="header-progress-bar-row">
          <div class="header-progress-track">
            <div class="header-progress-fill"></div>
          </div>
          <span class="header-progress-count"></span>
        </div>
      </div>

      <div class="header-badges">
        <div class="combo-badge">
          <span class="combo-fire">🔥</span>
          <div>
            <span class="combo-number">0</span>
            <span class="combo-label">コンボ！</span>
          </div>
        </div>

        <button type="button" class="watermark-mini-toggle" data-action="watermark" title="なぞり書き・チャレンジの きりかえ">
          <span class="watermark-mini-toggle__emoji"></span>
          <span class="watermark-mini-toggle__label"></span>
        </button>

        <button type="button" class="test-mode-toggle" data-action="test-mode" title="テストモードのオン・オフ（オフにするには2秒長押し）">
          <span class="test-mode-toggle__icon">🧪</span>
          <span class="test-mode-toggle__label">テスト</span>
        </button>

        <button type="button" class="pen-mode-toggle" data-action="pen-mode" title="ペンモード（オンにするとタッチペンだけで書けます）">🖊️</button>

        <button type="button" class="sound-toggle" data-action="sound" title="音をオン・オフ"></button>
      </div>
    </div>
  `;

  const els = {
    catEmoji: container.querySelector('.cat-emoji'),
    catName: container.querySelector('.cat-name'),
    progressFill: container.querySelector('.header-progress-fill'),
    progressCount: container.querySelector('.header-progress-count'),
    comboNumber: container.querySelector('.combo-number'),
    soundToggle: container.querySelector('.sound-toggle'),
    testModeToggle: container.querySelector('.test-mode-toggle'),
    testModeLabel: container.querySelector('.test-mode-toggle__label'),
    watermarkToggle: container.querySelector('.watermark-mini-toggle'),
    watermarkEmoji: container.querySelector('.watermark-mini-toggle__emoji'),
    watermarkLabel: container.querySelector('.watermark-mini-toggle__label'),
    penModeToggle: container.querySelector('.pen-mode-toggle'),
  };

  container.querySelector('[data-action="category"]').addEventListener('click', () => callbacks.onOpenCategoryModal());
  container.querySelector('[data-action="all-kanji"]').addEventListener('click', () => callbacks.onOpenAllKanjiModal());
  els.soundToggle.addEventListener('click', () => callbacks.onToggleSound());
  els.watermarkToggle.addEventListener('click', () => callbacks.onToggleWatermark());
  els.penModeToggle.addEventListener('click', () => callbacks.onTogglePenMode());

  // Turning test mode ON is a normal tap. Turning it back OFF requires a
  // ~2s press-and-hold, so a child can't escape a test with one stray tap.
  const TEST_MODE_EXIT_HOLD_MS = 2000;
  let testModeHoldTimer = null;

  function cancelTestModeHold() {
    if (testModeHoldTimer) {
      clearTimeout(testModeHoldTimer);
      testModeHoldTimer = null;
    }
  }

  els.testModeToggle.addEventListener('pointerdown', () => {
    if (els.testModeToggle.classList.contains('is-on')) {
      cancelTestModeHold();
      testModeHoldTimer = setTimeout(() => {
        testModeHoldTimer = null;
        callbacks.onToggleTestMode();
      }, TEST_MODE_EXIT_HOLD_MS);
    } else {
      callbacks.onToggleTestMode();
    }
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) =>
    els.testModeToggle.addEventListener(evt, cancelTestModeHold)
  );

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

    els.testModeToggle.classList.toggle('is-on', state.isTestMode);
    els.testModeLabel.textContent = state.isTestMode ? 'テストちゅう' : 'テスト';

    // Hidden (not just disabled) during a test -- the test-mode badge
    // already explains why, so there's nothing useful left for it to show.
    els.watermarkToggle.disabled = state.isTestMode;
    els.watermarkToggle.classList.toggle('hidden', state.isTestMode);
    els.watermarkToggle.classList.toggle('on', state.isWatermarkOn);
    els.watermarkEmoji.textContent = state.isWatermarkOn ? '🥈' : '🥇';
    els.watermarkLabel.textContent = state.isWatermarkOn ? 'なぞり書き' : 'チャレンジ';

    els.penModeToggle.classList.toggle('is-on', state.isPenModeOn);
    els.penModeToggle.title = state.isPenModeOn
      ? 'ペンモード：オン（タッチペンだけで書けます）'
      : 'ペンモード（オンにするとタッチペンだけで書けます）';
  }

  return { update };
}
