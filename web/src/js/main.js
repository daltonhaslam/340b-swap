import { decode } from './data.js';
import { renderPage } from './page.js';
import { mountStory } from './story.js';
import { mountSearch } from './search.js';
import { renderStatement } from './statement.js';
import { saveImage } from './share.js';
import { rateControl } from './charts.js';
import { SITE } from './site.js';

const CCN = /^[0-9A-Z]{6}$/;

function boot() {
  const data = decode(JSON.parse(document.getElementById('swap-data').textContent));
  document.getElementById('root').replaceChildren(renderPage(data));

  const drawer = document.getElementById('drawer');
  const slot = document.getElementById('statement-slot');
  let lastFocus = null;
  const field = document.getElementById('field');
  field.replaceChildren();
  const story = mountStory(field, data, { onSelect: (x) => select(x) });
  const search = mountSearch(document.getElementById('find-slot'), data, { onSelect: (x) => select(x) });

  function close() {
    drawer.hidden = true;
    story.select(null);
    history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus?.isConnected) lastFocus.focus();
  }

  function select(x, { fromHash = false } = {}) {
    if (!x) return;
    lastFocus = document.activeElement;
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
    drawer.hidden = false;
    drawer.scrollTop = 0;
    story.select(x);
    search.setValue(x.name);
    if (!fromHash) history.replaceState(null, '', `#${x.ccn}`);
    document.getElementById('st-name')?.setAttribute('tabindex', '-1');
    document.getElementById('st-name')?.focus({ preventScroll: true });
  }

  document.getElementById('drawer-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });
  document.getElementById('focus-find')?.addEventListener('click', () => search.input.focus());

  // The rate slider lives in the scatter step and moves the field's dots.
  const rate = rateControl(data, (d) => story.setDiscount(d));
  document.getElementById('rate-slot').append(rate.el);
  rate.update();

  // Scroll steps: the step crossing the middle of the viewport sets the field's layout.
  const steps = [...document.querySelectorAll('.step')];
  let active = null;
  const activate = (el) => {
    if (el === active) return;
    active = el;
    for (const s of steps) s.classList.toggle('is-active', s === el);
    const mode = el.dataset.mode;
    if (mode !== 'scatter') { story.setDiscount(0.28); rate.reset(); }
    story.go(mode);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) activate(e.target);
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  story.start(steps[0].dataset.mode);
  active = steps[0];
  steps[0].classList.add('is-active');

  const fromHash = () => {
    let ccn = '';
    try { ccn = decodeURIComponent(location.hash.slice(1)).trim(); } catch { return; }
    if (CCN.test(ccn) && data.byCcn.has(ccn)) select(data.byCcn.get(ccn), { fromHash: true });
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
