// Launch Chromium for tests and screenshots, and open the built site in it.
// Uses CHROMIUM_PATH if set; else Playwright's own browser; else (version mismatch) the newest headless shell already in
// Playwright's macOS cache, so nothing is downloaded.
import { chromium } from 'playwright';
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { serve } from './serve.mjs';

function cached() {
  const dir = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(dir)) return undefined;
  for (const s of readdirSync(dir).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const p = join(dir, s, arch, 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export function launch() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  return existsSync(chromium.executablePath()) ? chromium.launch() : chromium.launch({ executablePath: cached() });
}

// Serve docs/ and launch a browser. Returns { browser, base, errors, watch(page), close() }: watch() records console
// errors and page errors into `errors`.
export async function openSite() {
  const server = await serve();
  const browser = await launch();
  const errors = [];
  return {
    browser,
    base: `http://127.0.0.1:${server.address().port}/`,
    errors,
    watch(page, label = '') {
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${label}${e.message}`));
      return page;
    },
    async close() { await browser.close(); server.close(); },
  };
}
