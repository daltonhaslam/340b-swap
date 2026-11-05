// Screenshots for review: desktop light, desktop dark, phone, and a hospital statement. Writes to e2e/screenshots/.
import { mkdirSync } from 'node:fs';
import { openSite } from './browser.mjs';

const site = await openSite();
const { browser, base, errors } = site;
const out = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const ccn = process.argv[2] || '330214';
for (const [name, opts, hash, full] of [
  ['desktop', { viewport: { width: 1280, height: 900 } }, '', true],
  ['dark', { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }, '', false],
  ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }, '', true],
  ['statement', { viewport: { width: 1280, height: 900 } }, `#${ccn}`, false],
  ['statement-phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }, `#${ccn}`, false],
]) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  site.watch(page, `${name}: `);
  await page.goto(base + hash);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: full });
  await ctx.close();
}
await site.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
