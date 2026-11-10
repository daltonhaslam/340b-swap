// One hospital's 2027 statement: the four parts of the change, as line items that add up to CMS's estimate.
// Laid out like a remittance stub on green-bar paper, with each line's step drawn as a bar.
import { h } from './dom.js';
import { money, pct, stateName } from './format.js';

const TYPE = {
  DSH: 'disproportionate share hospital',
  RRC: 'rural referral center',
  SCH: 'sole community hospital',
  CAN: 'cancer hospital',
  PED: "children's hospital",
};

export function statusLine(x) {
  switch (x.status) {
    case '340b': return x.opSched
      ? `340B hospital: in 340B during 2025, and HRSA lists a new registration as a ${TYPE[x.opType] || 'hospital'} starting Jan. 1, 2027.`
      : `340B hospital: HRSA lists it as a participating ${TYPE[x.opType] || 'hospital'}${x.opStart ? ` (current registration since ${x.opStart})` : ''}.`;
    case 'new': return 'On HRSA’s 340B list as of Nov. 5, 2026, but not in 340B during 2025, the year of claims CMS used, so CMS’s estimate has no drug cut for it. If its status holds on Jan. 1, its actual 2027 will differ from CMS’s estimate.';
    case 'left': return 'In 340B during 2025, the year of claims CMS used, but not on HRSA’s 340B list as of Nov. 5, 2026. CMS’s estimate still includes a drug cut for it; if its status holds on Jan. 1, its actual 2027 will differ from that estimate.';
    case 'history': return 'Billed Medicare for 340B drugs in 2018–2022 (CMS remedy file), but not in 340B during 2025 or on HRSA’s list as of Nov. 5, 2026.';
    case 'exempt': return 'Rural sole community hospital: exempt from the 340B drug cut.';
    case 'proprietary': return 'For-profit hospital: not eligible for 340B.';
    default: return 'Not a 340B hospital in HRSA or CMS records.';
  }
}

export function verdict(x) {
  const lessOrMore = x.net < 0 ? 'CMS estimates it gets less in 2027.' : 'CMS estimates it gets more in 2027.';
  if (x.net < 0) {
    if (x.cut < 0 && -x.cut > x.gain) {
      return `${lessOrMore} In this site’s model, its 340B drug cut (${money(x.cut)}) is bigger than its 7.5% raise on everything else (${money(x.gain, { sign: true })}).`;
    }
    return `${lessOrMore} In this site’s model, not mainly because of 340B: the rule's other changes${x.offset ? ' and the remedy offset' : ''} outweigh the raise.`;
  }
  if (x.cut < 0) {
    return `${lessOrMore} In this site’s model, even after its 340B drug cut (${money(x.cut)}), the 7.5% raise on everything else (${money(x.gain, { sign: true })}) wins.`;
  }
  if (x.status === 'exempt') return `${lessOrMore} Rural sole community hospitals keep full drug payments and still get the 7.5% raise.`;
  if (x.status === 'proprietary') return `${lessOrMore} For-profit hospitals can't join 340B, so there is no drug cut, only the raise.`;
  return `${lessOrMore} No 340B drug cut, so the raise carries it.`;
}

function lines(x, C) {
  const cutLo = -C.cut * x.bHi * x.m;
  const cutHi = -C.cut * x.bLo * x.m;
  const range = x.cut < 0 && Math.abs(cutLo - cutHi) > Math.max(1e5, 0.05 * Math.abs(x.cut))
    ? ` Likely between ${money(cutLo)} and ${money(cutHi)}.` : '';
  return [
    {
      key: 'cut', label: '340B drugs paid at ASP − 28%, not ASP + 6%', value: x.cut, kind: 'loss',
      note: x.cut < 0
        ? `Modeled: about ${Math.round(100 * x.b)}% of its 2026 outpatient payments are 340B drugs.${range}`
        : (x.status === 'exempt' ? 'Exempt.' : 'No 340B drugs.'),
    },
    {
      key: 'gain', label: 'Everything that isn’t a separately paid drug, paid 7.5% more', value: x.gain, kind: 'gain',
      note: `Modeled from its cost report: about ${Math.round(100 * (1 - x.s))}% of its payments.`,
    },
    {
      key: 'off', label: '340B remedy offset: 2 points off the 2027 update', value: x.off, kind: 'loss',
      note: x.offset ? 'On CMS’s list (Addendum R). CMS’s estimate takes 2% off the whole payment.'
        : 'Not on CMS’s list. Hospitals that began billing Medicare after Jan. 1, 2018 are exempt.',
    },
    {
      key: 'other', label: 'All the rule’s other changes', value: x.other, kind: x.other < 0 ? 'loss' : 'gain', muted: true,
      note: 'The 2.3% update, wage index, service weights, imaging, outliers: the rest of CMS’s estimate.',
    },
  ];
}

