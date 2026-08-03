/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { KanjiCategory, UserKanjiProgress, ClearGrade } from './types';
import { KANJI_DATA, KANJI_CATEGORIES } from './data/kanjiData';
import { Header } from './components/Header';
import { KanjiGrid } from './components/KanjiGrid';
import { KanjiInfoCard } from './components/KanjiInfoCard';
import { DrawingCanvas } from './components/DrawingCanvas';
import { CategoryModal } from './components/CategoryModal';
import { AllKanjiModal } from './components/AllKanjiModal';
import { Confetti } from './components/Confetti';
import { soundManager } from './utils/sound';

const STORAGE_KEY = 'kanji_app_progress_grade2';

export default function App() {
  // State for category and selected kanji
  const [currentCategory, setCurrentCategory] = useState<KanjiCategory>('nature');
  const [currentKanjiId, setCurrentKanjiId] = useState<string>('umi');

  // State for Watermark mode: false = 透かし無し (Gold Challenge), true = 透かしアリ (Silver / Trace)
  const [isWatermarkOn, setIsWatermarkOn] = useState<boolean>(false);

  // Demo playback & Canvas clear trigger
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(false);
  const [clearTrigger, setClearTrigger] = useState<number>(0);

  // Combo & Score stats
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Progress Map in LocalStorage
  const [progressMap, setProgressMap] = useState<Record<string, UserKanjiProgress>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Confetti celebration state
  const [confettiActive, setConfettiActive] = useState<boolean>(false);
  const [confettiType, setConfettiType] = useState<'gold' | 'silver' | 'combo'>('gold');

  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isAllKanjiModalOpen, setIsAllKanjiModalOpen] = useState<boolean>(false);

  // Sync sound manager enabled state
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Save progress to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
    } catch {
      // ignore
    }
  }, [progressMap]);

  // Filter kanji for current category
  const kanjiListForCategory = KANJI_DATA.filter((k) => k.category === currentCategory);

  // Get active kanji object
  const currentKanji =
    KANJI_DATA.find((k) => k.id === currentKanjiId) ||
    kanjiListForCategory[0] ||
    KANJI_DATA[0];

  // Total stars calculation (Gold = 30 stars, Silver = 15 stars)
  const totalStars = (Object.values(progressMap) as UserKanjiProgress[]).reduce((acc, prog) => {
    if (prog.clearGrade === 'gold') return acc + 30;
    if (prog.clearGrade === 'silver') return acc + 15;
    return acc;
  }, 0);

  const clearedCount = (Object.values(progressMap) as UserKanjiProgress[]).filter(
    (p) => p.clearGrade === 'gold' || p.clearGrade === 'silver'
  ).length;

  const currentCategoryName =
    KANJI_CATEGORIES.find((c) => c.id === currentCategory)?.name || '自然と天気';

  // Toggle Watermark mode
  const handleToggleWatermark = () => {
    const nextVal = !isWatermarkOn;
    setIsWatermarkOn(nextVal);
    soundManager.playModeSwitch(nextVal);
  };

  // Select a kanji
  const handleSelectKanji = (kanjiId: string) => {
    soundManager.playClick();
    setCurrentKanjiId(kanjiId);
    setIsDemoPlaying(false);
    setClearTrigger((prev) => prev + 1);
  };

  // Change category
  const handleSelectCategory = (cat: KanjiCategory) => {
    soundManager.playClick();
    setCurrentCategory(cat);
    const firstInCat = KANJI_DATA.find((k) => k.category === cat);
    if (firstInCat) {
      setCurrentKanjiId(firstInCat.id);
    }
    setClearTrigger((prev) => prev + 1);
  };

  // Next Kanji button
  const handleNextKanji = () => {
    soundManager.playClick();
    const idx = kanjiListForCategory.findIndex((k) => k.id === currentKanjiId);
    if (idx >= 0 && idx + 1 < kanjiListForCategory.length) {
      setCurrentKanjiId(kanjiListForCategory[idx + 1].id);
    } else {
      // Cycle to start of category or next category
      setCurrentKanjiId(kanjiListForCategory[0].id);
    }
    setIsDemoPlaying(false);
    setClearTrigger((prev) => prev + 1);
  };

  // Stroke success callback
  const handleStrokeSuccess = useCallback((strokeIndex: number) => {
    soundManager.playCorrectStroke(strokeIndex);
  }, []);

  // Stroke fail callback - CRITICAL REQUIREMENT:
  // "透かし無しでできなければ透かしアリになってコンボするようにして"
  // If the user makes a mistake while in "透かし無し" (Gold challenge / isWatermarkOn = false),
  // play wrong stroke sound and automatically activate "透かしアリ" (isWatermarkOn = true)
  // so their combo is preserved!
  const handleStrokeFail = useCallback(
    () => {
      soundManager.playWrongStroke();
      if (!isWatermarkOn) {
        setIsWatermarkOn(true);
        soundManager.playModeSwitch(true);
      }
    },
    [isWatermarkOn]
  );

  // Kanji Completion Callback
  const handleKanjiComplete = (completedWithWatermark: boolean) => {
    const clearGrade: ClearGrade = completedWithWatermark ? 'silver' : 'gold';

    // Play appropriate victory sound
    if (clearGrade === 'gold') {
      soundManager.playGoldClear();
    } else {
      soundManager.playSilverClear();
    }

    // Update Combo
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    if (nextCombo > maxCombo) {
      setMaxCombo(nextCombo);
    }

    if (nextCombo > 0 && nextCombo % 5 === 0) {
      soundManager.playComboUp(nextCombo);
    }

    // Update LocalStorage Progress Map
    setProgressMap((prev) => {
      const existing = prev[currentKanji.id];
      // If already Gold, keep Gold; otherwise update to new clearGrade
      const updatedGrade: ClearGrade =
        existing?.clearGrade === 'gold' ? 'gold' : clearGrade;

      return {
        ...prev,
        [currentKanji.id]: {
          kanjiId: currentKanji.id,
          clearGrade: updatedGrade,
          timesPracticed: (existing?.timesPracticed || 0) + 1,
          lastPracticed: Date.now(),
        },
      };
    });

    // Trigger Confetti celebration
    setConfettiType(clearGrade);
    setConfettiActive(true);
  };

  // Play Demo
  const handlePlayDemo = () => {
    soundManager.playClick();
    setIsDemoPlaying(true);
  };

  return (
    <div className="w-full min-h-screen bg-[#FDFCF0] flex flex-col font-sans text-[#333] select-none">
      {/* Header Navigation (Bold Typography theme) */}
      <Header
        combo={combo}
        maxCombo={maxCombo}
        clearedCount={clearedCount}
        totalKanji={KANJI_DATA.length}
        currentCategory={currentCategory}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onOpenCategoryModal={() => {
          soundManager.playClick();
          setIsCategoryModalOpen(true);
        }}
        onOpenAllKanjiModal={() => {
          soundManager.playClick();
          setIsAllKanjiModalOpen(true);
        }}
      />

      {/* Confetti celebration layer */}
      <Confetti
        active={confettiActive}
        type={confettiType}
        onComplete={() => setConfettiActive(false)}
      />

      {/* Main Content Area (3-Column Layout) */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 max-w-7xl mx-auto w-full items-center lg:items-stretch justify-center">
        {/* Left Sidebar: Character Grid & Score */}
        <KanjiGrid
          kanjiList={kanjiListForCategory}
          currentKanjiId={currentKanji.id}
          progressMap={progressMap}
          totalStars={totalStars}
          onSelectKanji={handleSelectKanji}
          onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
          categoryName={currentCategoryName}
        />

        {/* Center: Drawing Canvas */}
        <DrawingCanvas
          kanji={currentKanji}
          isWatermarkOn={isWatermarkOn}
          onStrokeSuccess={handleStrokeSuccess}
          onStrokeFail={handleStrokeFail}
          onKanjiComplete={handleKanjiComplete}
          isDemoPlaying={isDemoPlaying}
          onDemoEnd={() => setIsDemoPlaying(false)}
          clearTrigger={clearTrigger}
        />

        {/* Right Sidebar: Readings, Meaning, & Action Buttons */}
        <KanjiInfoCard
          kanji={currentKanji}
          isWatermarkOn={isWatermarkOn}
          onToggleWatermark={handleToggleWatermark}
          onPlayDemo={handlePlayDemo}
          onClearCanvas={() => {
            soundManager.playClick();
            setClearTrigger((prev) => prev + 1);
          }}
          onNextKanji={handleNextKanji}
          isDemoPlaying={isDemoPlaying}
        />
      </main>

      {/* Bottom Status Bar (Bold Typography theme) */}
      <footer className="h-12 bg-[#011627] flex items-center px-6 md:px-10 justify-between text-white shrink-0 mt-auto">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-300 font-bold uppercase tracking-widest">
            Touch / Stylus Active: {isWatermarkOn ? 'なぞり書きモード (銀)' : 'チャレンジモード (金)'}
          </span>
        </div>
        <div className="text-xs text-gray-300 font-bold">
          テーマ: {currentCategoryName} ({kanjiListForCategory.findIndex((k) => k.id === currentKanjiId) + 1}/{kanjiListForCategory.length})
        </div>
      </footer>

      {/* Category Selection Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        currentCategory={currentCategory}
        onSelectCategory={handleSelectCategory}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      {/* All Grade 2 Kanji List Modal */}
      <AllKanjiModal
        isOpen={isAllKanjiModalOpen}
        allKanjiList={KANJI_DATA}
        progressMap={progressMap}
        onSelectKanji={handleSelectKanji}
        onClose={() => setIsAllKanjiModalOpen(false)}
      />
    </div>
  );
}

