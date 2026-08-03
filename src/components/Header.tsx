import React from 'react';
import { KanjiCategory } from '../types';
import { KANJI_CATEGORIES } from '../data/kanjiData';

interface HeaderProps {
  combo: number;
  maxCombo: number;
  clearedCount: number;
  totalKanji: number;
  currentCategory: KanjiCategory;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenCategoryModal: () => void;
  onOpenAllKanjiModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  combo,
  clearedCount,
  totalKanji,
  currentCategory,
  soundEnabled,
  onToggleSound,
  onOpenCategoryModal,
  onOpenAllKanjiModal,
}) => {
  const categoryInfo = KANJI_CATEGORIES.find((c) => c.id === currentCategory);
  const progressPercent = Math.min(100, Math.round((clearedCount / totalKanji) * 100));

  return (
    <header className="h-20 bg-[#FF9F1C] flex items-center justify-between px-6 md:px-8 shadow-md relative z-10 shrink-0">
      {/* Title & Badge */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#FF9F1C] text-3xl font-black shadow-inner">
          漢
        </div>
        <h1 className="text-white text-2xl md:text-3xl font-black tracking-tighter flex items-center">
          かん字マスター
          <span className="text-xl md:text-2xl font-bold bg-[#E71D36] px-2 py-0.5 rounded ml-2 shadow-sm">
            小２
          </span>
        </h1>
      </div>

      {/* Center: Category & Dictionary Buttons */}
      <div className="hidden lg:flex items-center space-x-3">
        <button
          onClick={onOpenCategoryModal}
          className="bg-white/90 hover:bg-white text-[#333] font-black px-4 py-2 rounded-2xl shadow-sm border-b-4 border-amber-600/40 active:translate-y-0.5 transition-all flex items-center space-x-2 text-sm"
        >
          <span className="text-lg">{categoryInfo?.emoji}</span>
          <span>{categoryInfo?.name}</span>
          <span className="text-xs bg-[#FF9F1C] text-white px-1.5 py-0.5 rounded font-bold">変更</span>
        </button>

        <button
          onClick={onOpenAllKanjiModal}
          className="bg-[#011627] hover:bg-[#02243f] text-white font-bold px-3 py-2 rounded-2xl shadow-sm border-b-4 border-black/40 active:translate-y-0.5 transition-all flex items-center space-x-1.5 text-xs"
        >
          <span>📖</span>
          <span>漢字いちらん</span>
        </button>
      </div>

      {/* Right: Progress & Combo Counter & Sound */}
      <div className="flex items-center space-x-4 md:space-x-8">
        {/* Progress Bar */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[#7C4A00] text-xs font-bold uppercase tracking-widest">
            Progress
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-32 md:w-48 h-4 bg-[#7C4A00]/20 rounded-full overflow-hidden border-2 border-[#7C4A00]/20">
              <div
                className="h-full bg-[#2EC4B6] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-white font-bold text-sm">
              {clearedCount}/{totalKanji}
            </span>
          </div>
        </div>

        {/* Combo Badge */}
        <div className="bg-white rounded-2xl px-4 md:px-6 py-1.5 md:py-2 flex items-center space-x-2 md:space-x-3 shadow-sm border-b-4 border-gray-200">
          <span className="text-3xl md:text-4xl animate-bounce">🔥</span>
          <div className="leading-none">
            <span className="text-[#E71D36] text-2xl md:text-3xl font-black italic">
              {combo}
            </span>
            <span className="text-[#E71D36] text-xs md:text-sm font-bold block">
              コンボ！
            </span>
          </div>
        </div>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm border-b-2 transition-all ${
            soundEnabled
              ? 'bg-white text-[#2EC4B6] border-gray-200'
              : 'bg-white/40 text-white border-transparent'
          }`}
          title="音をオン・オフ"
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  );
};
