// The explainer's static figures (the national ledger, CMS's group results, where the raise goes, the state table) and
// the rate control that drives the story's scatter.
import { h } from './dom.js';
import { money, moneyShort, pct, count, stateName } from './format.js';
import { cutRate, GROUPS } from './data.js';
// ---------------------------------------------------------------------------------------------------------------------
// 1. The ledger: $14.5B of 340B drug payments lose $4.65B; $62B of everything else gains it.
export function ledger(data) {
  const T = data.totals;
  const cut = data.meta.constants.targetCut;
  const max = T.nonDrugBase + cut;
  const w = (v) => `${(100 * v) / max}%`;
  return h('figure', { class: 'ledger' },
    h('div', { class: 'lg-row' },
      h('p', { class: 'lg-label' }, h('strong', null, '340B drugs'), ` About ${money(T.drugBase340b, { digits: 1 })} a year at ASP + 6%`),
      h('div', { class: 'lg-track' },
        h('span', { class: 'lg-seg keep', style: { width: w(T.drugBase340b - cut) } }),
        h('span', { class: 'lg-seg loss', style: { width: w(cut) } }, h('span', { class: 'lg-in' }, `${money(-cut)}`)))),
    h('div', { class: 'lg-row' },
      h('p', { class: 'lg-label' }, h('strong', null, 'Everything else'), ` About ${money(T.nonDrugBase, { digits: 0 })} a year: visits, imaging, surgery, tests`),
      h('div', { class: 'lg-track' },
        h('span', { class: 'lg-seg keep', style: { width: w(T.nonDrugBase) } }),
        h('span', { class: 'lg-seg gain', style: { width: w(cut) } }, h('span', { class: 'lg-in' }, `+${money(cut).slice(0)}`)))),
    h('figcaption', null,
      'Both bars on one scale. The cut is 32% of each 340B drug dollar (ASP − 28% is 32% less than ASP + 6%); the raise is 7.5% of '
      + 'everything else. The two base amounts are worked back from CMS’s own figures: $4.65 billion ÷ 32.08% and $4.65 billion ÷ 7.5%.'));
}


// ---------------------------------------------------------------------------------------------------------------------
// 2. The tipping point: modeled 340B drug share (x) against the change (y), with a slider for the 340B rate.
const PRESETS = [
  { d: -0.06, label: 'No cut', note: 'ASP + 6%, the 2023–2026 rate' },
  { d: 0.225, label: 'ASP − 22.5%', note: 'the 2018–2022 rate the Supreme Court struck down' },
  { d: 0.28, label: 'ASP − 28%', note: 'the final 2027 rate' },
  { d: 0.334, label: 'ASP − 33.4%', note: 'CMS’s survey result and July proposal' },
];


// The rate slider for the scatter step. `onRate(discount)` returns the hospitals' new changes (percent).
export function rateControl(data, onRate) {
  const C = data.meta.constants;
  const out = h('p', { class: 'tp-out', id: 'rate-out', role: 'status', 'aria-live': 'polite' });
  const slider = h('input', { type: 'range', min: '-6', max: '40', step: '0.1', value: String(100 * C.discount), id: 'rate', class: 'tp-range',
    'aria-describedby': 'rate-out' });
  const rateText = h('strong', { class: 'tp-rate' }, 'ASP − 28%');
  const presets = h('div', { class: 'tp-presets', role: 'group', 'aria-label': 'Rates CMS has used or considered' },
    PRESETS.map((p) => h('button', { type: 'button', class: 'chip', 'data-d': String(p.d), title: p.note,
      onclick: () => { slider.value = String(100 * p.d); update(); } }, p.label)));
  function update() {
    const d = Number(slider.value) / 100;
    const ys = onRate(d);
    const losers = ys.filter((v) => v < 0).length;
    const cr = cutRate(C, d);
    rateText.textContent = d < 0 ? `ASP + ${Math.round(-d * 1000) / 10}%` : `ASP − ${Math.round(d * 1000) / 10}%`;
    out.textContent = cr > 0
      ? `${count(losers)} hospitals get less. Everything else gets ${(100 * C.gain * (cr / C.cut)).toFixed(1)}% more. The break-even line doesn’t move: a deeper cut buys a bigger raise.`
      : `No 340B cut and no raise: ${count(losers)} hospitals still get less from the rule’s other changes.`;
    for (const b of presets.children) b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.d) - d) < 0.0005));
  }
  let pending = false;
  slider.addEventListener('input', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  });
  const el = h('div', { class: 'tp-controls' }, h('label', { for: 'rate', class: 'tp-label' }, 'Medicare pays 340B drugs at ', rateText),
    slider, presets, out);
  return { el, update, reset() { slider.value = String(100 * C.discount); update(); } };
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. CMS's own 340B effect by hospital group (Table 112, column 4). Not modeled.
const T112_GROUPS = [
  ['PROP', 'For-profit'],
  ['RSCH', 'Rural sole community'],
  ['UB0-99', 'Urban, under 100 beds'],
  ['NONTEACH', 'Non-teaching'],
  ['VOL', 'Nonprofit'],
  ['GOV', 'Government'],
  ['MAJOR', 'Major teaching'],
  ['UB500+', 'Urban, 500+ beds'],
  ['DSH35+', 'Low-income share 35%+'],
];

