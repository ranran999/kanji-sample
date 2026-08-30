// Shared Japanese hint-sentence generation for stroke data, used by both
// the KanjiVG-based (kanji) and animCJK-based (kana) generator tools. Only
// this phrasing logic is shared -- each pipeline has its own classifyType()
// since kanji strokes are classified from KanjiVG's kvg:type metadata while
// kana strokes are classified from raw stroke geometry (animCJK has no
// equivalent metadata).

export function posBucket(v) {
  if (v < 35) return 'left';
  if (v > 65) return 'right';
  return 'mid';
}

export function vBucket(v) {
  if (v < 35) return 'top';
  if (v > 65) return 'bottom';
  return 'mid';
}

const H_WORD = { left: 'ひだりの', mid: 'まんなかの', right: 'みぎの' };
const H_WORD_DE = { left: 'ひだりで', mid: 'まんなかで', right: 'みぎで' };
const V_WORD = { top: 'うえの', mid: 'まんなかの', bottom: 'したの' };
const ORDINAL = ['', 'いちばんめの', 'にばんめの', 'さんばんめの', 'よんばんめの', 'ごばんめの', 'ろくばんめの', 'ななばんめの', 'はちばんめの'];

export function hintFor(stroke, type, dupIndex, dupTotal) {
  const cx = (stroke.start.x + stroke.end.x) / 2;
  const cy = (stroke.start.y + stroke.end.y) / 2;
  const hBucket = posBucket(cx);
  const vB = vBucket(cy);
  const prefix = dupTotal > 1 ? ORDINAL[dupIndex] + ' ' : '';

  if (type === 'dot') return `${prefix}${H_WORD[hBucket]} てん`;
  if (type === 'horizontal') return `${prefix}${V_WORD[vB]} よこせん`;
  if (type === 'vertical') return `${prefix}${H_WORD[hBucket]} たてせん`;
  if (type === 'left-sweep') return `${prefix}${H_WORD[hBucket]} ひだりはらい`;
  if (type === 'right-sweep') return `${prefix}${H_WORD[hBucket]} みぎはらい`;

  // hook/curve: describe direction of travel
  const dx = stroke.end.x - stroke.start.x;
  const dy = stroke.end.y - stroke.start.y;
  const goesRight = dx > 8;
  const goesLeft = dx < -8;
  const goesDown = dy > 8;
  const goesUp = dy < -8;
  let dir = 'まがる';
  if (goesDown && (goesRight || goesLeft)) dir = 'よこから したへ まがる';
  else if (goesRight && !goesDown && !goesUp) dir = 'みぎへ まがる';
  else if (goesDown && !goesRight && !goesLeft) dir = 'したへ まがる';
  else if (goesUp) dir = 'うえへ はねる';
  return `${prefix}${H_WORD_DE[hBucket]} ${dir}`;
}

// Given already-typed strokes ({ start, end, type, ... }), assigns hintText
// to each, numbering strokes that share the same type+position bucket
// (e.g. two horizontal strokes both on the left) so their hints stay
// distinguishable.
export function attachHints(strokesWithType) {
  const keyFor = (s) => `${s.type}:${posBucket((s.start.x + s.end.x) / 2)}:${vBucket((s.start.y + s.end.y) / 2)}`;
  const counts = {};
  for (const s of strokesWithType) counts[keyFor(s)] = (counts[keyFor(s)] || 0) + 1;
  const seen = {};
  return strokesWithType.map((s) => {
    const k = keyFor(s);
    seen[k] = (seen[k] || 0) + 1;
    return { ...s, hintText: hintFor(s, s.type, seen[k], counts[k]) };
  });
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}
