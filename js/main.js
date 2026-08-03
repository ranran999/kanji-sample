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
import { installIphoneGuards } from './iphoneGuards.js';

const STORAGE_KEY = 'kanji_app_progress_grade2';

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {};
}

function saveProgress(progressMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
  } catch {
    // ignore
  }
}

const state = {
  currentCategory: 'nature',
  currentKanjiId: 'umi',
  isWatermarkOn: false,
  isDemoPlaying: false,
  clearTrigger: 0,
  combo: 0,
  maxCombo: 0,
  soundEnabled: true,
  progressMap: loadProgress(),
  isCategoryModalOpen: false,
  isAllKanjiModalOpen: false,
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
});

const kanjiInfo = createKanjiInfoCard(document.getElementById('kanji-info-card'), {
  onToggleWatermark: handleToggleWatermark,
  onPlayDemo: handlePlayDemo,
  onClearCanvas: () => {
    soundManager.playClick();
    state.clearTrigger += 1;
    render();
  },
  onNextKanji: handleNextKanji,
});

const footer = createFooter(document.getElementById('app-footer'));

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

// ------------------------------------------------------------------------
// Handlers (mirrors the original App state machine)
// ------------------------------------------------------------------------

function handleToggleWatermark() {
  const next = !state.isWatermarkOn;
  state.isWatermarkOn = next;
  soundManager.playModeSwitch(next);
  render();
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
  render();
}

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
  if (!state.isWatermarkOn) {
    state.isWatermarkOn = true;
    soundManager.playModeSwitch(true);
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
  saveProgress(state.progressMap);

  // The per-stroke "GOOD!" popup was already suppressed for this final
  // stroke (see drawingCanvas.js), so the confetti celebration is the only
  // effect on screen right now.
  confetti.trigger(clearGrade);

  render();
}

function handlePlayDemo() {
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
  });

  kanjiGrid.update({
    kanjiList: kanjiListForCategory,
    currentKanjiId: currentKanji.id,
    progressMap: state.progressMap,
    totalStars,
    categoryName: currentCategoryName,
  });

  kanjiInfo.update({
    kanji: currentKanji,
    isWatermarkOn: state.isWatermarkOn,
    isDemoPlaying: state.isDemoPlaying,
  });

  footer.update({
    isWatermarkOn: state.isWatermarkOn,
    categoryName: currentCategoryName,
    indexInCategory: kanjiListForCategory.findIndex((k) => k.id === currentKanji.id) + 1,
    totalInCategory: kanjiListForCategory.length,
  });

  categoryModal.update({ isOpen: state.isCategoryModalOpen, currentCategory: state.currentCategory });
  allKanjiModal.update({
    isOpen: state.isAllKanjiModalOpen,
    allKanjiList: KANJI_DATA,
    progressMap: state.progressMap,
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
  canvas.setDemoPlaying(state.isDemoPlaying);
}

installIphoneGuards();
render();
