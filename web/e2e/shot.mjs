// Screenshots for review: each story step on desktop and phone, dark mode, and a hospital statement. Writes e2e/screenshots/.
import { mkdirSync } from 'node:fs';
import { openSite } from './browser.mjs';

const site = await openSite();
const { browser, base, errors } = site;
const out = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const ccn = process.argv[2] || '330214';
const VIEWS = {
  desktop: { viewport: { width: 1280, height: 860 } },
  dark: { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
for (const [name, opts] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
  const page = site.watch(await ctx.newPage(), `${name}: `);
  await page.goto(base);
  await page.waitForTimeout(500);
  const steps = name === 'dark' ? [1, 3] : [1, 2, 3, 4, 5];
  for (const s of steps) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), `step-${s}`);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}${name}-step${s}.png` });
  }
  if (name !== 'dark') {
    await page.goto(`${base}#${ccn}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}${name}-statement.png` });
    await page.evaluate(() => document.getElementById('how').scrollIntoView());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}${name}-after.png`, fullPage: false });
  }
  await ctx.close();
}
await site.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
