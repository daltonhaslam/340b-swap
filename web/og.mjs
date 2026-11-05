// Render docs/og.png (1200 x 630), the link-preview card, from the built page: the headline, the counts and the swarm,
// restyled for the card in the screenshot browser only. Run after build.mjs: node og.mjs
import { launch } from './e2e/browser.mjs';
import { serve } from './e2e/serve.mjs';
import { fileURLToPath } from 'node:url';

const server = await serve();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.addStyleTag({ content: `
  .masthead, .dek, .focus, .note, .find-block, .sec, .foot, .skip { display: none !important; }
  .hero { padding-top: 34px !important; }
  .wide { max-width: 1200px !important; padding-inline: 56px !important; }
  h1 { font-size: 64px !important; max-width: 20ch !important; }
  .swarm-block { margin-top: 18px !important; }
  .card-url { position: absolute; right: 56px; top: 40px; font: 600 20px 'Libre Franklin Variable', sans-serif; color: #46545e; }
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
await browser.close();
server.close();
console.log('docs/og.png');
