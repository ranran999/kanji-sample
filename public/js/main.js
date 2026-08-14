import { KANJI_DATA, KANJI_CATEGORIES } from './data.js';
import { soundManager } from './soundManager.js';
import { DrawingCanvas } from './drawingCanvas.js';
import { Confetti } from './confetti.js';
import { createHeader } from './components/header.js';
import { createKanjiGrid } from './components/kanjiGrid.js';
import { createKanjiInfoCard } from './components/kanjiInfoCard.js';
import { createFooter } from './components/footer.js';
import { createCategoryModal } from './components/categoryModal.js';
import { createAllKanjiModal } from './components/allKanjiModal.js';
import { createTestResultsModal } from './components/testResultsModal.js';
import { createToast } from './components/toast.js';
import { installIphoneGuards } from './iphoneGuards.js';

function getCategoryIdFromHash() {
  const hash = decodeURIComponent(location.hash.slice(1));
  return KANJI_CATEGORIES.some((c) => c.id === hash) ? hash : null;
}

// Wrong strokes on the same kanji allowed in test mode before it's locked
// in as バツ (wrong) -- a countermeasure against just scribbling random
// strokes over and over until one happens to pass by luck.
const TEST_MAX_MISTAKES = 5;

const initialCategory = getCategoryIdFromHash() || 'nature';
const initialKanji = KANJI_DATA.find((k) => k.category === initialCategory);

const state = {
  currentCategory: initialCategory,
  currentKanjiId: initialKanji ? initialKanji.id : 'umi',
  isWatermarkOn: false,
  isTestMode: false,
  isPenModeOn: false,
  isDemoPlaying: false,
  clearTrigger: 0,
  combo: 0,
  maxCombo: 0,
  soundEnabled: true,
  // Not persisted -- each reload starts with a clean slate of gold/silver
  // medals, so the app can be reused for a fresh test without old results
  // lingering.
  progressMap: {},
  // Test-session-only: how many wrong strokes each kanji has had so far,
  // and which kanji have hit the limit and are locked as バツ. Both reset
  // whenever test mode is freshly turned on (a new test run), and are
  // deliberately untouched by the "けす" (clear canvas) button so it can't
  // be used to reset the mistake count and keep guessing.
  testMistakeCounts: {},
  testFailedKanjiIds: {},
  isCategoryModalOpen: false,
  isAllKanjiModalOpen: false,
  isTestResultsModalOpen: false,
};

soundManager.setEnabled(state.soundEnabled);

function getKanjiListForCategory() {
  return KANJI_DATA.filter((k) => k.category === state.currentCategory);
}

function getCurrentKanji() {
  const list = getKanjiListForCategory();
  return KANJI_DATA.find((k) => k.id === state.currentKanjiId) || list[0] || KANJI_DATA[0];
}

// ------------------------------------------------------------------------
// Mount points
// ------------------------------------------------------------------------

const confetti = new Confetti(document.getElementById('confetti-canvas'));
const toast = createToast(document.getElementById('toast'));

const header = createHeader(document.getElementById('app-header'), {
  onToggleSound: () => {
    state.soundEnabled = !state.soundEnabled;
    soundManager.setEnabled(state.soundEnabled);
    render();
  },
  onOpenCategoryModal: () => {
    soundManager.playClick();
    state.isCategoryModalOpen = true;
    render();
  },
  onOpenAllKanjiModal: () => {
    soundManager.playClick();
    state.isAllKanjiModalOpen = true;
    render();
  },
  onToggleTestMode: handleToggleTestMode,
  onToggleWatermark: handleToggleWatermark,
  onTogglePenMode: handleTogglePenMode,
  onPenModeRejected: handlePenModeRejected,
});

const kanjiGrid = createKanjiGrid(document.getElementById('kanji-grid'), {
  onSelectKanji: handleSelectKanji,
  onOpenCategoryModal: () => {
    state.isCategoryModalOpen = true;
    render();
  },
});

