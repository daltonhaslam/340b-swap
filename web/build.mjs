// Build docs/index.html: one self-contained page (styles, data and script inlined; fonts self-hosted in docs/fonts/).
// The page text is pre-rendered with the same render code, so it reads without JavaScript.
// Updates vercel.json's CSP hash for the inline script.
import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => readFileSync(here(p), 'utf8');
const DOCS = here('../docs/');
const sha = (s, n = 10) => createHash('sha256').update(s).digest('hex').slice(0, n);

// Fonts: the two variable faces the page sets (Latin subset), copied with content hashes for immutable caching.
const FONTS = [
  ['Libre Franklin Variable', 'normal', '@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2', 'libre-franklin'],
  ['Literata Variable', 'normal', '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2', 'literata'],
  ['Literata Variable', 'italic', '@fontsource-variable/literata/files/literata-latin-wght-italic.woff2', 'literata-italic'],
];
mkdirSync(`${DOCS}fonts`, { recursive: true });
for (const f of readdirSync(`${DOCS}fonts`)) rmSync(`${DOCS}fonts/${f}`);
const faces = FONTS.map(([family, style, src, slug]) => {
  const path = here(`node_modules/${src}`);
  const name = `${slug}.${sha(readFileSync(path))}.woff2`;
  copyFileSync(path, `${DOCS}fonts/${name}`);
  return { family, style, name };
});
const fontCss = faces.map((f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-display:swap;font-weight:100 900;src:url(fonts/${f.name}) format('woff2');}`).join('');
const preload = faces.filter((f) => f.style === 'normal').map((f) => `<link rel="preload" href="fonts/${f.name}" as="font" type="font/woff2" crossorigin>`).join('\n');

const css = (await transform([fontCss, read('src/styles/tokens.css'), read('src/styles/base.css'), read('src/styles/components.css')].join('\n'),
  { loader: 'css', minify: true })).code;
const js = (await build({ entryPoints: [here('src/js/main.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: 'es2020', legalComments: 'none' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const raw = read('src/data/swap.json');
const parsed = JSON.parse(raw);

// Prerender with linkedom, using the browser's own render code.
const { document, Node } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.document = document;
globalThis.Node = Node;
const { decode } = await import('./src/js/data.js');
const { renderPage } = await import('./src/js/page.js');
const { SITE } = await import('./src/js/site.js');
const data = decode(parsed);
const prerendered = renderPage(data).outerHTML;

const T = data.totals;
const TITLE = 'The 340B Swap: which hospitals gain and lose in 2027';
const DESC = `On Jan. 1, 2027, Medicare cuts 340B drug payments $4.65 billion and raises everything else 7.5%. `
  + `Look up any of ${T.n.toLocaleString('en-US')} hospitals.`;
if (DESC.length > 160) throw new Error(`description is ${DESC.length} characters`);
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const html = read('src/shell.html')
  .replaceAll('%TITLE%', attr(TITLE))
  .replaceAll('%DESC%', attr(DESC))
  .replaceAll('%URL%', SITE.url)
  .replace('%PRELOAD%', () => preload)
  .replace('%CSS%', () => css)
  .replace('%PRERENDER%', () => prerendered)
  .replace('%DATA%', () => raw.trim().replace(/</g, '\\u003c'))
  .replace('%JS%', () => js);
writeFileSync(`${DOCS}index.html`, html);

// CSP: the one inline script, by hash.
const hash = createHash('sha256').update(js).digest('base64');
const vercel = JSON.parse(read('../vercel.json'));
const csp = vercel.headers[0].headers.find((x) => x.key === 'Content-Security-Policy');
csp.value = csp.value.replace(/script-src [^;]+;/, `script-src 'sha256-${hash}';`);
writeFileSync(here('../vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`);
console.log(`docs/index.html ${(html.length / 1024).toFixed(0)} KB; script sha256-${hash}`);
