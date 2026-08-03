import React, { useState } from 'react';
import { KanjiItem, UserKanjiProgress } from '../types';
import { KANJI_CATEGORIES } from '../data/kanjiData';

interface AllKanjiModalProps {
  isOpen: boolean;
  allKanjiList: KanjiItem[];
  progressMap: Record<string, UserKanjiProgress>;
  onSelectKanji: (kanjiId: string) => void;
  onClose: () => void;
}

export const AllKanjiModal: React.FC<AllKanjiModalProps> = ({
  isOpen,
  allKanjiList,
  progressMap,
  onSelectKanji,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');

  if (!isOpen) return null;

  const filteredKanji = allKanjiList.filter((k) => {
    const matchesSearch =
      k.character.includes(searchTerm) ||
      k.readings.onyomi.some((o) => o.includes(searchTerm)) ||
      k.readings.kunyomi.some((ku) => ku.includes(searchTerm)) ||
      k.meaning.includes(searchTerm);

    const matchesCat = selectedCatFilter === 'all' || k.category === selectedCatFilter;
    return matchesSearch && matchesCat;
  });

  const goldCount = Object.values(progressMap).filter((p) => p.clearGrade === 'gold').length;
  const silverCount = Object.values(progressMap).filter((p) => p.clearGrade === 'silver').length;

  return (
    <div className="fixed inset-0 z-50 bg-[#011627]/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FDFCF0] border-4 border-[#FF9F1C] rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-dashed border-gray-300">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-3xl">📖</span>
              <h2 className="text-2xl font-black text-[#333]">小学２年生 漢字いちらん</h2>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-sm font-bold">
              <span className="text-amber-600">🥇 金メダル(透かし無し): {goldCount}字</span>
              <span className="text-slate-600">🥈 銀メダル(透かしアリ): {silverCount}字</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full font-black text-xl flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="漢字や読みでさがす (例: うみ, カイ, 海)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-white border-2 border-gray-300 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-[#FF9F1C]"
          />

          <select
            value={selectedCatFilter}
            onChange={(e) => setSelectedCatFilter(e.target.value)}
            className="bg-white border-2 border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#FF9F1C]"
          >
            <option value="all">すべてのテーマ</option>
            {KANJI_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Kanji Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 overflow-y-auto max-h-[50vh] p-2 bg-white rounded-2xl border border-gray-200">
          {filteredKanji.map((item) => {
            const progress = progressMap[item.id];
            const clearGrade = progress?.clearGrade || 'none';

            let cardClass =
              'aspect-square rounded-xl flex flex-col items-center justify-center text-2xl font-serif font-black transition-all relative border-2 cursor-pointer ';

            if (clearGrade === 'gold') {
              cardClass += 'bg-amber-100 border-amber-400 text-amber-900 hover:scale-105 shadow-sm';
            } else if (clearGrade === 'silver') {
              cardClass += 'bg-slate-100 border-slate-400 text-slate-800 hover:scale-105 shadow-sm';
            } else {
              cardClass += 'bg-white border-gray-200 text-gray-600 hover:border-[#FF9F1C] hover:scale-105';
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectKanji(item.id);
                  onClose();
                }}
                className={cardClass}
                title={`${item.character}: ${item.readings.kunyomi[0] || item.readings.onyomi[0]}`}
              >
                <span>{item.character}</span>
                {clearGrade === 'gold' && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-sans">
                    金
                  </span>
                )}
                {clearGrade === 'silver' && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-slate-400 text-white rounded-full w-4 h-4 flex items-center justify-center font-sans">
                    銀
                  </span>
                )}
              </button>
            );
          })}
          {filteredKanji.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-400 font-bold">
              みつかりませんでした
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 font-bold">
          <div>タッチすると、その漢字の練習に移動できます。</div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#011627] hover:bg-[#02243f] text-white font-black rounded-2xl shadow-sm"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
};
