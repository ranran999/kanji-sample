import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

async function firePointerSequence(page, points, pointerType, pointerId) {
  await page.evaluate(
    ({ points, pointerType, pointerId }) => {
      const canvas = document.querySelector('.dc-canvas');
      const fire = (type, x, y) => {
        const ev = new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerId,
          pointerType,
          bubbles: true,
          cancelable: true,
        });
        canvas.dispatchEvent(ev);
      };
      fire('pointerdown', points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) fire('pointermove', points[i].x, points[i].y);
      fire('pointerup', points[points.length - 1].x, points[points.length - 1].y);
    },
    { points, pointerType, pointerId }
  );
}

async function firePointerTap(page, selector, pointerType, pointerId = 500) {
  await page.evaluate(
    ({ selector, pointerType, pointerId }) => {
      const el = document.querySelector(selector);
      const rect = el.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId, pointerType, bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId, pointerType, bubbles: true, cancelable: true }));
    },
    { selector, pointerType, pointerId }
  );
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

  const box = await page.locator('.dc-canvas').boundingBox();
  const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });

  // 海's first stroke: dot from (20,18) to (26,25), matching test_app.js.
  const strokePoints = [toPx(20, 18), toPx(23, 21), toPx(26, 25)];

  // ---- Baseline (pen mode OFF): touch input should still draw ----
  await firePointerSequence(page, strokePoints, 'touch', 1);
  await page.waitForTimeout(150);
  let banner = await page.textContent('.dc-banner__text');
  assert(banner.includes('2 / 9'), 'pen mode OFF: touch input draws normally (advanced to stroke 2): ' + banner);

  // Reset for next check.
  await page.click('[data-action="clear"]');
  await page.waitForTimeout(50);

  // ---- Trying to turn pen mode ON with touch/mouse must be rejected ----
  const penToggleBox = await page.locator('[data-action="pen-mode"]').boundingBox();
  assert(!!penToggleBox, 'pen-mode toggle button exists in the header');
  await page.click('[data-action="pen-mode"]'); // Playwright's click uses pointerType 'mouse'
  await page.waitForTimeout(50);
  const isOnAfterMouseClick = await page.evaluate(() => document.querySelector('.pen-mode-toggle').classList.contains('is-on'));
  assert(!isOnAfterMouseClick, 'a mouse click on the toggle does NOT turn pen mode on');
  let toastText = await page.textContent('#toast');
  assert(toastText.includes('Apple Pencil'), 'toast explains Apple Pencil is required: ' + toastText);

  await firePointerTap(page, '[data-action="pen-mode"]', 'touch');
  await page.waitForTimeout(50);
  const isOnAfterTouchTap = await page.evaluate(() => document.querySelector('.pen-mode-toggle').classList.contains('is-on'));
  assert(!isOnAfterTouchTap, 'a touch tap on the toggle does NOT turn pen mode on either');

  // ---- Turn pen mode ON with an actual pen tap ----
  await firePointerTap(page, '[data-action="pen-mode"]', 'pen');
  await page.waitForTimeout(50);
  const isOn = await page.evaluate(() => document.querySelector('.pen-mode-toggle').classList.contains('is-on'));
  assert(isOn, 'a pen tap on the toggle turns pen mode ON');
  toastText = await page.textContent('#toast');
  assert(toastText.includes('ペンモードにしたよ'), 'toast confirms pen mode turned on: ' + toastText);

  // ---- With pen mode ON: touch input should be ignored entirely ----
  await firePointerSequence(page, strokePoints, 'touch', 2);
  await page.waitForTimeout(150);
  banner = await page.textContent('.dc-banner__text');
  assert(banner.includes('1 / 9'), 'pen mode ON: touch input is ignored, stroke stays at 1/9: ' + banner);
  const pixelsAfterTouch = await page.evaluate(() => {
    const canvas = document.querySelector('.dc-canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonEmpty = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonEmpty++;
    return nonEmpty;
  });
  assert(pixelsAfterTouch === 0, 'pen mode ON: touch input leaves no ink on canvas (got ' + pixelsAfterTouch + ' px)');

  // ---- With pen mode ON: pen input should still work ----
  await firePointerSequence(page, strokePoints, 'pen', 3);
  await page.waitForTimeout(150);
  banner = await page.textContent('.dc-banner__text');
  assert(banner.includes('2 / 9'), 'pen mode ON: pen input draws normally (advanced to stroke 2): ' + banner);

  await page.click('[data-action="clear"]');
  await page.waitForTimeout(50);

  // ---- A second contact must not hijack an in-progress stroke ----
  await page.evaluate(
    ({ p1 }) => {
      const canvas = document.querySelector('.dc-canvas');
      const fire = (type, x, y, id, pointerType) => {
        canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType, bubbles: true, cancelable: true }));
      };
      // Start a pen stroke and move partway (still "down").
      fire('pointerdown', p1.x, p1.y, 10, 'pen');
      fire('pointermove', p1.x + 5, p1.y + 5, 10, 'pen');
      window.__activeLenBeforePalm = window.__probe ? window.__probe() : null;
    },
    { p1: strokePoints[0] }
  );
  const midStrokeInfoBefore = await page.evaluate(() => document.querySelector('.dc-canvas') && true);
  // Simulate a palm touching down with a DIFFERENT pointerId while the pen stroke is active.
  await page.evaluate(
    ({ p2 }) => {
      const canvas = document.querySelector('.dc-canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: p2.x, clientY: p2.y, pointerId: 99, pointerType: 'touch', bubbles: true, cancelable: true }));
    },
    { p2: toPx(90, 90) }
  );
  await page.waitForTimeout(50);
  // Finish the original pen stroke with its own pointerId (10) -- if the
  // palm had hijacked activePointerId, this pointerup would be ignored and
  // the stroke would never complete.
  await page.evaluate(
    ({ p1 }) => {
      const canvas = document.querySelector('.dc-canvas');
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: p1.x + 6, clientY: p1.y + 7, pointerId: 10, pointerType: 'pen', bubbles: true, cancelable: true }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: p1.x + 6, clientY: p1.y + 7, pointerId: 10, pointerType: 'pen', bubbles: true, cancelable: true }));
    },
    { p1: strokePoints[0] }
  );
  await page.waitForTimeout(150);
  banner = await page.textContent('.dc-banner__text');
  assert(banner.includes('2 / 9'), 'a mid-stroke palm touch does not hijack the active pen stroke: ' + banner);

  // ---- Turn pen mode back OFF, touch should work again ----
  await page.click('[data-action="clear"]');
  await page.waitForTimeout(50);
  await page.click('[data-action="pen-mode"]');
  await page.waitForTimeout(50);
  const isOnAfter = await page.evaluate(() => document.querySelector('.pen-mode-toggle').classList.contains('is-on'));
  assert(!isOnAfter, 'pen mode toggle shows OFF state after second click');
  await firePointerSequence(page, strokePoints, 'touch', 4);
  await page.waitForTimeout(150);
  banner = await page.textContent('.dc-banner__text');
  assert(banner.includes('2 / 9'), 'pen mode OFF again: touch input draws normally: ' + banner);

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