function bars(items, net, m) {
  // Each line's bar runs from the running total before it to the running total after it.
  let run = 0;
  const steps = items.map((it) => { const a = run; run += it.value; return [a, run]; });
  const xs = steps.flat().concat([0, net]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo || 1;
  const pos = (v) => (100 * (v - lo)) / span;
  return { steps, pos, zero: pos(0), m };
}

export function renderStatement(x, data, { onCopy, onSave } = {}) {
  const C = data.meta.constants;
  const items = lines(x, C);
  const B = bars(items, x.net, x.m);
  const place = [x.city, stateName(x.st)].filter(Boolean).join(', ');
  const row = (it, i) => {
    const [a, b] = B.steps[i];
    const left = Math.min(B.pos(a), B.pos(b));
    const width = Math.max(0.4, Math.abs(B.pos(b) - B.pos(a)));
    return h('div', { class: `st-row${it.muted ? ' muted' : ''}`, role: 'row' },
      h('div', { class: 'st-label', role: 'rowheader' }, h('span', { class: 'st-what' }, it.label), h('span', { class: 'st-note' }, it.note)),
      h('div', { class: 'st-bar', 'aria-hidden': 'true' },
        h('span', { class: 'st-zero', style: { left: `${B.zero}%` } }),
        Math.abs(it.value) >= 1 ? h('span', { class: `st-seg ${it.kind}${it.key === 'off' ? ' hatch' : ''}`, style: { left: `${left}%`, width: `${width}%` } }) : null),
      h('div', { class: 'st-amt', role: 'cell' }, money(it.value, { sign: true })),
      h('div', { class: 'st-pct', role: 'cell' }, x.m > 0 ? pct((100 * it.value) / x.m) : ''));
  };
  const netLeft = Math.min(B.pos(0), B.pos(x.net));
  const prop = x.pNet == null ? null
    : `Under the July proposal (ASP − 33.4%, a 3-point offset), CMS estimated ${pct(x.pNet)}.`;
  return h('article', { class: 'statement', 'aria-labelledby': 'st-name' },
    h('header', { class: 'st-head' },
      h('div', null,
        h('h3', { id: 'st-name' }, x.name),
        h('p', { class: 'st-place' }, place),
        h('p', { class: 'st-ids' }, `Medicare CCN ${x.ccn}`)),
      h('p', { class: `st-big ${x.net < 0 ? 'neg' : 'pos'}` },
        h('span', { class: 'st-big-n' }, pct(x.netPct)),
        h('span', { class: 'st-big-l' }, `${money(x.net, { sign: true })} in 2027`))),
    h('p', { class: 'st-verdict' }, verdict(x)),
    h('p', { class: 'st-status' }, statusLine(x)),
    h('div', { class: 'st-table', role: 'table', 'aria-label': `How ${x.name}'s 2027 change adds up` },
      h('div', { class: 'st-row st-colhead', role: 'row' },
        h('div', { role: 'columnheader' }, 'What changes'), h('div', { 'aria-hidden': 'true' }),
        h('div', { role: 'columnheader' }, 'Dollars'), h('div', { role: 'columnheader' }, '% of 2026')),
      items.map(row),
      h('div', { class: 'st-row st-total', role: 'row' },
        h('div', { class: 'st-label', role: 'rowheader' }, h('span', { class: 'st-what' }, 'CMS’s estimate of the change'),
          h('span', { class: 'st-note' }, `${money(x.m)} in 2026 to ${money(x.n)} in 2027.`)),
        h('div', { class: 'st-bar', 'aria-hidden': 'true' },
          h('span', { class: 'st-zero', style: { left: `${B.zero}%` } }),
          h('span', { class: `st-seg ${x.net < 0 ? 'loss' : 'gain'} solid`, style: { left: `${netLeft}%`, width: `${Math.max(0.4, Math.abs(B.pos(x.net) - B.pos(0)))}%` } })),
        h('div', { class: 'st-amt', role: 'cell' }, money(x.net, { sign: true })),
        h('div', { class: 'st-pct', role: 'cell' }, pct(x.netPct)))),
    h('footer', { class: 'st-foot' },
      h('p', null, 'The total is CMS’s. The first three lines are this site’s model of how it splits; the last line is whatever is left.'
        + ' Dollars are Medicare payments plus patient copays, simulated by CMS from 2025 claims.'),
      prop ? h('p', null, prop) : null,
      h('div', { class: 'st-actions' },
        onCopy ? h('button', { type: 'button', class: 'btn', onclick: onCopy }, 'Copy link to this hospital') : null,
        onSave ? h('button', { type: 'button', class: 'btn', onclick: onSave }, 'Save as image') : null,
        h('span', { class: 'st-status-msg', role: 'status', 'aria-live': 'polite' }))));
}
