import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(BASE + '/index.html');

  const result = await page.evaluate(async () => {
    const { KANJI_DATA } = await import('/js/data.js');
    const { evaluateStroke } = await import('/js/strokeChecker.js');
    const { sampleSegment } = await import('/js/pathMeasure.js');

    let total = 0;
    let rejectedGood = [];
    let acceptedBadStraightLine = [];

    function jitter(pt, amt) {
      return { x: pt.x + (Math.random() - 0.5) * amt, y: pt.y + (Math.random() - 0.5) * amt };
    }

    for (const kanji of KANJI_DATA) {
      for (const stroke of kanji.strokes) {
        total++;
        // A "reasonably careful child" drawing: follow the real path with
        // some jitter, at a coarser sampling than the ideal demo.
        const realPts = sampleSegment(stroke.svgPath, 0, 1, 12).map((p) => jitter(p, 3));
        const result = evaluateStroke(realPts, stroke, 24);
        if (!result.isCorrect) {
          rejectedGood.push({ id: kanji.id, char: kanji.character, strokeNumber: stroke.strokeNumber, message: result.message });
        }

        // A "shortcut" straight line directly from start to end -- should
        // be rejected whenever the real stroke meaningfully bends.
        const straightPts = [stroke.start, { x: (stroke.start.x + stroke.end.x) / 2, y: (stroke.start.y + stroke.end.y) / 2 }, stroke.end];
        const straightResult = evaluateStroke(straightPts, stroke, 24);
        if (straightResult.isCorrect) {
          // Only flag it if the real path actually bends meaningfully --
          // otherwise a straight line legitimately IS the correct stroke.
          const full = sampleSegment(stroke.svgPath, 0, 1, 20);
          const start = full[0];
          const end = full[full.length - 1];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lenSq = dx * dx + dy * dy || 1;
          let maxDev = 0;
          for (const p of full) {
            const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq));
            const projX = start.x + t * dx;
            const projY = start.y + t * dy;
            const dev = Math.hypot(p.x - projX, p.y - projY);
            if (dev > maxDev) maxDev = dev;
          }
          if (maxDev > 10) {
            acceptedBadStraightLine.push({ id: kanji.id, char: kanji.character, strokeNumber: stroke.strokeNumber, bend: maxDev });
          }
        }
      }
    }

    return { total, rejectedGood, acceptedBadStraightLine };
  });

  console.log('Total strokes checked:', result.total);
  console.log('\n-- "Reasonably careful" real-path-following input rejected (should be empty/rare): --');
  console.log(result.rejectedGood.length, 'rejected');
  for (const r of result.rejectedGood) console.log(' ', r.id, r.char, 'stroke', r.strokeNumber, '->', r.message);

  console.log('\n-- Straight-line shortcuts wrongly ACCEPTED for a meaningfully-bent stroke (should be empty): --');
  console.log(result.acceptedBadStraightLine.length, 'wrongly accepted');
  for (const r of result.acceptedBadStraightLine) console.log(' ', r.id, r.char, 'stroke', r.strokeNumber, 'bend=', r.bend.toFixed(1));

  await browser.close();

  if (result.acceptedBadStraightLine.length > 0) {
    console.log('\nFAIL: some straight-line shortcuts still slip through.');
    process.exitCode = 1;
  } else if (result.rejectedGood.length > result.total * 0.05) {
    console.log('\nWARN: more than 5% of good-faith attempts got rejected -- thresholds may be too strict.');
    process.exitCode = 1;
  } else {
    console.log('\nLooks good.');
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
