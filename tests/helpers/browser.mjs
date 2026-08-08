import { chromium } from 'playwright';

// Wraps chromium.launch() so a locally-cached browser binary at a
// non-default path (e.g. a sandboxed dev environment that pre-installs
// Chromium outside Playwright's normal managed-browser cache) can be used
// by setting PLAYWRIGHT_CHROMIUM_PATH. Unset in normal environments (local
// dev after `npx playwright install`, or CI), where Playwright resolves the
// browser it manages itself.
export function launchBrowser(options = {}) {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  return chromium.launch(executablePath ? { ...options, executablePath } : options);
}
