// Fetches hiragana/katakana stroke SVGs from animCJK, rescales the paths
// from its 1024x1024 viewBox into this app's 0-100 coordinate space,
// classifies each stroke's shape from raw geometry, and generates a
// Japanese hint sentence -- producing a `strokes: [...]` array in the
// exact shape public/js/data.js expects for each kana entry.
//
// Usage:
//   node tools/kanji-data/generate-kana-stroke-data.mjs あ か さ --out strokes.json
//
// Requires network access (fetches SVGs from raw.githubusercontent.com)
// and the Playwright Chromium browser (a devDependency; run
// `npx playwright install --with-deps chromium` first if you haven't).
//
// Source: animCJK's svgsJaKana (https://github.com/parsimonhi/animCJK),
// licensed CC0/LGPL-3.0-or-later for the kana files specifically (see
// LICENSE for exactly what that means for the geometry this tool
// produces). Unlike KanjiVG, these SVGs carry no kvg:type-style stroke-
// shape metadata, so classifyKanaStrokeType() below infers the shape
// (dot/horizontal/vertical/sweep/hook/curve) from the sampled geometry
// itself instead.

import fs from 'fs';
import { fileURLToPath } from 'url';
import { scalePath } from './pathScale.mjs';
import { launchBrowser } from '../../tests/helpers/browser.mjs';
import { attachHints, round1 } from './hintText.mjs';
import { maxChordDeviation } from '../../public/js/strokeChecker.js';

const ANIMCJK_BASE = 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/svgsJaKana/';
const SCALE = 100 / 1024;
// Max allowed deviation (in 0-100 units) between sample points on the
// original path and the rescaled path -- catches path-parsing bugs, not a
// tunable "quality" knob.
const VERIFY_TOLERANCE = 1.5;

// animCJK's kana SVGs are named by decimal (not hex) Unicode codepoint.
export function toDecimalCodepoint(ch) {
  return String(ch.codePointAt(0));
}

async function fetchSvg(codepoint) {
  const url = ANIMCJK_BASE + codepoint + '.svg';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`animCJK has no kana entry for codepoint ${codepoint} (HTTP ${res.status}) -- ${url}`);
  return res.text();
}

// No kvg:type-equivalent metadata exists for these strokes, so infer the
// shape from the sampled centerline geometry: how big is it (dot vs a real
// stroke), how much does it bend away from a straight line between its
// start and end (maxChordDeviation, the same measure strokeChecker.js uses
// to judge a user's drawing), and if straight, which way does it run.
function classifyKanaStrokeType(points) {
  const start = points[0];
  const end = points[points.length - 1];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width < 8 && height < 8) return 'dot';

  const chordLen = Math.hypot(end.x - start.x, end.y - start.y);
  const dev = maxChordDeviation(points);
  const bendRatio = chordLen > 1 ? dev / chordLen : dev > 3 ? 1 : 0;

  if (bendRatio < 0.12) {
    if (height < width * 0.35) return 'horizontal';
    if (width < height * 0.35) return 'vertical';
    return end.x - start.x < 0 ? 'left-sweep' : 'right-sweep';
  }
  return bendRatio > 0.5 ? 'curve' : 'hook';
}

// Fetches + rescales + classifies animCJK stroke data for one kana
// character. Exported so other tools (e.g. add-kanji.mjs) can reuse this
// pipeline without duplicating the parsing/classification logic.
export async function processKanaCharacter(page, ch) {
  const codepoint = toDecimalCodepoint(ch);
  const svgText = await fetchSvg(codepoint);

  // Each animCJK stroke is drawn as a filled calligraphic shape (for the
  // brush-like fill animation) plus a separate thin "guide" path that
  // drives that animation via stroke-dasharray -- the guide path is
  // effectively the stroke's centerline, the kana equivalent of KanjiVG's
  // `d` attribute. Guide paths share a `--d:Ns` timing value per logical
  // stroke; a stroke whose filled shape needed two path fragments to
  // render correctly (self-overlapping shapes) gets two near-duplicate
  // guide paths at the same timing -- keep only the first one seen.
  const raw = await page.evaluate((svgText) => {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    const guideEls = Array.from(svgEl.querySelectorAll('path[style*="--d"]'));
    const seenTimings = new Set();
    const out = [];
    for (const el of guideEls) {
      const timing = (el.getAttribute('style') || '').match(/--d:([\d.]+)s/)?.[1];
      if (!timing || seenTimings.has(timing)) continue;
      seenTimings.add(timing);
      out.push({ timing: parseFloat(timing), d: el.getAttribute('d') });
    }
    out.sort((a, b) => a.timing - b.timing);
    return out.map((s) => s.d);
  }, svgText);

  if (raw.length === 0) throw new Error(`no stroke guide paths found for ${ch} (codepoint ${codepoint})`);

  const scaledPaths = raw.map((d) => scalePath(d, SCALE, SCALE));

  // Verify fidelity + sample points in one pass: compare points sampled
  // from the rescaled path against the original (same technique as the
  // kanji pipeline), and keep the scaled sample points for classification.
  const verification = await page.evaluate(
    ({ raw, scaledPaths }) => {
      const NS = 'http://www.w3.org/2000/svg';
      function sample(d, vbSize) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${vbSize} ${vbSize}`);
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
        document.body.appendChild(svg);
        const len = p.getTotalLength();
        const steps = 16;
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
        const origPts = sample(raw[i], 1024);
        const scaledPts = sample(scaledPaths[i], 100);
        let maxDist = 0;
        for (let j = 0; j < origPts.length; j++) {
          const dx = origPts[j].x - scaledPts[j].x;
          const dy = origPts[j].y - scaledPts[j].y;
          maxDist = Math.max(maxDist, Math.hypot(dx, dy));
        }
        out.push({ maxDist, points: scaledPts });
      }
      return out;
    },
    { raw, scaledPaths }
  );

  const badStrokes = verification.filter((v) => v.maxDist > VERIFY_TOLERANCE);
  if (badStrokes.length > 0) {
    console.warn(
      `  ! ${ch}: ${badStrokes.length} stroke(s) exceeded ${VERIFY_TOLERANCE} rescale tolerance (maxDist: ${badStrokes
        .map((b) => b.maxDist.toFixed(2))
        .join(', ')})`
    );
  }

  const withType = scaledPaths.map((d, idx) => {
    const points = verification[idx].points;
    return {
      strokeNumber: idx + 1,
      type: classifyKanaStrokeType(points),
      start: { x: round1(points[0].x), y: round1(points[0].y) },
      end: { x: round1(points[points.length - 1].x), y: round1(points[points.length - 1].y) },
      svgPath: d,
    };
  });

  const strokes = attachHints(withType);
  return { codepoint, strokeCount: strokes.length, strokes };
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const charArgs = outIdx >= 0 ? [...args.slice(0, outIdx), ...args.slice(outIdx + 2)] : args;
  const characters = charArgs.flatMap((a) => Array.from(a));

  if (characters.length === 0) {
    console.error('Usage: node tools/kanji-data/generate-kana-stroke-data.mjs <kana...> [--out output.json]');
    process.exit(1);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  const result = {};
  for (const ch of characters) {
    console.log('Processing', ch, '...');
    try {
      result[ch] = await processKanaCharacter(page, ch);
    } catch (err) {
      console.error(`  ! Failed to process ${ch}: ${err.message}`);
    }
  }

  await browser.close();

  const json = JSON.stringify(result, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json);
    console.log(`\nWrote ${Object.keys(result).length}/${characters.length} kana to ${outPath}`);
  } else {
    console.log(json);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
