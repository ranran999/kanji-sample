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

  // First four wrong strokes: still retryable, no lock yet.
  for (let i = 0; i < 4; i++) await drawWrongStroke();
  let bannerText = await page.textContent('.dc-banner__text');
  assert(!bannerText.includes('ざんねん'), 'not locked yet after 4 wrong strokes: got ' + bannerText);

  // Fifth wrong stroke crosses the limit (TEST_MAX_MISTAKES = 5).
  await drawWrongStroke();
  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('ざんねん'), 'banner shows the ざんねん lock message after 5 wrong strokes: got ' + bannerText);

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

  // The review button should now be visible, and opening it shows the
  // failed attempt with a real (non-blank) captured image and a fail badge.
  const resultsBtnHidden = await page.evaluate(() => document.querySelector('.footer-test-results-btn').classList.contains('hidden'));
  assert(!resultsBtnHidden, 'test-results button appears after a lockout is recorded');

  await page.click('[data-action="test-results"]');
  await page.waitForTimeout(100);

  const cardCount = await page.locator('.test-result-card').count();
  assert(cardCount === 1, 'review modal shows exactly one recorded attempt so far: got ' + cardCount);

  const cardIsFail = await page.evaluate(() => document.querySelector('.test-result-card').classList.contains('fail'));
  assert(cardIsFail, 'the recorded attempt is shown with the fail styling');

  const badgeText = await page.textContent('.test-result-card__badge');
  assert(badgeText.includes('ふせいかい'), 'fail badge text is correct: got ' + badgeText);

  const imgSrc = await page.getAttribute('.test-result-card__img', 'src');
  assert(imgSrc.startsWith('data:image/png;base64,') && imgSrc.length > 1000, 'snapshot image is a real captured PNG, not blank/missing');

  await page.click('#test-results-modal .modal-close');
  await page.waitForTimeout(50);
  const modalHiddenAfterClose = await page.evaluate(() => document.getElementById('test-results-modal').classList.contains('hidden'));
  assert(modalHiddenAfterClose, 'review modal closes');

  // Complete the current (next) kanji correctly, following its real stroke
  // paths -- both outcomes (correct and fail) should end up recorded.
  const currentKanjiId = await page.evaluate(() => document.querySelector('.kanji-tile.is-selected').dataset.id);
  const strokePercentPoints = await page.evaluate(async (id) => {
    const { KANJI_DATA } = await import('/js/data.js');
    const { sampleSegment } = await import('/js/pathMeasure.js');
    const kanji = KANJI_DATA.find((k) => k.id === id);
    return kanji.strokes.map((s) => sampleSegment(s.svgPath, 0, 1, 12));
  }, currentKanjiId);

  const canvasBox = await page.locator('.dc-canvas').boundingBox();
  const toCanvasPx = (nx, ny) => ({ x: canvasBox.x + (nx / 100) * canvasBox.width, y: canvasBox.y + (ny / 100) * canvasBox.height });
  for (const strokePts of strokePercentPoints) {
    const pxPts = strokePts.map((p) => toCanvasPx(p.x, p.y));
    await page.mouse.move(pxPts[0].x, pxPts[0].y);
    await page.mouse.down();
    for (let i = 1; i < pxPts.length; i++) {
      await page.mouse.move(pxPts[i].x, pxPts[i].y, { steps: 2 });
    }
    await page.mouse.up();
    await page.waitForTimeout(80);
  }

  bannerText = await page.textContent('.dc-banner__text');
  assert(bannerText.includes('完成'), 'the next kanji was completed correctly by following its real strokes: got ' + bannerText);

  await page.click('[data-action="test-results"]');
  await page.waitForTimeout(100);
  const cardCountAfterCorrect = await page.locator('.test-result-card').count();
  assert(cardCountAfterCorrect === 2, 'review modal now shows both the fail and the correct attempt: got ' + cardCountAfterCorrect);

  const correctCardBadge = await page.textContent('.test-result-card.correct .test-result-card__badge');
  assert(correctCardBadge.includes('せいかい') && !correctCardBadge.includes('ふせいかい'), 'the new card is badged as correct: got ' + correctCardBadge);

  await page.click('#test-results-modal .modal-close');
  await page.waitForTimeout(50);

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