const canvas = new DrawingCanvas(document.getElementById('drawing-canvas-wrap'), {
  onStrokeSuccess: (strokeIndex) => handleStrokeSuccess(strokeIndex),
  onStrokeFail: () => handleStrokeFail(),
  onKanjiComplete: (withWatermark) => handleKanjiComplete(withWatermark),
  onDemoEnd: () => {
    state.isDemoPlaying = false;
    render();
  },
  // Fired only when a test-mode lockout snapshot was just saved, so the
  // footer's "テストのけっかをみる" button appears without waiting for
  // another interaction (see the comment at the call site).
  onTestResultRecorded: () => render(),
});

const kanjiInfo = createKanjiInfoCard(document.getElementById('kanji-info-card'), {
  onPlayDemo: handlePlayDemo,
  onClearCanvas: () => {
    soundManager.playClick();
    state.clearTrigger += 1;
    render();
  },
  onNextKanji: handleNextKanji,
});

const footer = createFooter(document.getElementById('app-footer'), {
  onOpenTestResults: () => {
    soundManager.playClick();
    state.isTestResultsModalOpen = true;
    render();
  },
});

const categoryModal = createCategoryModal(document.getElementById('category-modal'), {
  onSelectCategory: handleSelectCategory,
  onClose: () => {
    state.isCategoryModalOpen = false;
    render();
  },
});

const allKanjiModal = createAllKanjiModal(document.getElementById('all-kanji-modal'), {
  onSelectKanji: handleSelectKanji,
  onClose: () => {
    state.isAllKanjiModalOpen = false;
    render();
  },
});

const testResultsModal = createTestResultsModal(document.getElementById('test-results-modal'), {
  onClose: () => {
    state.isTestResultsModalOpen = false;
    render();
  },
});

// ------------------------------------------------------------------------
// Handlers (mirrors the original App state machine)
// ------------------------------------------------------------------------

function handleToggleWatermark() {
  if (state.isTestMode) return;
  const next = !state.isWatermarkOn;
  state.isWatermarkOn = next;
  soundManager.playModeSwitch(next);
  toast.show(next ? '🥈 なぞり書きモードにしたよ' : '🥇 チャレンジモードにしたよ');
  render();
}

// テストモード: no tracing watermark and no stroke hints, so a mistake is
// just a mistake -- like a real test, not a nazori-practice session.
// Turning it off requires a press-and-hold (see header.js), so the voice
// line below only ever plays for a deliberate exit, not a stray tap.
function handleToggleTestMode() {
  state.isTestMode = !state.isTestMode;
  if (state.isTestMode) {
    state.isWatermarkOn = false;
    state.isDemoPlaying = false;
    state.testMistakeCounts = {};
    state.testFailedKanjiIds = {};
    soundManager.playClick();
    toast.show('🧪 テストモードを はじめるよ');
  } else {
    // speak() alone is unreliable here: this fires from the exit hold's
    // setTimeout callback, not directly inside a user-gesture handler, and
    // several browsers silently refuse to vocalize speech synthesis
    // triggered that way. playTestEnd() is a guaranteed-audible fallback.
    soundManager.playTestEnd();
    soundManager.speak('テストを終了します');
    toast.show('テストモードを おわったよ');
  }
  render();
}

// ペンモード: only a real stylus (pointerType 'pen') can draw, so a resting
// palm or finger no longer leaves stray marks or hijacks the active stroke.
function handleTogglePenMode() {
  soundManager.playClick();
  state.isPenModeOn = !state.isPenModeOn;
  toast.show(state.isPenModeOn ? '🖊️ ペンモードにしたよ' : 'ペンモードを おわったよ');
  render();
}

// Someone tried to turn pen mode ON without a real stylus (finger/mouse) --
// explain why instead of silently doing nothing.
function handlePenModeRejected() {
  soundManager.playWrongStroke();
  toast.show('ペンモードは iPadの Apple Pencilだけ つかえるよ');
}

