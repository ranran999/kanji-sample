import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

async function main() {
  const browser = await launchBrowser();
  const errors = [];

  // ---- Desktop pass ----
  console.log('== Desktop ==');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
    });

    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForSelector('.kanji-tile');

    const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
    assert(viewportMeta.includes('user-scalable=no'), 'viewport meta disables user-scalable');
    assert(viewportMeta.includes('maximum-scale=1.0'), 'viewport meta pins maximum-scale');

    const title = await page.textContent('.header-title');
    assert(title.includes('かん字マスター'), 'header title renders: ' + title.trim());

    const tileCount = await page.locator('.kanji-tile').count();
    assert(tileCount > 0, 'kanji grid has tiles: ' + tileCount);

    const touchAction = await page.$eval('.dc-canvas', (el) => getComputedStyle(el).touchAction);
    assert(touchAction === 'none', 'drawing canvas has touch-action:none (got ' + touchAction + ')');

    // Draw the first stroke of 海(umi): dot from (20,18) to (26,25) in 0-100 canvas space.
    const box = await page.locator('.dc-canvas').boundingBox();
    const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });

    let p1 = toPx(20, 18);
    let p2 = toPx(26, 25);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { steps: 5 });
    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const bannerAfterStroke1 = await page.textContent('.dc-banner__text');
    assert(bannerAfterStroke1.includes('2 / 9'), 'banner advanced to stroke 2/9 after stroke 1: "' + bannerAfterStroke1 + '"');

    const feedbackVisible = await page.locator('.dc-feedback').isVisible();
    assert(feedbackVisible, 'success feedback popup shown after a correct stroke');

    // Wrong stroke: draw somewhere nonsensical for stroke 2, should trigger watermark fallback.
    let w1 = toPx(90, 90);
    let w2 = toPx(95, 95);
    await page.mouse.move(w1.x, w1.y);
    await page.mouse.down();
    await page.mouse.move(w2.x, w2.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const watermarkLabel = await page.textContent('.watermark-mini-toggle__label');
    const watermarkIsOn = await page.evaluate(() => document.querySelector('.watermark-mini-toggle').classList.contains('on'));
    assert(watermarkIsOn && watermarkLabel === 'なぞり書き', 'a failed stroke auto-switches to watermark (silver/tracing) mode: ' + watermarkLabel);

    // Demo playback should follow the curved svgPath (regression check for the fixed stroke-order sample).
    await page.click('[data-action="demo"]');
    const demoLabel = await page.textContent('.demo-label');
    assert(demoLabel === 'さいせい中', 'demo button shows playing state');
    await page.waitForTimeout(300);
    const demoActivePixels = await page.evaluate(() => {
      const canvas = document.querySelector('.dc-canvas');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonEmpty = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonEmpty++;
      return nonEmpty;
    });
    assert(demoActivePixels > 0, 'demo animation actually paints pixels on canvas (' + demoActivePixels + ' opaque px)');
    // Let the whole demo finish (9 strokes * ~820ms) so it doesn't bleed into the next check.
    await page.waitForTimeout(8000);
    const demoLabelAfter = await page.textContent('.demo-label');
    assert(demoLabelAfter === 'みほん', 'demo auto-ends and button resets: ' + demoLabelAfter);

    // Category modal
    await page.click('[data-action="all-kanji"]');
    await page.waitForTimeout(50);
    assert(await page.locator('#category-modal').isVisible() === false, 'category modal not accidentally opened');
    assert(await page.locator('#all-kanji-modal').isVisible(), 'all-kanji modal opens');
    await page.fill('.modal-search-input', '海');
    await page.waitForTimeout(50);
    const allKanjiTiles = await page.locator('.all-kanji-tile').count();
    assert(allKanjiTiles === 1, 'search filters all-kanji grid to 1 match for 海: got ' + allKanjiTiles);
    await page.click('#all-kanji-modal [data-action="close"]');
    await page.waitForTimeout(50);

    await page.click('[data-action="category"]');
    await page.waitForTimeout(50);
    assert(await page.locator('#category-modal').isVisible(), 'category modal opens');
    const catCards = await page.locator('.category-card').count();
    assert(catCards === 12, 'category modal lists 12 categories: got ' + catCards);
    await page.click('.category-card[data-id="school"]');
    await page.waitForTimeout(100);
    const catNameAfter = await page.textContent('.kanji-grid-card__subtitle');
    assert(catNameAfter.includes('学校'), 'switching category updates kanji grid subtitle: ' + catNameAfter);

    // Sound toggle
    const soundBefore = await page.textContent('.sound-toggle');
    await page.click('[data-action="sound"]');
    const soundAfter = await page.textContent('.sound-toggle');
    assert(soundBefore !== soundAfter, 'sound toggle button flips icon');

    await context.close();
  }

  // ---- iPhone-sized touch pass ----
  console.log('== iPhone viewport (touch) ==');
  {
    const iphone = playwrightDevice();
    const context = await browser.newContext({ ...iphone });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('pageerror(iphone): ' + e.message));

    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForSelector('.kanji-tile');

    const bodyOverscroll = await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior);
    assert(bodyOverscroll === 'none', 'body has overscroll-behavior:none on iPhone viewport');

    const box = await page.locator('.dc-canvas').boundingBox();
    const toPx = (nx, ny) => ({ x: box.x + (nx / 100) * box.width, y: box.y + (ny / 100) * box.height });
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Simulate a touch stroke and confirm the page didn't scroll and the
    // body.is-drawing lock class was engaged during the gesture.
    const p1 = toPx(20, 18);
    const p2 = toPx(26, 25);
    await page.touchscreen.tap(p1.x, p1.y);
    await page.evaluate(
      ({ x1, y1, x2, y2 }) => {
        const canvas = document.querySelector('.dc-canvas');
        const target = canvas;
        const fire = (type, x, y, id) => {
          const touch = new Touch({ identifier: id, target, clientX: x, clientY: y });
          target.dispatchEvent(new TouchEvent(type, { touches: [touch], changedTouches: [touch], targetTouches: [touch], bubbles: true, cancelable: true }));
        };
        const down = new PointerEvent('pointerdown', { clientX: x1, clientY: y1, pointerId: 1, bubbles: true, pointerType: 'touch' });
        target.dispatchEvent(down);
        window.__wasDrawing = document.body.classList.contains('is-drawing');
        const move = new PointerEvent('pointermove', { clientX: (x1 + x2) / 2, clientY: (y1 + y2) / 2, pointerId: 1, bubbles: true, pointerType: 'touch' });
        target.dispatchEvent(move);
        const up = new PointerEvent('pointerup', { clientX: x2, clientY: y2, pointerId: 1, bubbles: true, pointerType: 'touch' });
        target.dispatchEvent(up);
      },
      { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
    );
    const wasDrawing = await page.evaluate(() => window.__wasDrawing);
    assert(wasDrawing === true, 'body.is-drawing class engaged while a stroke is active');
    const isDrawingAfter = await page.evaluate(() => document.body.classList.contains('is-drawing'));
    assert(isDrawingAfter === false, 'body.is-drawing class released after pointer up');

    const scrollAfter = await page.evaluate(() => window.scrollY);
    assert(scrollAfter === scrollBefore, 'page did not scroll during the drawing gesture');

    await context.close();
  }

  await browser.close();

  if (errors.length) {
    console.log('\n=== Browser errors captured ===');
    for (const e of errors) console.log(' -', e);
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed, no console/page errors.');
  }
}

function playwrightDevice() {
  return {
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  };
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
