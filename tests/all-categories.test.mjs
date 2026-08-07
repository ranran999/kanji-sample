import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

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

  const catIds = await page.evaluate(async () => {
    const { KANJI_CATEGORIES } = await import('/js/data.js');
    return KANJI_CATEGORIES.map((c) => c.id);
  });
  console.log('Categories found:', catIds.join(', '));

  let totalKanji = 0;
  const results = [];

  for (const cat of catIds) {
    await page.click('[data-action="category"]');
    await page.waitForTimeout(50);
    await page.click(`.category-card[data-id="${cat}"]`);
    await page.waitForTimeout(100);

    const tileIds = await page.$$eval('.kanji-tile', (els) => els.map((e) => e.dataset.id));
    if (tileIds.length === 0) {
      results.push({ cat, id: null, error: 'NO TILES RENDERED FOR THIS CATEGORY' });
      continue;
    }
    for (const id of tileIds) {
      totalKanji++;
      await page.click(`.kanji-tile[data-id="${id}"]`);
      await page.waitForTimeout(60);

      await page.click('[data-action="demo"]');
      await page.waitForTimeout(250);

      const pixelInfo = await page.evaluate(() => {
        const canvas = document.querySelector('.dc-canvas');
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonEmpty = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonEmpty++;
        return nonEmpty;
      });

      results.push({ cat, id, pixelInfo });

      await page.click('[data-action="clear"]');
      await page.waitForTimeout(30);
    }
  }

  console.log('Checked', totalKanji, 'kanji across', catIds.length, 'categories');
  const noPixels = results.filter((r) => r.error || r.pixelInfo === 0);
  if (noPixels.length) {
    console.log('!! Kanji/categories with issues:', JSON.stringify(noPixels));
    process.exitCode = 1;
  } else {
    console.log('All kanji in all categories painted pixels during demo playback.');
  }

  if (errors.length) {
    console.log('\n=== Browser errors ===');
    for (const e of [...new Set(errors)]) console.log(' -', e);
    process.exitCode = 1;
  } else {
    console.log('No console/page errors across', totalKanji, 'kanji.');
  }

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
