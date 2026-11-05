// End-to-end smoke test against the built page: loads clean, search finds and opens a hospital, the statement adds up,
// the hash link works, Save as image downloads a PNG, the rate slider updates, and no console errors.
import { openSite } from './browser.mjs';
import assert from 'node:assert/strict';

const shots = process.env.SHOTS;
const site = await openSite();
const { browser, base, errors } = site;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = site.watch(await ctx.newPage());
await page.goto(base);
if (shots) { await page.waitForTimeout(650); await page.screenshot({ path: `${shots}/anim.png` }); }
await page.waitForTimeout(1800);

// Search by city and open the first result with the keyboard.
await page.fill('#find', 'cleveland clinic');
await page.waitForSelector('.find-opt');
const first = await page.textContent('.find-opt .find-name');
await page.keyboard.press('Enter');
await page.waitForSelector('.statement');
assert.equal(await page.textContent('#st-name'), first);
assert.match(page.url(), /#\d{6}$/);

// The four lines add up to CMS's total (to the dollar rounding on screen, $0.1 million).
const nums = await page.$$eval('.st-row:not(.st-colhead) .st-amt', (els) => els.map((e) => e.textContent));
const val = (s) => { const m = /([−+]?)\$([\d.,]+) (million|billion)?/.exec(s); const v = Number(m[2].replace(/,/g, '')) * (m[3] === 'billion' ? 1e3 : m[3] === 'million' ? 1 : 1e-6); return m[1] === '−' ? -v : v; };
const parts = nums.slice(0, 4).map(val).reduce((a, b) => a + b, 0);
assert.ok(Math.abs(parts - val(nums[4])) <= 0.25, `parts ${parts} vs total ${val(nums[4])}`);

// Save as image.
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Save as image')]);
assert.match(dl.suggestedFilename(), /^340b-swap-\d{6}\.png$/);
if (shots) await dl.saveAs(`${shots}/saved.png`);

// Hash link opens a hospital directly; junk hashes are ignored.
const p2 = site.watch(await ctx.newPage());
await p2.goto(`${base}#<img src=x onerror=alert(1)>`);
await p2.waitForTimeout(300);
assert.equal(await p2.$('.statement'), null);
await p2.goto(`${base}#050454`);
await p2.waitForSelector('.statement');

// Rate slider.
await page.click('button.chip:has-text("ASP − 33.4%")');
const out = await page.textContent('#rate-out');
assert.match(out, /hospitals get less/);
await page.click('button.chip:has-text("No cut")');
assert.match(await page.textContent('#rate-out'), /No 340B cut/);

// Escape closes the statement drawer.
await page.keyboard.press('Escape');
assert.equal(await page.isHidden('#drawer'), true);

// Malformed links are ignored without errors.
await p2.goto(`${base}#%E0%A4`);
await p2.waitForTimeout(200);

// Phone: tapping a dot in the field opens that hospital's statement.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const pp = site.watch(await phone.newPage(), 'phone: ');
await pp.goto(base);
await pp.evaluate(() => document.getElementById('step-2').scrollIntoView({ block: 'center' }));
await pp.waitForTimeout(500);
const box = await pp.locator('.field-canvas').boundingBox();
const hit = await pp.evaluate(({ x, y, w, h }) => {
  // Find a canvas pixel that isn't background, scanning a grid, and return page coordinates.
  const c = document.querySelector('.field-canvas');
  const ctx = c.getContext('2d');
  const dpr = c.width / w;
  for (let yy = 40; yy < h - 40; yy += 3) for (let xx = 20; xx < w - 20; xx += 3) {
    const d = ctx.getImageData(Math.round(xx * dpr), Math.round(yy * dpr), 1, 1).data;
    if (d[3] > 200 && (d[2] > d[0] + 40 || d[0] > d[2] + 40)) return { x: x + xx, y: y + yy };
  }
  return null;
}, { x: box.x, y: box.y, w: box.width, h: box.height });
assert.ok(hit, 'no dot found on the phone field');
await pp.touchscreen.tap(hit.x, hit.y);
await pp.waitForSelector('#drawer:not([hidden]) .statement');

assert.deepEqual(errors, []);
await site.close();
console.log('smoke: ok');
