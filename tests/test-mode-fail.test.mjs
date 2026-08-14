import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

// Regression coverage for the test-mode anti-cheat lockout: repeatedly
// drawing wrong strokes on the same kanji during a test must eventually
// mark it as バツ (wrong) and lock the canvas, instead of allowing
// unlimited retries that a random-scribble "brute force" could eventually
// pass by luck.
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

  // First and second wrong strokes: still retryable, no lock yet.
  await drawWrongStroke();
  await drawWrongStroke();
  let bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'not locked yet after 2 wrong strokes: got ' + bannerText);

  // Third wrong stroke crosses the limit (TEST_MAX_MISTAKES = 3).
  await drawWrongStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('ざんねん'), 'banner shows the ざんねん lock message after 3 wrong strokes: got ' + bannerText);

  const toastText = await page.textContent('#toast');
  assert(toastText.includes('ざんねん'), 'toast also announces the lock: got ' + toastText);

  // Further attempts (even a well-aimed stroke) must be ignored while locked.
  await drawWrongStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('ざんねん'), 'still locked after a further attempt: got ' + bannerText);

  // Clicking "けす" (clear) must NOT reset the lock -- that would reopen the
  // exact loophole this feature closes (spam clear, keep guessing forever).
  await page.click('[data-action="clear"]');
  await page.waitForTimeout(100);
  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('ざんねん'), 'still locked after clicking けす (clear): got ' + bannerText);

  const inkPixelsAfterClearAttempt = await page.$eval('.dc-canvas', (el) => {
    const ctx = el.getContext('2d');
    const data = ctx.getImageData(0, 0, el.width, el.height).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonTransparent++;
    return nonTransparent;
  });
  assert(inkPixelsAfterClearAttempt === 0, 'canvas stays blank -- a post-lock draw attempt left no ink (got ' + inkPixelsAfterClearAttempt + ' px)');

  // Move to the next kanji and confirm the failed one now shows a バツ stamp
  // in the grid (mirrors how gold/silver stamps only show on non-selected tiles).
  const failedKanjiId = await page.evaluate(() => document.querySelector('.kanji-tile.is-selected').dataset.id);
  await page.click('[data-action="next"]');
  await page.waitForTimeout(100);

  const failedTileClass = await page.evaluate(
    (id) => document.querySelector(`.kanji-tile[data-id="${id}"]`).className,
    failedKanjiId
  );
  assert(failedTileClass.includes('is-fail'), 'previously-failed kanji tile has is-fail class: got ' + failedTileClass);

  const failedTileStamp = await page.evaluate(
    (id) => document.querySelector(`.kanji-tile[data-id="${id}"] .kanji-tile__stamp`)?.textContent,
    failedKanjiId
  );
  assert(failedTileStamp === '✗', 'previously-failed kanji tile shows the ✗ stamp: got ' + failedTileStamp);

  // Leaving test mode entirely must unlock drawing again on that same kanji
  // (a バツ only applies within the test session it happened in).
  const toggleBox = await page.locator('[data-action="test-mode"]').boundingBox();
  await page.mouse.move(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(100);

  await page.evaluate((id) => document.querySelector(`.kanji-tile[data-id="${id}"]`).click(), failedKanjiId);
  await page.waitForTimeout(100);
  bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'lock does not persist into normal practice mode after leaving test mode: got ' + bannerText);

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
