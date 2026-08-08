// Fetches KanjiVG stroke data for the given kanji characters, rescales the
// paths from KanjiVG's 109x109 viewBox into this app's 0-100 coordinate
// space, classifies each stroke's shape, and generates a Japanese hint
// sentence -- producing a `strokes: [...]` array in the exact shape
// public/js/data.js expects for each kanji entry.
//
// Usage:
//   node tools/kanji-data/generate-stroke-data.mjs 火 水 木 --out strokes.json
//
// Requires network access (fetches SVGs from raw.githubusercontent.com) and
// the Playwright Chromium browser (a devDependency; run
// `npx playwright install --with-deps chromium` first if you haven't).
//
// The output is a JSON object keyed by character. Each value's `strokes`
// array can be pasted directly into a new kanji entry in public/js/data.js -- see
// docs/adding-a-kanji-theme.md for the full workflow this fits into.

import fs from 'fs';
import { fileURLToPath } from 'url';
import { scalePath } from './pathScale.mjs';
import { launchBrowser } from '../../tests/helpers/browser.mjs';

const KANJIVG_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';
const SCALE = 100 / 109;
// Max allowed deviation (in 0-100 units) between sample points on the
// original path and the rescaled path -- catches path-parsing bugs, not a
// tunable "quality" knob.
const VERIFY_TOLERANCE = 1.5;

export function toCodepoint(ch) {
  return ch.codePointAt(0).toString(16).padStart(5, '0');
}

// Maps KanjiVG's kvg:type stroke-shape codes to this app's simplified
// taxonomy. See https://kanjivg.tagaini.net/strokes.html for the full code list.
function classifyType(kvgType) {
  const t = kvgType.split('/')[0]; // primary shape before any "looks like" alternate
  if (t.includes('㇔')) return 'dot';
  if (t.startsWith('㇐')) return 'horizontal';
  if (t.startsWith('㇑')) return 'vertical';
  if (t.startsWith('㇒')) return 'left-sweep';
  if (t.startsWith('㇘') || t.startsWith('㇏')) return 'right-sweep';
  if (['㇛', '㇜', '㇟', '㇁'].some((c) => t.startsWith(c))) return 'curve';
  return 'hook';
}

function posBucket(v) {
  if (v < 35) return 'left';
  if (v > 65) return 'right';
  return 'mid';
}
function vBucket(v) {
  if (v < 35) return 'top';
  if (v > 65) return 'bottom';
  return 'mid';
}
const H_WORD = { left: 'ひだりの', mid: 'まんなかの', right: 'みぎの' };
const H_WORD_DE = { left: 'ひだりで', mid: 'まんなかで', right: 'みぎで' };
const V_WORD = { top: 'うえの', mid: 'まんなかの', bottom: 'したの' };
const ORDINAL = ['', 'いちばんめの', 'にばんめの', 'さんばんめの', 'よんばんめの', 'ごばんめの', 'ろくばんめの', 'ななばんめの', 'はちばんめの'];

