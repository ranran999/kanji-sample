import React from 'react';
import { KanjiItem, UserKanjiProgress } from '../types';

interface KanjiGridProps {
  kanjiList: KanjiItem[];
  currentKanjiId: string;
  progressMap: Record<string, UserKanjiProgress>;
  totalStars: number;
  onSelectKanji: (kanjiId: string) => void;
  onOpenCategoryModal: () => void;
  categoryName: string;
}

export const KanjiGrid: React.FC<KanjiGridProps> = ({
  kanjiList,
  currentKanjiId,
  progressMap,
  totalStars,
  onSelectKanji,
  onOpenCategoryModal,
  categoryName,
}) => {
  return (
    <aside className="w-full lg:w-64 flex flex-col gap-4 shrink-0">
      {/* Category header for mobile/tablet */}
      <div className="lg:hidden flex items-center justify-between bg-white rounded-2xl px-4 py-2 border-2 border-[#FF9F1C]/20 shadow-sm">
        <span className="font-black text-[#FF9F1C] text-sm">テーマ: {categoryName}</span>
        <button
          onClick={onOpenCategoryModal}
          className="text-xs bg-[#FF9F1C] text-white px-3 py-1 rounded-xl font-bold shadow-sm"
        >
          テーマをかえる
        </button>
      </div>

      {/* Main character grid */}
      <div className="bg-white rounded-3xl p-4 flex-1 shadow-lg border-2 border-[#FF9F1C]/20 flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-dashed border-gray-200">
          <h2 className="font-black text-[#FF9F1C] text-base">きょうの かん字</h2>
          <span className="text-xs font-bold text-gray-400">{categoryName}</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-2 gap-3 overflow-y-auto max-h-[380px] lg:max-h-none pr-1">
          {kanjiList.map((item) => {
            const isSelected = item.id === currentKanjiId;
            const progress = progressMap[item.id];
            const clearGrade = progress?.clearGrade || 'none';

            let cardClass =
              'aspect-square rounded-xl flex flex-col items-center justify-center text-3xl font-serif transition-all relative cursor-pointer select-none ';

            if (isSelected) {
              cardClass +=
                'bg-[#2EC4B6] text-white shadow-md border-b-4 border-[#259d92] scale-105 ';
            } else if (clearGrade === 'gold') {
              cardClass +=
                'bg-amber-50 border-2 border-amber-400 text-[#333] hover:scale-105 shadow-sm ';
            } else if (clearGrade === 'silver') {
              cardClass +=
                'bg-slate-50 border-2 border-slate-300 text-[#333] hover:scale-105 shadow-sm ';
            } else {
              cardClass +=
                'bg-white border-2 border-gray-200 text-gray-400 hover:border-[#FF9F1C] hover:text-[#333] ';
            }

            return (
              <div
                key={item.id}
                onClick={() => onSelectKanji(item.id)}
                className={cardClass}
              >
                <span>{item.character}</span>

                {/* Grade Stamp Icon */}
                {clearGrade === 'gold' && !isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 text-xs bg-amber-400 text-white rounded-full w-5 h-5 flex items-center justify-center font-sans font-black shadow-sm">
                    金
                  </span>
                )}
                {clearGrade === 'silver' && !isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 text-xs bg-slate-400 text-white rounded-full w-5 h-5 flex items-center justify-center font-sans font-black shadow-sm">
                    銀
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Total Stars Card (Navy) */}
      <div className="bg-[#011627] rounded-3xl p-5 text-white shadow-xl flex items-center justify-between lg:flex-col lg:items-start">
        <p className="text-xs text-gray-400 font-bold mb-1">TOTAL STARS</p>
        <div className="flex items-center space-x-2">
          <span className="text-3xl animate-spin-slow">⭐</span>
          <span className="text-3xl md:text-4xl font-black tracking-tight">{totalStars.toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
};
