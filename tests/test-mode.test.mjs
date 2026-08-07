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

  // "next" button text should now be Japanese.
  const nextText = await page.textContent('.btn-next__text');
  assert(nextText === '次へ', 'next button reads 次へ instead of NEXT!: got ' + nextText);

  // Test mode is off by default.
  const initiallyOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(!initiallyOn, 'test mode toggle starts off');

  // Turn test mode on.
  await page.click('[data-action="test-mode"]');
  await page.waitForTimeout(50);
  const nowOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(nowOn, 'test mode toggle turns on after click');

  const demoDisabled = await page.evaluate(() => document.querySelector('[data-action="demo"]').disabled);
  assert(demoDisabled, 'demo button is disabled in test mode');

  const watermarkDisabled = await page.evaluate(() => document.querySelector('[data-action="watermark"]').disabled);
  assert(watermarkDisabled, 'watermark toggle is disabled/locked in test mode');

  const footerStatus = await page.textContent('.footer-status__text');
  assert(footerStatus.includes('テストモード'), 'footer status reflects test mode: ' + footerStatus);

  // Draw an intentionally wrong stroke -- watermark should NOT auto-enable.
  const box = await page.locator('.dc-canvas').boundingBox();
  const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });
  let w1 = toPx(90, 90);
  let w2 = toPx(95, 95);
  await page.mouse.move(w1.x, w1.y);
  await page.mouse.down();
  await page.mouse.move(w2.x, w2.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const watermarkOnAfterFail = await page.evaluate(() => document.querySelector('.dc-watermark').classList.contains('is-on'));
  assert(!watermarkOnAfterFail, 'watermark stays OFF after a failed stroke in test mode (no auto-rescue)');

  const watermarkOpacity = await page.$eval('.dc-watermark', (el) => getComputedStyle(el).opacity);
  assert(watermarkOpacity === '0', 'watermark is fully invisible (opacity 0) in test mode: got ' + watermarkOpacity);

  // Stroke hint should never appear in test mode, even well past the normal 3s delay.
  await page.waitForTimeout(3800);
  const hintVisible = await page.locator('.dc-stroke-hint').evaluate((el) => !el.classList.contains('hidden'));
  assert(!hintVisible, 'stroke hint stays hidden in test mode even after the normal delay');

  // Turning test mode back off requires a press-and-hold (see
  // test_test_mode_lock.mjs for the dedicated coverage of that mechanic).
  const toggleBox = await page.locator('[data-action="test-mode"]').boundingBox();
  await page.mouse.move(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(50);
  const demoEnabledAfter = await page.evaluate(() => document.querySelector('[data-action="demo"]').disabled);
  assert(!demoEnabledAfter, 'demo button re-enabled after leaving test mode');
  const watermarkEnabledAfter = await page.evaluate(() => document.querySelector('[data-action="watermark"]').disabled);
  assert(!watermarkEnabledAfter, 'watermark toggle re-enabled after leaving test mode');

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
