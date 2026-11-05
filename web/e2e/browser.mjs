// Launch Chromium. Uses CHROMIUM_PATH if set, else the newest headless shell already in Playwright's cache, so the
// build doesn't download a browser.
import { chromium } from 'playwright';
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function cached() {
  const dir = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(dir)) return undefined;
  const shells = readdirSync(dir).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const s of shells) {
    const p = join(dir, s, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return undefined;
}

export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || cached() });
