import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ok:', msg);
}

async function checkSquare(page, label) {
  const box = await page.locator('.drawing-canvas-wrap').boundingBox();
  const diff = Math.abs(box.width - box.height);
  console.log(`  [${label}] wrap box: ${box.width.toFixed(1)} x ${box.height.toFixed(1)} (diff ${diff.toFixed(2)}px)`);
  assert(diff < 2, `${label}: drawing-canvas-wrap is square (within 2px)`);
  return box;
}

async function main() {
  const browser = await launchBrowser();
  const errors = [];

  // iPad Air landscape (a common size that crosses the 1024px row-layout breakpoint
  // with limited vertical height -- exactly the scenario reported).
  const context = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('landscape: ' + e.message));

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('.kanji-tile');

  const boxLandscape = await checkSquare(page, 'iPad landscape 1180x820');

  // The canvas fills the wrap's padding-box (inset by the wrap's own
  // border), and .dc-stroke-hint's left/top percentages resolve against
  // that same padding-box -- so as long as both are square, their
  // coordinate spaces stay in sync regardless of aspect-ratio/flex quirks.
  const canvasBox = await page.locator('.dc-canvas').boundingBox();
  assert(Math.abs(canvasBox.width - canvasBox.height) < 1, 'canvas box itself is square in landscape');

  // Play the demo and confirm it still paints (exercises the scaleX/scaleY fix).
  await page.click('[data-action="demo"]');
  await page.waitForTimeout(900); // let it get into a second stroke (uses the Path2D branch)
  const demoPixels = await page.evaluate(() => {
    const canvas = document.querySelector('.dc-canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonEmpty = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonEmpty++;
    return nonEmpty;
  });
  assert(demoPixels > 0, 'demo still paints pixels in landscape (' + demoPixels + ' px)');

  // Now rotate to portrait (simulating an iPad orientation change) and
  // confirm the box becomes square again and stays in sync.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
  await page.waitForTimeout(300);
  await checkSquare(page, 'iPad portrait 820x1180');
  const canvasBoxPortrait = await page.locator('.dc-canvas').boundingBox();
  assert(Math.abs(canvasBoxPortrait.width - canvasBoxPortrait.height) < 1, 'canvas box itself is square after rotating back to portrait');

  // And rotate back to landscape again.
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
  await page.waitForTimeout(300);
  await checkSquare(page, 'iPad landscape again 1180x820');

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
