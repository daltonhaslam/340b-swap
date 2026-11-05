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

assert.deepEqual(errors, []);
await site.close();
console.log('smoke: ok');
