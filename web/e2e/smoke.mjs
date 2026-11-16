// End-to-end smoke test against the built page: loads clean, search finds and opens a hospital, the statement adds up,
// the hash link works, Save as image downloads a PNG, the rate slider updates, the phone sheet is modal, and no console
// errors or CSP violations (a securitypolicyviolation recorder catches report-only Trusted Types violations too, whatever
// level the browser logs them at).
import { openSite } from './browser.mjs';
import assert from 'node:assert/strict';

const shots = process.env.SHOTS;
const site = await openSite();
const { browser, base, errors } = site;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const recordViolations = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective}: ${e.sample}`));
};
await ctx.addInitScript(recordViolations);
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
const val = (s) => { const m = /([−+]?)\u2060?\$([\d.,]+) (million|billion)?/.exec(s); const v = Number(m[2].replace(/,/g, '')) * (m[3] === 'billion' ? 1e3 : m[3] === 'million' ? 1 : 1e-6); return m[1] === '−' ? -v : v; };
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

// On a wide screen the drawer is a side panel: not a dialog, and the page stays live.
assert.equal(await page.getAttribute('#drawer', 'role'), null);
assert.equal(await page.evaluate(() => document.getElementById('main').inert), false);

// Escape closes the statement drawer (it covers the text column, the slider's home) and focus goes back to the search.
await page.keyboard.press('Escape');
assert.equal(await page.isHidden('#drawer'), true);
assert.equal(await page.evaluate(() => document.activeElement.id), 'find');

// The tables scroll inside named regions a keyboard can reach.
const regions = await page.$$eval('.table-wrap', (els) => els.map((e) => ({ role: e.getAttribute('role'), tab: e.tabIndex,
  name: e.getAttribute('aria-label') || document.getElementById(e.getAttribute('aria-labelledby'))?.textContent })));
assert.equal(regions.length, 2);
for (const r of regions) { assert.equal(r.role, 'region'); assert.equal(r.tab, 0); assert.ok(r.name); }

// Rate slider.
await page.click('button.chip:has-text("ASP − 33.4%")');
const out = await page.textContent('#rate-out');
assert.match(out, /hospitals get less/);
assert.equal(await page.getAttribute('#rate', 'aria-valuetext'), 'ASP − 33.4%');
assert.equal(await page.getAttribute('#rate-out', 'aria-live'), null);
await page.click('button.chip:has-text("No cut")');
assert.match(await page.textContent('#rate-out'), /No 340B cut/);

// Malformed links are ignored without errors.
await p2.goto(`${base}#%E0%A4`);
await p2.waitForTimeout(200);

// Phone: tapping a dot in the field opens that hospital's statement.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
await phone.addInitScript(recordViolations);
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

// Phone: the statement is a bottom sheet over the page, so it is a modal dialog and the page behind it is inert.
const modal = () => pp.evaluate(() => ({ role: document.getElementById('drawer').getAttribute('role'),
  ariaModal: document.getElementById('drawer').getAttribute('aria-modal'),
  top: document.querySelector('.topbar').inert, main: document.getElementById('main').inert, foot: document.querySelector('.foot').inert,
  focus: document.activeElement.id }));
assert.deepEqual(await modal(), { role: 'dialog', ariaModal: 'true', top: true, main: true, foot: true, focus: 'st-name' });
// Widening past 900px turns it back into a side panel; narrowing again makes it modal again and pulls focus into it.
await pp.setViewportSize({ width: 1280, height: 844 });
await pp.waitForFunction(() => !document.getElementById('main').inert);
assert.equal((await modal()).role, null);
await pp.focus('#find');
await pp.setViewportSize({ width: 390, height: 844 });
await pp.waitForFunction(() => document.getElementById('main').inert);
assert.equal((await modal()).focus, 'st-name');
// Escape closes it and the page comes back.
await pp.keyboard.press('Escape');
assert.equal(await pp.isHidden('#drawer'), true);
assert.deepEqual({ ...(await modal()), focus: undefined }, { role: null, ariaModal: null, top: false, main: false, foot: false, focus: undefined });
// Opened from the search, focus moves into the sheet and returns to the search on close.
await pp.fill('#find', 'cleveland clinic');
await pp.waitForSelector('.find-opt');
await pp.keyboard.press('Enter');
await pp.waitForSelector('#drawer:not([hidden]) .statement');
assert.equal((await modal()).focus, 'st-name');
// A second hospital opened by link while the sheet is open: closing still returns focus to the search.
const firstName = await pp.textContent('#st-name');
await pp.evaluate(() => { location.hash = '050454'; });
await pp.waitForFunction((n) => document.getElementById('st-name')?.textContent !== n, firstName);
await pp.waitForFunction(() => document.activeElement.id === 'st-name');
await pp.keyboard.press('Escape');
assert.equal(await pp.evaluate(() => document.activeElement.id), 'find');

assert.deepEqual(errors, []);
for (const pg of [page, p2]) assert.deepEqual(await pg.evaluate(() => window.__csp), []);
assert.deepEqual(await pp.evaluate(() => window.__csp), []);
await site.close();
console.log('smoke: ok');
