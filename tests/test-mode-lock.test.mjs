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

  // Stub speechSynthesis so we can assert on what was spoken without needing
  // real TTS voices in headless Chromium.
  await page.addInitScript(() => {
    window.__spoken = [];
    // window.speechSynthesis is a non-configurable getter on the real
    // Window prototype in Chromium -- plain assignment is silently a
    // no-op, so defineProperty is required to actually stub it out.
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel: () => {},
        speak: (utterance) => window.__spoken.push(utterance.text),
      },
      configurable: true,
      writable: true,
    });
  });

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  const toggle = () => page.locator('[data-action="test-mode"]');

  // Turning ON is a normal, instant tap.
  await toggle().click();
  await page.waitForTimeout(50);
  let isOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(isOn, 'a normal tap turns test mode ON');

  // A quick tap while ON should NOT turn it off (needs a hold).
  const box = await toggle().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(100);
  isOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(isOn, 'a quick tap while ON does NOT turn test mode off');

  const spokenAfterQuickTap = await page.evaluate(() => window.__spoken.length);
  assert(spokenAfterQuickTap === 0, 'no voice line plays for a quick tap (no exit happened)');

  // Releasing early after a partial hold also should not turn it off.
  await page.mouse.down();
  await page.waitForTimeout(1000); // well under the 2000ms hold requirement
  await page.mouse.up();
  await page.waitForTimeout(100);
  isOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(isOn, 'releasing before the 2s hold completes does NOT turn test mode off');

  // Holding past the threshold should turn it off and speak the exit line.
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(100);
  isOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(!isOn, 'a full 2s+ hold turns test mode OFF');

  const spoken = await page.evaluate(() => window.__spoken);
  assert(spoken.includes('テストを終了します'), 'exit voice line was spoken: got ' + JSON.stringify(spoken));

  // ---- Back-button / hash escape check ----
  await page.click('[data-action="category"]');
  await page.waitForTimeout(50);
  await page.click('.category-card[data-id="test1"]');
  await page.waitForTimeout(100);
  let hash = await page.evaluate(() => location.hash);
  assert(hash === '#test1', 'category select set hash to #test1');

  // Re-enter test mode on this category.
  await toggle().click();
  await page.waitForTimeout(50);
  isOn = await page.evaluate(() => document.querySelector('.test-mode-toggle').classList.contains('is-on'));
  assert(isOn, 'test mode re-enabled for the back-button check');

  // Manually fire a hashchange to a different category, simulating the
  // browser back button -- this should be ignored while testing.
  await page.evaluate(() => {
    history.pushState(null, '', '#nature');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await page.waitForTimeout(100);

  const subtitleAfterFakeBack = await page.textContent('.kanji-grid-card__subtitle');
  assert(subtitleAfterFakeBack.includes('国語テスト'), 'category did NOT change from a hashchange during test mode: ' + subtitleAfterFakeBack);

  const hashAfterFakeBack = await page.evaluate(() => location.hash);
  assert(hashAfterFakeBack === '#test1', 'URL hash snapped back to the test category: got ' + hashAfterFakeBack);

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
