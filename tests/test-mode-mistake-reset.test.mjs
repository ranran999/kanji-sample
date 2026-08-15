import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

// Regression coverage: the test-mode lockout counts *consecutive* wrong
// strokes on the current kanji, not a lifetime total -- getting a stroke
// right resets the streak, so someone who's mostly doing fine but fumbles
// isolated strokes here and there shouldn't get locked out after 5 total
// mistakes spread across a whole kanji.
async function main() {
  const browser = await launchBrowser();
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  await page.click('[data-action="test-mode"]');
  await page.waitForTimeout(50);

  const drawWrongStroke = async () => {
    const box = await page.locator('.dc-canvas').boundingBox();
    const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });
    const p1 = toPx(90, 90);
    const p2 = toPx(95, 95);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  };

  const drawCorrectStroke = async () => {
    const currentKanjiId = await page.evaluate(() => document.querySelector('.kanji-tile.is-selected').dataset.id);
    const points = await page.evaluate(async (id) => {
      const { KANJI_DATA } = await import('/js/data.js');
      const { sampleSegment } = await import('/js/pathMeasure.js');
      // main.js doesn't expose the live currentStrokeIndex, but the
      // drawing canvas's dc-banner shows it (書き順 N / M画) whenever
      // there's progress -- for this test we only ever draw the very
      // first stroke of a fresh kanji, so index 0 is always right.
      const kanji = KANJI_DATA.find((k) => k.id === id);
      return sampleSegment(kanji.strokes[0].svgPath, 0, 1, 12);
    }, currentKanjiId);

    const box = await page.locator('.dc-canvas').boundingBox();
    const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });
    const pxPts = points.map((p) => toPx(p.x, p.y));
    await page.mouse.move(pxPts[0].x, pxPts[0].y);
    await page.mouse.down();
    for (let i = 1; i < pxPts.length; i++) {
      await page.mouse.move(pxPts[i].x, pxPts[i].y, { steps: 2 });
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
  };

  // 4 wrong strokes on the first stroke -- not locked yet.
  for (let i = 0; i < 4; i++) await drawWrongStroke();
  let bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'not locked after 4 wrong strokes: got ' + bannerText);

  // A correct stroke should reset the streak -- draw the kanji's real
  // first stroke, which must succeed and advance past it. (The banner text
  // itself can't confirm this: test mode deliberately hides the stroke
  // count. A completed stroke's ink stays on the canvas permanently, while
  // a wrong stroke's ink is wiped -- so non-zero ink confirms it landed.)
  await drawCorrectStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'still not locked right after the correct stroke: got ' + bannerText);

  const inkAfterCorrectStroke = await page.$eval('.dc-canvas', (el) => {
    const ctx = el.getContext('2d');
    const data = ctx.getImageData(0, 0, el.width, el.height).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonTransparent++;
    return nonTransparent;
  });
  assert(inkAfterCorrectStroke > 0, 'the correct stroke left visible ink (was accepted and advanced), got ' + inkAfterCorrectStroke + ' px');

  // 4 more wrong strokes (now on the second stroke) -- 8 wrong strokes total
  // this kanji, but only 4 *consecutive* since the reset, so still not locked.
  for (let i = 0; i < 4; i++) await drawWrongStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'still not locked -- 8 wrong strokes total but streak reset once: got ' + bannerText);

  // A 5th *consecutive* wrong stroke (since the reset) finally locks it.
  await drawWrongStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('ざんねん'), 'locked after 5 consecutive wrong strokes since the last success: got ' + bannerText);

  await context.close();
  await browser.close();

  if (errors.length) {
    console.log('\n=== Browser errors ===');
    for (const e of errors) console.log(' -', e);
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed, no console/page errors.');
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
