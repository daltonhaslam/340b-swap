// Render docs/og.png (1200 x 630), the link-preview card, from the built page: the first story step and the dot field,
// restyled for the card in the screenshot browser only. Run after build.mjs: node og.mjs
import { openSite } from './e2e/browser.mjs';
import { fileURLToPath } from 'node:url';

const site = await openSite();
const ctx = await site.browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(site.base);
await page.addStyleTag({ content: `
  :root { --bar: 0px; }
  .topbar, .note, .kicker, .drawer, .after, .foot, .skip, .field-legend { display: none !important; }
  .story { grid-template-columns: 30rem 1fr !important; }
  #step-1 { min-height: 630px !important; padding: 0 !important; }
  #step-1 h1 { font-size: 60px !important; }
  .field { height: 630px !important; }
  .card-url { position: absolute; left: 40px; bottom: 26px; font: 600 20px 'Libre Franklin Variable', sans-serif; color: #46545e; }
` });
await page.evaluate(() => {
  const u = document.createElement('div');
  u.className = 'card-url';
  u.textContent = '340b-swap.vercel.app';
  document.body.append(u);
  window.dispatchEvent(new Event('resize'));
});
await page.waitForTimeout(800);
await page.screenshot({ path: fileURLToPath(new URL('../docs/og.png', import.meta.url)), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await site.close();
console.log('docs/og.png');
