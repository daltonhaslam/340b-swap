// The explainer's figures: the national ledger, the tipping-point scatter with its rate slider, CMS's group results,
// where the raise goes, and the state tiles.
import { h, palette, sizeCanvas, makeTip } from './dom.js';
import { money, moneyShort, pct, count, stateName } from './format.js';
import { whatIf, breakevenAt, cutRate } from './data.js';


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

export function tipping(root, data) {
  const hs = data.hospitals;
  const C = data.meta.constants;
  const canvas = h('canvas', { class: 'tp-canvas', role: 'img',
    'aria-label': 'Scatter plot: each hospital’s modeled 340B drug share against its change in 2027 payments. Hospitals above about one-fifth in 340B drugs mostly lose.' });
  const out = h('p', { class: 'tp-out', role: 'status', 'aria-live': 'polite' });
  const slider = h('input', { type: 'range', min: '-6', max: '40', step: '0.1', value: '28', id: 'rate', class: 'tp-range',
    'aria-describedby': 'rate-out' });
  out.id = 'rate-out';
  const label = h('label', { for: 'rate', class: 'tp-label' }, 'Medicare pays 340B drugs at ', h('strong', { class: 'tp-rate' }, 'ASP − 28%'));
  const presets = h('div', { class: 'tp-presets', role: 'group', 'aria-label': 'Rates CMS has used or considered' },
    PRESETS.map((p) => h('button', { type: 'button', class: 'chip', 'data-d': String(p.d), title: p.note,
      onclick: () => { slider.value = String(100 * p.d); update(); } }, p.label)));
  const wrap = h('div', { class: 'tp-wrap' }, canvas);
  const tip = makeTip(wrap);
  const COLORS = ['ink', 'ink-2', 'ink-3', 'rule', 'rule-strong', 'gain', 'loss', 'font-display'];
  let colors = palette(root, COLORS);
  root.append(h('div', { class: 'tp-controls' }, label, slider, presets), out, wrap,
    h('p', { class: 'tp-axis-note' }, 'Across: share of the hospital’s 2026 Medicare outpatient payments that are 340B drugs (modeled). '
      + 'Up and down: change in 2027 payments, CMS’s estimate with the 340B part rescaled to the chosen rate.'));

  const XMAX = 0.7;
  const YLO = -35;
  const YHI = 30;
  const S = { w: 0, h: 0, y: hs.map((x) => x.netPct), d: 0.28, hover: -1 };

  function size() {
    const w = Math.round(wrap.clientWidth);
    if (!w) return false;
    const H = Math.round(Math.min(460, Math.max(300, w * 0.55)));
    Object.assign(S, { w, h: H, dpr: sizeCanvas(canvas, w, H), pad: { l: 58, r: 14, t: 14, b: 30 } });
    return true;
  }
  const X = (b) => S.pad.l + (Math.min(b, XMAX) / XMAX) * (S.w - S.pad.l - S.pad.r);
  const Y = (v) => S.pad.t + ((YHI - Math.min(YHI, Math.max(YLO, v))) / (YHI - YLO)) * (S.h - S.pad.t - S.pad.b);

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);
    const { 'ink-3': ink3, rule, gain, loss } = colors;
    ctx.font = `12px ${colors['font-display']}`;
    ctx.fillStyle = ink3;
    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    for (const t of [-30, -20, -10, 0, 10, 20, 30]) {
      const y = Math.round(Y(t)) + 0.5;
      ctx.strokeStyle = t === 0 ? colors['rule-strong'] : rule;
      ctx.beginPath(); ctx.moveTo(S.pad.l, y); ctx.lineTo(S.w - S.pad.r, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(t === 0 ? '0' : pct(t, { digits: 0 }), S.pad.l - 6, y + 4);
    }
    ctx.textAlign = 'center';
    for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) ctx.fillText(`${Math.round(t * 100)}%`, X(t), S.h - 10);
    // The break-even line for this rate.
    const be = breakevenAt(data, S.d);
    if (be < XMAX) {
      const x = Math.round(X(be)) + 0.5;
      ctx.strokeStyle = colors['ink-2'];
      ctx.beginPath(); ctx.moveTo(x, S.pad.t); ctx.lineTo(x, S.h - S.pad.b); ctx.stroke();
      ctx.textAlign = be > 0.45 ? 'right' : 'left';
      ctx.fillStyle = colors.ink;
      ctx.fillText(`Break-even: ${Math.round(be * 100)}%`, x + (be > 0.45 ? -6 : 6), S.pad.t + 12);
    }
    for (let i = 0; i < hs.length; i += 1) {
      const v = S.y[i];
      ctx.fillStyle = v < 0 ? loss : gain;
      ctx.globalAlpha = hs[i].b > 0 ? 0.75 : 0.35;
      ctx.beginPath();
      ctx.arc(X(hs[i].b) + (hs[i].b > 0 ? 0 : (i * 7919) % 11), Y(v), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (S.hover >= 0) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(hs[S.hover].b), Y(S.y[S.hover]), 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function update() {
    S.d = Number(slider.value) / 100;
    S.y = whatIf(data, S.d);
    const losers = S.y.filter((v) => v < 0).length;
    const cr = cutRate(C, S.d);
    const raise = 100 * C.gain * (cr / C.cut);
    const rate = S.d < 0 ? `ASP + ${Math.round(-S.d * 1000) / 10}%` : `ASP − ${Math.round(S.d * 1000) / 10}%`;
    label.querySelector('.tp-rate').textContent = rate;
    out.textContent = cr > 0
      ? `${count(losers)} hospitals get less. Everything else gets ${raise.toFixed(1)}% more. A hospital whose drugs are all 340B breaks even at ${Math.round(100 * breakevenAt(data, S.d))}% of payments.`
      : `No 340B cut and no raise: ${count(losers)} hospitals still get less from the rule’s other changes.`;
    for (const b of presets.children) b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.d) - S.d) < 0.0005));
    draw();
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best = -1;
    let bd = 64;
    for (let i = 0; i < hs.length; i += 1) {
      if (hs[i].b <= 0) continue;
      const dd = (X(hs[i].b) - px) ** 2 + (Y(S.y[i]) - py) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best === S.hover) return;
    S.hover = best;
    if (best >= 0) {
      const x = hs[best];
      tip.show(px, py, h('strong', null, x.name), h('span', null, `${stateName(x.st)}. 340B drugs ≈ ${Math.round(100 * x.b)}% of payments`),
        h('span', { class: S.y[best] < 0 ? 'neg' : 'pos' }, pct(S.y[best])));
    } else tip.hide();
    draw();
  });
  canvas.addEventListener('pointerleave', () => { S.hover = -1; tip.hide(); draw(); });
  let pending = false;
  slider.addEventListener('input', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  });
  new ResizeObserver(() => { if (size()) draw(); }).observe(wrap);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors = palette(root, COLORS); draw(); });
  if (size()) update();
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. CMS's own 340B effect by hospital group (Table 112, column 4). Not modeled.
const GROUPS = [
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
  const vals = GROUPS.map(([k, label]) => ({ k, label, n: T[k][0], v: T[k][1] }));
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
  const S = data.totals.status;
  const parts = [
    ['340B hospitals', S.in340],
    ['Other nonprofit and public hospitals', S.other],
    ['Rural sole community hospitals', S.exempt],
    ['For-profit hospitals', S.proprietary],
  ];
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
// 5. States as tiles. Color = the 340B part (drug cut, raise and offset) as a share of the state's 2026 payments.
const TILES = {
  AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], WI: [6, 2], MI: [8, 2], NY: [9, 2], MA: [10, 2], RI: [11, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IL: [6, 3], IN: [7, 3], OH: [8, 3], PA: [9, 3], NJ: [10, 3], CT: [11, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7], PR: [11, 7],
};

export function stateTiles(root, data) {
  const by = new Map();
  for (const x of data.hospitals) {
    const s = by.get(x.st) || { st: x.st, n: 0, n340: 0, m: 0, part: 0, net: 0, losers: 0 };
    s.n += 1; s.m += x.m; s.part += x.cut + x.gain + x.off; s.net += x.net;
    if (x.status === '340b') s.n340 += 1;
    if (x.net < 0) s.losers += 1;
    by.set(x.st, s);
  }
  const mode = { key: 'part' };
  const grid = h('div', { class: 'tiles', role: 'group', 'aria-label': 'States' });
  const toggle = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'What the color shows' },
    [['part', 'The 340B parts only'], ['net', 'Every 2027 change']].map(([k, l]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(k === mode.key), class: 'seg-b',
      onclick: (e) => { mode.key = k; for (const b of toggle.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); paint(); },
    }, l)));
  const legend = h('div', { class: 'tiles-legend', 'aria-hidden': 'true' },
    h('span', null, 'Loses 6%+'), h('span', { class: 'tiles-ramp' }), h('span', null, 'Gains 6%+'));
  const table = h('table', { class: 'data-table' });
  const tilesWrap = h('div', { class: 'tiles-wrap' }, grid);
  const tip = makeTip(tilesWrap);
  root.append(toggle, tilesWrap, legend,
    h('details', { class: 'more' }, h('summary', null, 'Every state as a table'), table));

  function colorFor(v) {
    // Diverging: loss <- neutral -> gain, saturating at 6%.
    const t = Math.max(-1, Math.min(1, v / 6));
    return t < 0 ? `color-mix(in oklab, var(--loss) ${Math.round(-t * 100)}%, var(--paper-raised))`
      : `color-mix(in oklab, var(--gain) ${Math.round(t * 100)}%, var(--paper-raised))`;
  }

  function paint() {
    const val = (s) => (100 * s[mode.key]) / s.m;
    grid.replaceChildren(...Object.entries(TILES).map(([st, [c, r]]) => {
      const s = by.get(st);
      const v = s ? val(s) : null;
      return h('button', {
        type: 'button', class: `tile${s ? '' : ' none'}`, style: { gridColumn: c + 1, gridRow: r + 1, background: s ? colorFor(v) : null },
        'aria-label': s ? `${stateName(st)}: ${pct(v)}, ${money(s[mode.key], { sign: true })}, ${s.n} hospitals` : `${stateName(st)}: no hospitals in CMS’s estimate`,
        onpointerenter: (e) => s && show(e.currentTarget, s, v), onfocus: (e) => s && show(e.currentTarget, s, v),
        onpointerleave: () => tip.hide(), onblur: () => tip.hide(),
      }, h('span', { class: 'tile-st' }, st), s ? h('span', { class: 'tile-v' }, pct(v, { digits: 0 })) : null);
    }));
    const rows = [...by.values()].sort((a, b) => val(a) - val(b));
    table.replaceChildren(h('thead', null, h('tr', null, ['State', 'Hospitals', '340B hospitals', '340B parts', 'Every change'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.map((s) => h('tr', null, h('th', { scope: 'row' }, stateName(s.st)), h('td', null, count(s.n)), h('td', null, count(s.n340)),
        h('td', null, `${moneyShort(s.part, { sign: true })} (${pct((100 * s.part) / s.m)})`), h('td', null, `${moneyShort(s.net, { sign: true })} (${pct((100 * s.net) / s.m)})`)))));
  }

  function show(el, s, v) {
    tip.replaceChildren(h('strong', null, stateName(s.st)),
      h('span', null, `${count(s.n)} hospitals, ${count(s.n340)} in 340B`),
      h('span', { class: v < 0 ? 'neg' : 'pos' }, `${money(s[mode.key], { sign: true })} (${pct(v)})`),
      h('span', null, `${count(s.losers)} get less overall`));
    const r = el.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    tip.style.left = `${r.left - g.left + r.width / 2}px`;
    tip.style.top = `${r.top - g.top}px`;
    tip.hidden = false;
  }
  paint();
}
