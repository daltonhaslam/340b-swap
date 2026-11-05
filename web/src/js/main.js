import { h } from './dom.js';
import { decode } from './data.js';
import { renderPage } from './page.js';
import { mountSwarm } from './swarm.js';
import { mountSearch } from './search.js';
import { renderStatement } from './statement.js';
import { saveImage } from './share.js';
import { tipping, stateTiles } from './charts.js';
import { SITE } from './site.js';

const FOCUS = [
  ['all', 'All hospitals', null],
  ['340b', '340B hospitals', (x) => x.status === '340b'],
  ['proprietary', 'For-profit', (x) => x.status === 'proprietary'],
  ['exempt', 'Rural sole community', (x) => x.status === 'exempt'],
];

function boot() {
  const data = decode(JSON.parse(document.getElementById('swap-data').textContent));
  const root = document.getElementById('root');
  root.replaceChildren(renderPage(data));

  const slot = document.getElementById('statement-slot');
  let swarm = null;
  let search = null;

  function select(x, { scroll = true, fromHash = false } = {}) {
    if (!x) return;
    const msg = () => slot.querySelector('.st-status-msg');
    slot.replaceChildren(renderStatement(x, data, {
      onCopy: async () => {
        const url = `${location.origin}${location.pathname}#${x.ccn}`;
        try {
          await navigator.clipboard.writeText(url);
          msg().textContent = 'Link copied.';
        } catch {
          msg().textContent = url;
        }
      },
      onSave: async () => {
        msg().textContent = 'Saving image…';
        try {
          await saveImage(x, SITE.url);
          msg().textContent = 'Image saved.';
        } catch {
          msg().textContent = 'Couldn’t make the image in this browser.';
        }
      },
    }));
    swarm?.select(x);
    search?.setValue(x.name);
    if (!fromHash) history.replaceState(null, '', `#${x.ccn}`);
    if (scroll) slot.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  const swarmEl = document.getElementById('swarm');
  swarmEl.replaceChildren();
  swarm = mountSwarm(swarmEl, data, { onSelect: (x) => select(x) });
  search = mountSearch(document.getElementById('find-slot'), data, { onSelect: (x) => select(x) });

  const focus = document.getElementById('focus');
  focus.append(...FOCUS.map(([k, label, fn], i) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(i === 0),
    onclick: (e) => {
      for (const b of focus.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      swarm.setFocus(fn);
    },
  }, label, k === 'all' ? null : h('span', { class: 'chip-n' }, ` ${data.totals.status[k]?.n ?? 0}`))));

  const tp = document.getElementById('tipping-slot');
  tp.replaceChildren();
  tipping(tp, data);
  stateTiles(document.getElementById('states-slot'), data);

  const fromHash = () => {
    const ccn = decodeURIComponent(location.hash.slice(1)).trim();
    if (/^[0-9A-Z]{6}$/.test(ccn) && data.byCcn.has(ccn)) select(data.byCcn.get(ccn), { fromHash: true });
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
