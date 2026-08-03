import React from 'react';
import { KanjiCategory } from '../types';
import { KANJI_CATEGORIES } from '../data/kanjiData';

interface CategoryModalProps {
  isOpen: boolean;
  currentCategory: KanjiCategory;
  onSelectCategory: (category: KanjiCategory) => void;
  onClose: () => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  currentCategory,
  onSelectCategory,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#011627]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FDFCF0] border-4 border-[#FF9F1C] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-dashed border-gray-300">
          <div className="flex items-center space-x-2">
            <span className="text-3xl">🎒</span>
            <h2 className="text-2xl font-black text-[#333]">漢字のテーマをえらぼう！</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full font-black text-xl flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Category Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 my-2">
          {KANJI_CATEGORIES.map((cat) => {
            const isSelected = cat.id === currentCategory;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  onClose();
                }}
                className={`p-4 rounded-2xl border-3 text-left transition-all flex items-center space-x-3 ${
                  isSelected
                    ? 'bg-[#FF9F1C] border-[#FF9F1C] text-white shadow-md scale-[1.02]'
                    : 'bg-white border-gray-200 text-[#333] hover:border-[#FF9F1C] hover:scale-[1.01]'
                }`}
              >
                <div className="text-3xl p-2 bg-white/20 rounded-xl shrink-0">
                  {cat.emoji}
                </div>
                <div>
                  <div className="font-black text-base">{cat.name}</div>
                  <div
                    className={`text-xs font-medium ${
                      isSelected ? 'text-white/90' : 'text-gray-500'
                    }`}
                  >
                    {cat.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
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
