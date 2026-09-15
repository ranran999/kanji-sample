// Verifies the service worker actually keeps the app usable with no
// network at all -- not just that the precache files exist on disk.
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

  // ---- Manifest, icons and CSP wiring (checked while online) ----
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.kanji-tile');

  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
  assert(manifestHref === './manifest.webmanifest', 'index.html links the manifest: got ' + manifestHref);

  const manifestRes = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).status);
  assert(manifestRes === 200, 'manifest.webmanifest is served: got HTTP ' + manifestRes);

  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  assert(manifest.icons.length === 3, 'manifest lists 3 icons: got ' + manifest.icons.length);
  assert(manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest includes a maskable icon');
  for (const icon of manifest.icons) {
    const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src);
    assert(status === 200, `manifest icon ${icon.src} is served: got HTTP ${status}`);
  }

  const cspMeta = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  assert(cspMeta.includes("worker-src 'self'"), 'CSP meta tag allows worker-src self');
  assert(cspMeta.includes("manifest-src 'self'"), 'CSP meta tag allows manifest-src self');

  // ---- Service worker installs and takes control ----
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  assert(true, 'service worker took control of the page');

  const cacheHasShell = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const match = await cache.match('./index.html');
      if (match) return true;
    }
    return false;
  });
  assert(cacheHasShell, 'index.html was precached by the service worker');

  // ---- Actually go offline and confirm the app still works ----
  await context.setOffline(true);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.kanji-tile', { timeout: 10000 });

  const title = await page.textContent('.header-title');
  assert(title.includes('かん字マスター'), 'header renders offline after reload: ' + title.trim());

  const tileCountOffline = await page.locator('.kanji-tile').count();
  assert(tileCountOffline > 0, 'kanji grid has tiles offline: ' + tileCountOffline);

  // Interact: selecting a different kanji should still work fully offline.
  const secondTile = page.locator('.kanji-tile').nth(1);
  const secondTileId = await secondTile.getAttribute('data-id');
  await secondTile.click();
  await page.waitForTimeout(100);
  const selectedTileId = await page.evaluate(() => document.querySelector('.kanji-tile.is-selected')?.getAttribute('data-id'));
  assert(selectedTileId === secondTileId, 'selecting a kanji works offline: got ' + selectedTileId);

  // A fresh navigation (not just a reload) should also resolve from cache.
  await page.goto(BASE + '/index.html#nature', { waitUntil: 'load' });
  await page.waitForSelector('.kanji-tile', { timeout: 10000 });
  const titleAfterNav = await page.textContent('.header-title');
  assert(titleAfterNav.includes('かん字マスター'), 'a fresh offline navigation also resolves from cache');

  await context.setOffline(false);
  await context.close();
  await browser.close();

  if (errors.length) {
    console.log('\n=== Browser errors captured ===');
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
