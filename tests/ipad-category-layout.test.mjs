import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

// Regression test for a real bug: a category with enough kanji to make the
// left-hand grid taller than the fixed-size square drawing canvas used to
// stretch the whole row and visually detach the canvas from the side panels
// on wide-but-short viewports like iPad landscape. Runs against whichever
// category currently has the most kanji, so it stays meaningful as themes
// are added/removed instead of pinning to one category id.
async function main() {
  const browser = await launchBrowser();
  const errors = [];

  const context = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  const { biggestCatId, biggestCount } = await page.evaluate(async () => {
    const { KANJI_DATA, KANJI_CATEGORIES } = await import('/js/data.js');
    let biggestCatId = null;
    let biggestCount = 0;
    for (const cat of KANJI_CATEGORIES) {
      const count = KANJI_DATA.filter((k) => k.category === cat.id).length;
      if (count > biggestCount) {
        biggestCount = count;
        biggestCatId = cat.id;
      }
    }
    return { biggestCatId, biggestCount };
  });
  console.log(`  largest category: ${biggestCatId} (${biggestCount} kanji)`);

  await page.click('[data-action="category"]');
  await page.waitForTimeout(50);
  await page.click(`.category-card[data-id="${biggestCatId}"]`);
  await page.waitForTimeout(150);

  const tileCount = await page.locator('.kanji-tile').count();
  assert(tileCount === biggestCount, `${biggestCatId} category loaded with ${biggestCount} tiles: got ${tileCount}`);

  const gridBox = await page.locator('.kanji-grid-panel').boundingBox();
  const infoBox = await page.locator('.kanji-info-panel').boundingBox();
  const canvasWrapBox = await page.locator('.drawing-canvas-wrap').boundingBox();

  assert(
    Math.abs(canvasWrapBox.y - gridBox.y) < 5,
    'canvas wrap top-aligns with kanji-grid-panel top (diff ' + Math.abs(canvasWrapBox.y - gridBox.y).toFixed(1) + 'px)'
  );
  assert(
    Math.abs(canvasWrapBox.y - infoBox.y) < 5,
    'canvas wrap top-aligns with kanji-info-panel top (diff ' + Math.abs(canvasWrapBox.y - infoBox.y).toFixed(1) + 'px)'
  );

  const diffWH = Math.abs(canvasWrapBox.width - canvasWrapBox.height);
  assert(diffWH < 2, 'canvas wrap stays square even with the tallest grid (diff ' + diffWH.toFixed(2) + 'px)');

  // Grid itself should scroll internally rather than growing unbounded.
  const gridScrollBox = await page.locator('.kanji-grid').boundingBox();
  assert(gridScrollBox.height <= 561, 'kanji-grid height is capped (got ' + gridScrollBox.height.toFixed(1) + 'px)');

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
