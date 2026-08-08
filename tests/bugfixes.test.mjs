import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  // 1. Example sentence should not contain the kanji character itself.
  const exampleText = await page.textContent('.readings-card__example');
  assert(!exampleText.includes('海'), 'example sentence for 海 does not contain 海: "' + exampleText + '"');
  assert(exampleText.includes('うみ'), 'example sentence uses the reading instead: "' + exampleText + '"');

  // Check 朝's meaning field too (nature category doesn't have 朝; switch to time).
  await page.click('[data-action="category"]');
  await page.click('.category-card[data-id="time"]');
  await page.waitForTimeout(100);
  await page.click('.kanji-tile[data-id="asa"]');
  await page.waitForTimeout(100);
  const meaningText = await page.textContent('.readings-card__meaning');
  assert(!meaningText.includes('朝'), 'meaning for 朝 does not contain 朝: "' + meaningText + '"');

  // 2. Watermark should be fully invisible when OFF (challenge mode, default).
  const watermarkOpacityOff = await page.$eval('.dc-watermark', (el) => getComputedStyle(el).opacity);
  assert(watermarkOpacityOff === '0', 'watermark opacity is 0 when off (got ' + watermarkOpacityOff + ')');

  // Toggle watermark ON and check it becomes visible.
  await page.click('[data-action="watermark"]');
  await page.waitForTimeout(400); // transition
  const watermarkOpacityOn = await page.$eval('.dc-watermark', (el) => getComputedStyle(el).opacity);
  assert(parseFloat(watermarkOpacityOn) > 0.5, 'watermark opacity is high when on (got ' + watermarkOpacityOn + ')');
  // Toggle back off for the rest of the test.
  await page.click('[data-action="watermark"]');
  await page.waitForTimeout(400);

  // 3. Stroke hint should not appear immediately, but should appear after the delay.
  const hintVisibleImmediately = await page.locator('.dc-stroke-hint').isVisible();
  assert(!hintVisibleImmediately, 'stroke hint is NOT visible immediately after selecting a kanji');

  await page.waitForTimeout(1500);
  const hintVisibleAt1_5s = await page.locator('.dc-stroke-hint').isVisible();
  assert(!hintVisibleAt1_5s, 'stroke hint still not visible at 1.5s (delay should be ~3s)');

  await page.waitForTimeout(2000); // total ~3.5s
  const hintVisibleAt3_5s = await page.locator('.dc-stroke-hint').isVisible();
  assert(hintVisibleAt3_5s, 'stroke hint IS visible after ~3.5s');

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
