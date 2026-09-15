// Renders the app's PWA icon set (plain + maskable PNGs) from a tiny HTML
// mockup, matching the existing .header-logo branding (orange background,
// bold white "漢" glyph). Re-run this if that branding ever changes.
//
// Usage:
//   node tools/pwa/generate-icons.mjs
//
// Requires the Playwright Chromium browser (see tests/helpers/browser.mjs).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from '../../tests/helpers/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../public/icons');

const ORANGE = '#FF9F1C';

// Plain icons (192, 512, apple-touch-icon) fill the whole square -- the OS
// applies its own rounding/masking, so pre-rounding here would look wrong
// (e.g. double-rounded corners on iOS). Maskable icons must additionally
// keep all meaningful content inside the center "safe zone" (an 80%-diameter
// circle) since the OS may crop right up to the edge in any shape.
function mockupHtml({ size, glyphScale }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; }
    .icon {
      width: ${size}px;
      height: ${size}px;
      background: ${ORANGE};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .glyph {
      color: #fff;
      font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
      font-weight: 900;
      font-size: ${Math.round(size * glyphScale)}px;
      line-height: 1;
    }
  </style></head><body>
    <div class="icon"><div class="glyph">漢</div></div>
  </body></html>`;
}

// [filename, size, glyphScale] -- glyphScale is smaller for the maskable
// icon so the glyph stays within the safe zone when the OS crops to a circle.
const TARGETS = [
  ['icon-192.png', 192, 0.62],
  ['icon-512.png', 512, 0.62],
  ['icon-maskable-512.png', 512, 0.42],
  ['apple-touch-icon.png', 180, 0.62],
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage();

  for (const [filename, size, glyphScale] of TARGETS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(mockupHtml({ size, glyphScale }));
    const outPath = path.join(OUT_DIR, filename);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${size}x${size})`);
  }

  await browser.close();
}

main();
