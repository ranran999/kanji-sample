import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

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

  // ---- Toast on watermark toggle ----
  await page.click('[data-action="watermark"]');
  await page.waitForTimeout(50);
  let toastVisible = await page.locator('#toast').evaluate((el) => el.classList.contains('is-visible'));
  let toastText = await page.textContent('#toast');
  assert(toastVisible, 'toast shows after toggling watermark ON');
  assert(toastText.includes('なぞり書き'), 'toast text mentions なぞり書き: ' + toastText);

  await page.click('[data-action="watermark"]');
  await page.waitForTimeout(50);
  toastText = await page.textContent('#toast');
  assert(toastText.includes('チャレンジ'), 'toast text mentions チャレンジ after toggling back: ' + toastText);

  // Toast should auto-hide after its timeout.
  await page.waitForTimeout(2200);
  const toastHiddenAfter = await page.locator('#toast').evaluate((el) => el.classList.contains('hidden'));
  assert(toastHiddenAfter, 'toast auto-hides after ~2s');

  // ---- Toast on test-mode toggle ----
  await page.click('[data-action="test-mode"]');
  await page.waitForTimeout(50);
  let testToastText = await page.textContent('#toast');
  assert(testToastText.includes('テストモード'), 'toast shows on entering test mode: ' + testToastText);

  // Exit via hold.
  const toggleBox = await page.locator('[data-action="test-mode"]').boundingBox();
  await page.mouse.move(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(50);
  let exitToastText = await page.textContent('#toast');
  assert(exitToastText.includes('おわった'), 'toast shows on exiting test mode: ' + exitToastText);

  // ---- Progress does not persist across reload ----
  // No progress-related key should ever be written to localStorage.
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-action="watermark"]'); // trivial interaction
  await page.waitForTimeout(50);
  const storedKeys = await page.evaluate(() => Object.keys(localStorage));
  assert(
    !storedKeys.some((k) => k.toLowerCase().includes('progress')),
    'no progress-related key is written to localStorage: got ' + JSON.stringify(storedKeys)
  );

  // Even stale progress data left over from a previous version of the app
  // (or a hand-crafted localStorage entry) must be ignored on load, so the
  // gold/silver display always starts fresh after a reload.
  await page.evaluate(() => {
    localStorage.setItem(
      'kanji_app_progress_grade2',
      JSON.stringify({ umi: { kanjiId: 'umi', clearGrade: 'gold', timesPracticed: 3, lastPracticed: Date.now() } })
    );
  });
  await page.reload();
  await page.waitForSelector('.kanji-tile');
  const progressCountText = await page.textContent('.header-progress-count');
  assert(
    progressCountText.trim().startsWith('0/'),
    'stale localStorage progress data is ignored after reload: got ' + progressCountText
  );
  const starsValue = await page.textContent('.stars-card__value');
  assert(starsValue.trim() === '0', 'stars count also resets after reload: got ' + starsValue);

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