export function groupBars(data) {
  const T = data.meta.table112;
  const vals = T112_GROUPS.map(([k, label]) => ({ k, label, n: T[k][0], v: T[k][1] }));
  const lim = Math.max(...vals.map((x) => Math.abs(x.v)));
  return h('figure', { class: 'gb' },
    h('div', { class: 'gb-rows', role: 'table', 'aria-label': 'CMS estimate of the 340B change by hospital group' },
      vals.map((x) => h('div', { class: 'gb-row', role: 'row' },
        h('span', { class: 'gb-label', role: 'rowheader' }, x.label, h('span', { class: 'gb-n' }, ` ${count(x.n)} hospitals`)),
        h('span', { class: 'gb-track', 'aria-hidden': 'true' },
          h('span', { class: `gb-bar ${x.v < 0 ? 'loss' : 'gain'}`, style: x.v < 0
            ? { right: '50%', width: `${(50 * -x.v) / lim}%` } : { left: '50%', width: `${(50 * x.v) / lim}%` } })),
        h('span', { class: 'gb-v', role: 'cell' }, pct(x.v))))),
    h('figcaption', null, 'CMS’s estimate of the 340B change alone (drug cut plus the raise), as a share of each group’s 2026 outpatient '
      + 'payments. CY 2027 OPPS final rule, Table 112, column 4. Low-income share is the Medicare DSH patient percentage.'));
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Where the $4.65B raise lands (modeled): the tall segmented bar.
export function raiseBar(data) {
  const parts = GROUPS.map((g) => [g.label, data.totals.groups[g.key]]);
  return h('figure', { class: 'rb' },
    h('div', { class: 'rb-bar', role: 'img', 'aria-label': parts.map(([l, s]) => `${l}: ${Math.round(100 * s.raiseShare)}%`).join('; ') },
      parts.map(([, s], i) => h('span', { class: `rb-seg s${i}`, style: { width: `${100 * s.raiseShare}%` } }))),
    h('ul', { class: 'rb-legend' }, parts.map(([l, s], i) => h('li', null,
      h('span', { class: `rb-key s${i}`, 'aria-hidden': 'true' }),
      h('strong', null, `${Math.round(100 * s.raiseShare)}%`), ` ${l} (${count(s.n)})`))),
    h('figcaption', null, 'Share of the 7.5% raise each group receives, modeled from each hospital’s non-drug payments. '
      + '340B hospitals here are those on HRSA’s 340B list at any time in 2025, the claims year CMS modeled.'));
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Every state as a table (the dot map's text equivalent).
export function stateTable(data) {
  const rows = data.totals.states;
  return h('details', { class: 'more' }, h('summary', null, 'Every state as a table'),
    h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['State', 'Hospitals', 'In 340B', 'Get less', '340B parts', 'Every change'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.map((s) => h('tr', null, h('th', { scope: 'row' }, stateName(s.st)), h('td', null, count(s.n)), h('td', null, count(s.n340)),
        h('td', null, count(s.losers)),
        h('td', null, `${moneyShort(s.part, { sign: true })} (${pct((100 * s.part) / s.m)})`),
        h('td', null, `${moneyShort(s.net, { sign: true })} (${pct((100 * s.net) / s.m)})`))))));
}