function handleSelectKanji(kanjiId) {
  soundManager.playClick();
  state.currentKanjiId = kanjiId;
  state.isDemoPlaying = false;
  state.clearTrigger += 1;
  render();
}

function handleSelectCategory(catId) {
  soundManager.playClick();
  state.currentCategory = catId;
  const firstInCat = KANJI_DATA.find((k) => k.category === catId);
  if (firstInCat) state.currentKanjiId = firstInCat.id;
  state.clearTrigger += 1;
  location.hash = catId;
  render();
}

// Keep state in sync if the hash changes from outside a category-modal
// selection (e.g. the browser's back/forward buttons, or a manually edited URL).
window.addEventListener('hashchange', () => {
  if (state.isTestMode) {
    // Don't let the browser's back/forward buttons switch away from an
    // active test -- snap the URL back so a reload can't escape it either.
    if (getCategoryIdFromHash() !== state.currentCategory) {
      history.replaceState(null, '', `#${state.currentCategory}`);
    }
    return;
  }
  const catId = getCategoryIdFromHash();
  if (!catId || catId === state.currentCategory) return;
  state.currentCategory = catId;
  const firstInCat = KANJI_DATA.find((k) => k.category === catId);
  if (firstInCat) state.currentKanjiId = firstInCat.id;
  state.isDemoPlaying = false;
  state.clearTrigger += 1;
  render();
});

function handleNextKanji() {
  soundManager.playClick();
  const list = getKanjiListForCategory();
  const idx = list.findIndex((k) => k.id === state.currentKanjiId);
  if (idx >= 0 && idx + 1 < list.length) {
    state.currentKanjiId = list[idx + 1].id;
  } else if (list.length > 0) {
    state.currentKanjiId = list[0].id;
  }
  state.isDemoPlaying = false;
  state.clearTrigger += 1;
  render();
}

function handleStrokeSuccess(strokeIndex) {
  soundManager.playCorrectStroke(strokeIndex);
}

// If a mistake happens in チャレンジモード (no watermark), fall back to
// なぞり書きモード (watermark) automatically so the combo streak survives.
function handleStrokeFail() {
  soundManager.playWrongStroke();
  if (!state.isTestMode && !state.isWatermarkOn) {
    state.isWatermarkOn = true;
    soundManager.playModeSwitch(true);
  }
  if (state.isTestMode) {
    const kanji = getCurrentKanji();
    if (!state.testFailedKanjiIds[kanji.id]) {
      const count = (state.testMistakeCounts[kanji.id] || 0) + 1;
      state.testMistakeCounts = { ...state.testMistakeCounts, [kanji.id]: count };
      if (count >= TEST_MAX_MISTAKES) {
        state.testFailedKanjiIds = { ...state.testFailedKanjiIds, [kanji.id]: true };
        soundManager.playTestFail();
        toast.show('❌ ざんねん、つぎの かん字に すすもう');
      }
    }
  }
  render();
}

function handleKanjiComplete(completedWithWatermark) {
  const clearGrade = completedWithWatermark ? 'silver' : 'gold';

  if (clearGrade === 'gold') {
    soundManager.playGoldClear();
  } else {
    soundManager.playSilverClear();
  }

  const nextCombo = state.combo + 1;
  state.combo = nextCombo;
  if (nextCombo > state.maxCombo) {
    state.maxCombo = nextCombo;
  }
  if (nextCombo > 0 && nextCombo % 5 === 0) {
    soundManager.playComboUp(nextCombo);
  }

  const currentKanji = getCurrentKanji();
  const existing = state.progressMap[currentKanji.id];
  const updatedGrade = existing?.clearGrade === 'gold' ? 'gold' : clearGrade;

  state.progressMap = {
    ...state.progressMap,
    [currentKanji.id]: {
      kanjiId: currentKanji.id,
      clearGrade: updatedGrade,
      timesPracticed: (existing?.timesPracticed || 0) + 1,
      lastPracticed: Date.now(),
    },
  };

  // The per-stroke "GOOD!" popup was already suppressed for this final
  // stroke (see drawingCanvas.js), so the confetti celebration is the only
  // effect on screen right now.
  confetti.trigger(clearGrade);

  render();
}

