// Ad-hoc checks on a phone viewport: horizontal overflow, and screenshots of the first screens.
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/${process.argv[2] || ''}`);
await page.waitForTimeout(600);
const r = await page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 1).slice(0, 8)
    .map((e) => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`);
  return { client: w, scroll: document.documentElement.scrollWidth, wide };
});
console.log(JSON.stringify(r, null, 1));
const out = process.argv[3];
if (out) for (let i = 0; i < 6; i += 1) { await page.screenshot({ path: `${out}/p${i}.png`, fullPage: true, clip: { x: 0, y: i * 1400, width: 390, height: 1400 } }); }
await browser.close(); server.close();