function hintFor(stroke, type, dupIndex, dupTotal) {
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

function round1(n) {
  return Math.round(n * 10) / 10;
}

async function fetchSvg(codepoint) {
  const url = KANJIVG_BASE + codepoint + '.svg';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KanjiVG has no entry for codepoint ${codepoint} (HTTP ${res.status}) -- ${url}`);
  return res.text();
}

// Fetches + rescales + classifies KanjiVG stroke data for one character.
// Exported so other tools (e.g. add-kanji.mjs) can reuse this pipeline
// without re-fetching or duplicating the classification logic.
export async function processCharacter(page, ch) {
  const codepoint = toCodepoint(ch);
  const svgText = await fetchSvg(codepoint);

  const raw = await page.evaluate((svgText) => {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    const pathEls = Array.from(svgEl.querySelectorAll('path[id]'));
    return pathEls.map((p) => ({ kvgType: p.getAttribute('kvg:type') || '', d: p.getAttribute('d') }));
  }, svgText);

  const scaledStrokes = raw.map((s) => ({ kvgType: s.kvgType, d: scalePath(s.d, SCALE, SCALE) }));

  // Verify fidelity: sample points along the rescaled path and compare
  // against points sampled from the original path (normalized to the same
  // 0-100 scale). Confirms the rescale preserves curve shape, not just the
  // start/end endpoints.
  const verification = await page.evaluate(
    ({ raw, scaledStrokes }) => {
      const NS = 'http://www.w3.org/2000/svg';
      function sample(d, vbSize) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${vbSize} ${vbSize}`);
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
        document.body.appendChild(svg);
        const len = p.getTotalLength();
        const steps = 8;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const pt = p.getPointAtLength((len * i) / steps);
          pts.push({ x: (pt.x / vbSize) * 100, y: (pt.y / vbSize) * 100 });
        }
        svg.remove();
        return pts;
      }
      const out = [];
      for (let i = 0; i < raw.length; i++) {
        const origPts = sample(raw[i].d, 109);
        const scaledPts = sample(scaledStrokes[i].d, 100);
        let maxDist = 0;
        for (let j = 0; j < origPts.length; j++) {
          const dx = origPts[j].x - scaledPts[j].x;
          const dy = origPts[j].y - scaledPts[j].y;
          maxDist = Math.max(maxDist, Math.hypot(dx, dy));
        }
        out.push({ maxDist, start: scaledPts[0], end: scaledPts[scaledPts.length - 1] });
      }
      return out;
    },
    { raw, scaledStrokes }
  );

  const badStrokes = verification.filter((v) => v.maxDist > VERIFY_TOLERANCE);
  if (badStrokes.length > 0) {
    console.warn(
      `  ! ${ch}: ${badStrokes.length} stroke(s) exceeded ${VERIFY_TOLERANCE} rescale tolerance (maxDist: ${badStrokes
        .map((b) => b.maxDist.toFixed(2))
        .join(', ')})`
    );
  }

  const withType = scaledStrokes.map((s, idx) => ({
    strokeNumber: idx + 1,
    type: classifyType(s.kvgType),
    start: { x: round1(verification[idx].start.x), y: round1(verification[idx].start.y) },
    end: { x: round1(verification[idx].end.x), y: round1(verification[idx].end.y) },
    svgPath: s.d,
  }));

  // Disambiguate hint text for strokes that share the same type + position
  // (e.g. two horizontal strokes both on the left) by numbering them.
  const keyFor = (s) => `${s.type}:${posBucket((s.start.x + s.end.x) / 2)}:${vBucket((s.start.y + s.end.y) / 2)}`;
  const counts = {};
  for (const s of withType) counts[keyFor(s)] = (counts[keyFor(s)] || 0) + 1;
  const seen = {};
  const strokes = withType.map((s) => {
    const k = keyFor(s);
    seen[k] = (seen[k] || 0) + 1;
    return { ...s, hintText: hintFor(s, s.type, seen[k], counts[k]) };
  });

  return { codepoint, strokeCount: strokes.length, strokes };
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const charArgs = outIdx >= 0 ? [...args.slice(0, outIdx), ...args.slice(outIdx + 2)] : args;
  const characters = charArgs.flatMap((a) => Array.from(a));

  if (characters.length === 0) {
    console.error('Usage: node tools/kanji-data/generate-stroke-data.mjs <kanji...> [--out output.json]');
    process.exit(1);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  const result = {};
  for (const ch of characters) {
    console.log('Processing', ch, '...');
    try {
      result[ch] = await processCharacter(page, ch);
    } catch (err) {
      console.error(`  ! Failed to process ${ch}: ${err.message}`);
    }
  }

  await browser.close();

  const json = JSON.stringify(result, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json);
    console.log(`\nWrote ${Object.keys(result).length}/${characters.length} kanji to ${outPath}`);
  } else {
    console.log(json);
  }
}

// Only run the CLI when this file is executed directly -- other tools (e.g.
// add-kanji.mjs) import `processCharacter` from here without wanting this
// module's own argv parsing and main() to run too.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
