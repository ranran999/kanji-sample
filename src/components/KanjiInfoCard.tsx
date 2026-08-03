import React from 'react';
import { KanjiItem } from '../types';

interface KanjiInfoCardProps {
  kanji: KanjiItem;
  isWatermarkOn: boolean;
  onToggleWatermark: () => void;
  onPlayDemo: () => void;
  onClearCanvas: () => void;
  onNextKanji: () => void;
  isDemoPlaying: boolean;
}

export const KanjiInfoCard: React.FC<KanjiInfoCardProps> = ({
  kanji,
  isWatermarkOn,
  onToggleWatermark,
  onPlayDemo,
  onClearCanvas,
  onNextKanji,
  isDemoPlaying,
}) => {
  return (
    <aside className="w-full lg:w-64 flex flex-col gap-5 shrink-0">
      {/* Readings & Meaning Card */}
      <div className="bg-[#F1F5F9] rounded-3xl p-5 flex flex-col items-center shadow-inner border border-gray-200">
        <span className="text-[#64748B] font-bold text-xs uppercase tracking-widest">
          おんよみ / くんよみ
        </span>

        <div className="mt-3 flex flex-col items-center gap-1.5 text-center">
          <div className="text-2xl md:text-3xl font-black text-[#1E293B]">
            {kanji.readings.onyomi.length > 0
              ? kanji.readings.onyomi.join(' ・ ')
              : 'なし'}
          </div>
          <div className="w-8 h-1 bg-[#CBD5E1] my-0.5"></div>
          <div className="text-2xl md:text-3xl font-bold text-[#1E293B]">
            {kanji.readings.kunyomi.length > 0
              ? kanji.readings.kunyomi.join(' ・ ')
              : 'なし'}
          </div>
        </div>

        {/* Meaning & Example Sentence */}
        <div className="mt-5 text-center w-full">
          <p className="text-sm text-[#1E293B] font-extrabold mb-1">
            {kanji.meaning}
          </p>
          {kanji.examples.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-[#64748B] font-medium leading-relaxed italic">
              「{kanji.examples[0].sentence}」
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Stack */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Top two buttons: みほん & けす */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <button
            onClick={onPlayDemo}
            disabled={isDemoPlaying}
            className="w-full py-3 px-4 bg-[#2EC4B6] hover:bg-[#259d92] disabled:opacity-50 text-white rounded-3xl shadow-[0_6px_0_#1a7a71] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center space-x-2 group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">
              👀
            </span>
            <span className="font-black text-lg">
              {isDemoPlaying ? 'さいせい中' : 'みほん'}
            </span>
          </button>

          <button
            onClick={onClearCanvas}
            className="w-full py-3 px-4 bg-white border-4 border-[#E71D36] text-[#E71D36] hover:bg-rose-50 rounded-3xl shadow-[0_6px_0_#b5162a] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center space-x-2"
          >
            <span className="text-2xl">🗑️</span>
            <span className="font-black text-lg">けす</span>
          </button>
        </div>

        {/* Watermark mode switch button (透かし無し <-> 透かしアリ) */}
        <button
          onClick={onToggleWatermark}
          className={`w-full py-3 px-4 rounded-3xl border-3 transition-all flex items-center justify-between shadow-sm ${
            isWatermarkOn
              ? 'bg-slate-100 border-slate-400 text-[#333]'
              : 'bg-amber-100 border-amber-500 text-amber-900 shadow-[0_4px_0_#d97706]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-xl">{isWatermarkOn ? '🥈' : '🥇'}</span>
            <div className="text-left leading-tight">
              <div className="text-xs font-bold text-gray-500">
                {isWatermarkOn ? 'なぞり書きモード' : 'チャレンジモード'}
              </div>
              <div className="text-sm font-black">
                {isWatermarkOn ? '透かしアリ (銀)' : '透かし無し (金)'}
              </div>
            </div>
          </div>
          <span className="text-xs bg-white px-2 py-1 rounded-lg font-bold border border-gray-300">
            切替
          </span>
        </button>

        {/* Big Orange NEXT Button */}
        <button
          onClick={onNextKanji}
          className="h-24 lg:h-28 bg-[#FF9F1C] hover:bg-[#eb8c0b] text-white rounded-3xl shadow-[0_8px_0_#cc7a00] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center space-x-2 group"
        >
          <span className="font-black text-3xl md:text-4xl italic tracking-tighter">
            NEXT!
          </span>
          <span className="text-3xl group-hover:translate-x-1 transition-transform">
            👉
          </span>
        </button>
      </div>
    </aside>
  );
};