function handlePlayDemo() {
  if (state.isTestMode) return;
  soundManager.playClick();
  state.isDemoPlaying = true;
  render();
}

// ------------------------------------------------------------------------
// Render
// ------------------------------------------------------------------------

let lastCanvasKey = null;

function render() {
  const kanjiListForCategory = getKanjiListForCategory();
  const currentKanji = getCurrentKanji();

  const totalStars = Object.values(state.progressMap).reduce((acc, prog) => {
    if (prog.clearGrade === 'gold') return acc + 30;
    if (prog.clearGrade === 'silver') return acc + 15;
    return acc;
  }, 0);

  const clearedCount = Object.values(state.progressMap).filter(
    (p) => p.clearGrade === 'gold' || p.clearGrade === 'silver'
  ).length;

  const currentCategoryName = KANJI_CATEGORIES.find((c) => c.id === state.currentCategory)?.name || '自然と天気';

  header.update({
    combo: state.combo,
    maxCombo: state.maxCombo,
    clearedCount,
    totalKanji: KANJI_DATA.length,
    currentCategory: state.currentCategory,
    soundEnabled: state.soundEnabled,
    isTestMode: state.isTestMode,
    isWatermarkOn: state.isWatermarkOn,
    isPenModeOn: state.isPenModeOn,
  });

  kanjiGrid.update({
    kanjiList: kanjiListForCategory,
    currentKanjiId: currentKanji.id,
    progressMap: state.progressMap,
    testFailedKanjiIds: state.isTestMode ? state.testFailedKanjiIds : {},
    totalStars,
    categoryName: currentCategoryName,
  });

  kanjiInfo.update({
    kanji: currentKanji,
    isDemoPlaying: state.isDemoPlaying,
    isTestMode: state.isTestMode,
  });

  const testReviewSnapshots = canvas.getTestReviewSnapshots();

  footer.update({
    isWatermarkOn: state.isWatermarkOn,
    isTestMode: state.isTestMode,
    categoryName: currentCategoryName,
    indexInCategory: kanjiListForCategory.findIndex((k) => k.id === currentKanji.id) + 1,
    totalInCategory: kanjiListForCategory.length,
    hasTestResults: testReviewSnapshots.length > 0,
  });

  categoryModal.update({ isOpen: state.isCategoryModalOpen, currentCategory: state.currentCategory });
  allKanjiModal.update({
    isOpen: state.isAllKanjiModalOpen,
    allKanjiList: KANJI_DATA,
    progressMap: state.progressMap,
  });
  testResultsModal.update({
    isOpen: state.isTestResultsModalOpen,
    snapshots: testReviewSnapshots,
  });

  // Only reset the canvas's stroke progress when the kanji (or an explicit
  // clear) actually changed -- never on every render, or a finished stroke
  // would wipe itself out mid-practice.
  const canvasKey = `${currentKanji.id}:${state.clearTrigger}`;
  if (canvasKey !== lastCanvasKey) {
    lastCanvasKey = canvasKey;
    canvas.setKanji(currentKanji);
  }
  canvas.setWatermark(state.isWatermarkOn);
  canvas.setTestMode(state.isTestMode);
  canvas.setPenMode(state.isPenModeOn);
  canvas.setFailed(state.isTestMode && !!state.testFailedKanjiIds[currentKanji.id]);
  canvas.setDemoPlaying(state.isDemoPlaying);
}

installIphoneGuards();
render();
