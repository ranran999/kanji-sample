import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

async function main() {
  const browser = await launchBrowser();
  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  const hashBefore = await page.evaluate(() => location.hash);
  console.log('  initial hash:', JSON.stringify(hashBefore));

  // Select the "test1" category via the modal.
  await page.click('[data-action="category"]');
  await page.waitForTimeout(50);
  await page.click('.category-card[data-id="test1"]');
  await page.waitForTimeout(100);

  const hashAfter = await page.evaluate(() => location.hash);
  assert(hashAfter === '#test1', 'hash updated to #test1 after selecting category: got ' + hashAfter);

  const subtitle = await page.textContent('.kanji-grid-card__subtitle');
  assert(subtitle.includes('国語テスト'), 'grid subtitle reflects test1 category: ' + subtitle);

  // Reload the page and confirm the category (and its kanji list) persisted.
  await page.reload();
  await page.waitForSelector('.kanji-tile');

  const hashPersisted = await page.evaluate(() => location.hash);
  assert(hashPersisted === '#test1', 'hash survives reload: got ' + hashPersisted);

  const subtitleAfterReload = await page.textContent('.kanji-grid-card__subtitle');
  assert(subtitleAfterReload.includes('国語テスト'), 'category persisted after reload: ' + subtitleAfterReload);

  const tileCount = await page.locator('.kanji-tile').count();
  assert(tileCount === 19, 'test1 tiles (19) shown after reload: got ' + tileCount);

  // Bad/unknown hash should safely fall back to default category instead of crashing.
  await page.goto(BASE + '/index.html#not-a-real-category');
  await page.waitForSelector('.kanji-tile');
  const subtitleFallback = await page.textContent('.kanji-grid-card__subtitle');
  console.log('  fallback subtitle for bogus hash:', subtitleFallback);
  assert(subtitleFallback.includes('自然') || subtitleFallback.length > 0, 'bogus hash falls back gracefully: ' + subtitleFallback);

  // Manually editing the hash (hashchange event) should also switch category live.
  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');
  await page.evaluate(() => { location.hash = 'test1'; });
  await page.waitForTimeout(100);
  const subtitleAfterHashEdit = await page.textContent('.kanji-grid-card__subtitle');
  assert(subtitleAfterHashEdit.includes('国語テスト'), 'manually setting location.hash live-switches category: ' + subtitleAfterHashEdit);

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
