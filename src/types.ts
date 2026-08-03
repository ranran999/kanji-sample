export type KanjiCategory =
  | 'nature'     // 自然・天気 (海, 雨, 雲...)
  | 'school'     // 学校・勉強 (学, 校, 読...)
  | 'family'     // 家族・人 (父, 母, 兄...)
  | 'time'       // 時間・数字 (週, 曜, 時...)
  | 'animals'    // 動植物・食べ物 (犬, 鳥, 牛...)
  | 'places'     // 街・場所・方角 (店, 社, 東...)
  | 'actions';   // 動作・ことば・形 (行, 来, 言...)

export interface Point {
  x: number; // Normalized coordinate 0-100
  y: number; // Normalized coordinate 0-100
}

export interface KanjiStroke {
  strokeNumber: number;
  type: 'horizontal' | 'vertical' | 'left-sweep' | 'right-sweep' | 'dot' | 'curve' | 'hook';
  start: Point;
  end: Point;
  waypoints?: Point[];
  svgPath: string;
  hintText?: string; // e.g., "よこへ まっすぐ", "うえから したへ", "はらう"
}

export interface KanjiItem {
  id: string;
  character: string;
  category: KanjiCategory;
  grade: 2;
  strokeCount: number;
  readings: {
    onyomi: string[]; // カタカナ
    kunyomi: string[]; // ひらがな
  };
  meaning: string;
  examples: Array<{
    word: string;
    reading: string;
    sentence: string;
  }>;
  strokes: KanjiStroke[];
}

export type ClearGrade = 'gold' | 'silver' | 'none';
// gold = 透かし無し (No Watermark clear)
// silver = 透かしアリ (With Watermark / なぞり書き clear)
// none = Not yet cleared

export interface UserKanjiProgress {
  kanjiId: string;
  clearGrade: ClearGrade;
  timesPracticed: number;
  lastPracticed?: number;
}

export interface UserStats {
  combo: number;
  maxCombo: number;
  goldCount: number;
  silverCount: number;
  totalPracticed: number;
  soundEnabled: boolean;
  defaultWatermark: boolean; // false by default (starts in 透かし無し mode)
  progressMap: Record<string, UserKanjiProgress>;
}

export interface StrokeAttemptResult {
  isCorrect: boolean;
  strokeNumber: number;
  distanceError?: number;
  message?: string;
}
