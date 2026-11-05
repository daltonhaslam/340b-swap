// The field: all 3,502 hospitals as dots on one sticky canvas that rearranges as the reader scrolls through the story.
// Layouts: 'swarm' (by CMS's net change), 'rows' (the same, split by kind of hospital), 'scatter' (modeled 340B drug
// share against the change, with the rate slider), 'states' (each state's hospitals as a strip, states ranked).
import { h, palette, sizeCanvas, makeTip } from './dom.js';
import { pct, count, stateName } from './format.js';
import { whatIf, GROUPS } from './data.js';

const LO = -30;
const HI = 30;
const COLORS = ['gain', 'loss', 'neutral', 'ink', 'ink-2', 'ink-3', 'rule', 'rule-strong', 'paper', 'font-display'];


const clampV = (v) => Math.min(HI, Math.max(LO, v));

// Symmetric dot plot of `idx` (indices into values) across [x0, x0 + w], centered on cy, dot pitch d.
function stack(values, idx, x0, w, cy, d, xs, ys) {
  const ncol = Math.max(1, Math.floor(w / d));
  const cols = new Map();
  for (const i of idx) {
    const c = Math.min(ncol - 1, Math.max(0, Math.floor(((clampV(values[i]) - LO) / (HI - LO)) * ncol)));
    if (!cols.has(c)) cols.set(c, []);
    cols.get(c).push(i);
  }
  let max = 0;
  for (const [c, list] of cols) {
    list.sort((a, b) => values[a] - values[b]);
    list.forEach((i, k) => {
      xs[i] = x0 + (c + 0.5) * (w / ncol);
      ys[i] = cy + (k === 0 ? 0 : Math.ceil(k / 2) * (k % 2 ? -1 : 1)) * d;
    });
    max = Math.max(max, list.length);
  }
  return max;
}

function maxColumn(values, idx, w, d) {
  const ncol = Math.max(1, Math.floor(w / d));
  const n = new Uint16Array(ncol);
  let max = 0;
  for (const i of idx) {
    const c = Math.min(ncol - 1, Math.max(0, Math.floor(((clampV(values[i]) - LO) / (HI - LO)) * ncol)));
    n[c] += 1;
    if (n[c] > max) max = n[c];
  }
  return max;
}

// Largest dot pitch at which every group's tallest column fits its share of the height.
function fitPitch(values, groups, w, hAvail) {
  let d = Math.min(7, Math.max(2.2, w / 150));
  while (d > 1.0) {
    const need = groups.reduce((s, g) => s + maxColumn(values, g, w, d) * d, 0);
    if (need <= hAvail) break;
    d *= 0.95;
  }
  return d;
}

export function mountStory(field, data, { onSelect }) {
  const hs = data.hospitals;
  const N = hs.length;
  const canvas = h('canvas', { class: 'field-canvas', role: 'img', 'aria-label': '' });
  const legend = h('div', { class: 'field-legend', 'aria-hidden': 'true' },
    h('span', { class: 'lg-dot neg' }), 'Gets less in 2027', h('span', { class: 'lg-dot pos' }), 'Gets more');
  field.append(canvas, legend);
  const tip = makeTip(field);
  let colors = palette(field, COLORS);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = {
    w: 0, h: 0, dpr: 1, mode: null, values: null, discount: data.meta.constants.discount,
    t0: 0, dur: 1100, anim: false,
    x: new Float32Array(N), y: new Float32Array(N), r: 2, r0: 2,
    tx: new Float32Array(N), ty: new Float32Array(N), tr: 2,
    fx: new Float32Array(N), fy: new Float32Array(N),
    overlay: null, hover: -1, selected: -1,
  };
  const delay = new Float32Array(N).map((_, i) => ((i * 7919) % 997) / 997);
  // Static groupings, built once: the rows' members and the states in rank order.
  const rowIdx = GROUPS.map((g) => hs.map((x, i) => (x.group === g.key ? i : -1)).filter((i) => i >= 0));
  const base = hs.map((x) => x.netPct);
  // Dots by color, rebuilt only when the values change (the rate slider), so a frame draws three plain loops.
  let byColor = null;
  function sortColors() {
    const loss = [];
    const gain = [];
    const zero = [];
    S.values.forEach((v, i) => (v < 0 ? loss : v > 0 ? gain : zero).push(i));
    byColor = [loss, gain, zero];
  }
  const C0 = data.meta.constants.discount;
  function applyValues(d, values) {
    const v = values || (d === C0 ? base : whatIf(data, d));
    if (v === S.values) return;
    S.values = v;
    sortColors();
  }
  S.values = base;
  sortColors();

  // ---- layouts ------------------------------------------------------------------------------------------------------
  function pad() { return { l: S.w < 600 ? 14 : 28, r: S.w < 600 ? 14 : 28, t: 30, b: 40 }; }

  function axisTicks(P, ticks) {
    const xOf = (v) => P.l + ((clampV(v) - LO) / (HI - LO)) * (S.w - P.l - P.r);
    return ticks.map((t) => ({ x: xOf(t), label: t === 0 ? 'No change' : pct(t, { digits: 0 }), zero: t === 0 }));
  }

  const LAYOUTS = {
    swarm() {
      const P = pad();
      const all = [...Array(N).keys()];
      const w = S.w - P.l - P.r;
      const d = fitPitch(S.values, [all], w, S.h - P.t - P.b);
      stack(S.values, all, P.l, w, P.t + (S.h - P.t - P.b) / 2, d, S.tx, S.ty);
      S.tr = Math.max(0.8, d / 2 - 0.3);
      return { kind: 'swarm', ticks: axisTicks(P, S.w < 560 ? [-20, 0, 20] : [-30, -20, -10, 0, 10, 20, 30]), top: P.t, bottom: S.h - P.b };
    },
    rows() {
      const P = { ...pad(), t: 20 };
      const w = S.w - P.l - P.r;
      const groups = rowIdx;
      const labelH = 22;
      const avail = S.h - P.t - P.b - labelH * groups.length - 6 * (groups.length - 1);
      const d = fitPitch(S.values, groups, w, avail);
      let y = P.t;
      const labels = [];
      groups.forEach((g, k) => {
        const hgt = maxColumn(S.values, g, w, d) * d;
        labels.push({ y: y + 14, text: GROUPS[k].label, n: g.length, losers: g.filter((i) => S.values[i] < 0).length });
        y += labelH;
        stack(S.values, g, P.l, w, y + hgt / 2, d, S.tx, S.ty);
        y += hgt + 6;
      });
      S.tr = Math.max(0.5, d / 2 - 0.2);
      return { kind: 'rows', labels, ticks: axisTicks(P, S.w < 560 ? [-20, 0, 20] : [-20, -10, 0, 10, 20]), top: P.t, bottom: y };
    },
    scatter() {
      const P = { l: S.w < 600 ? 44 : 56, r: 16, t: 24, b: 44 };
      const XMAX = 0.7;
      const YLO = -35;
      const YHI = 30;
      const X = (b) => P.l + (Math.min(b, XMAX) / XMAX) * (S.w - P.l - P.r);
      const Y = (v) => P.t + ((YHI - Math.min(YHI, Math.max(YLO, v))) / (YHI - YLO)) * (S.h - P.t - P.b);
      hs.forEach((x, i) => {
        S.tx[i] = X(x.b) + (x.b > 0 ? 0 : ((i * 7919) % 13) * 0.9);
        S.ty[i] = Y(S.values[i]);
      });
      S.tr = S.w < 600 ? 1.6 : 2.2;
      const be = data.totals.breakeven;
      return { kind: 'scatter', X, Y, P, be, yTicks: [-30, -20, -10, 0, 10, 20, 30], xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] };
    },
    states() {
      // A ranked ledger: two columns of state strips, from the biggest loser (CMS net, all changes) to the biggest
      // gainer. Each strip packs the state's hospitals in R rows, the ones that get less first.
      const P = { l: S.w < 600 ? 4 : 8, r: 8, t: 32, b: 12 };  // top band keeps the legend clear of the first rows
      const rows = data.totals.states.map((s) => ({ st: s.st, list: s.idx, pct: s.pct }));
      const per = Math.ceil(rows.length / 2);
      const gutter = S.w < 600 ? 10 : 24;
      const colW = (S.w - P.l - P.r - gutter) / 2;
      const labelW = S.w < 600 ? 52 : 74;
      const gap = S.w < 600 ? 3 : 6;
      const maxN = Math.max(...rows.map((r) => r.list.length));
      let best = { pitch: 0, R: 4 };
      for (let R = 2; R <= 10; R += 1) {
        const pw = (colW - labelW) / Math.ceil(maxN / R);
        const ph = (S.h - P.t - P.b - per * gap) / (per * R);
        const pitch = Math.min(pw, ph, 7);
        if (pitch > best.pitch) best = { pitch, R };
      }
      const { pitch, R } = best;
      const rowH = R * pitch + gap;
      const labels = [];
      rows.forEach((row, k) => {
        const col = k < per ? 0 : 1;
        const x0 = P.l + col * (colW + gutter);
        const y0 = P.t + (k % per) * rowH;
        labels.push({ st: row.st, pct: row.pct, x: x0, y: y0 + (R * pitch) / 2 + 4, n: row.list.length });
        row.list.forEach((i, j) => {
          S.tx[i] = x0 + labelW + (Math.floor(j / R) + 0.5) * pitch;
          S.ty[i] = y0 + (j % R + 0.5) * pitch;
        });
      });
      S.tr = Math.max(0.6, pitch * 0.4);
      return { kind: 'states', labels, labelW };
    },
  };

  // ---- drawing ------------------------------------------------------------------------------------------------------
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function drawOverlay(ctx, o, a) {
    if (!o || a <= 0) return;
    ctx.globalAlpha = a;
    ctx.font = `12px ${colors['font-display']}`;
    ctx.lineWidth = 1;
    if (o.ticks) {
      for (const t of o.ticks) {
        ctx.strokeStyle = t.zero ? colors['rule-strong'] : colors.rule;
        ctx.beginPath(); ctx.moveTo(Math.round(t.x) + 0.5, o.top - 8); ctx.lineTo(Math.round(t.x) + 0.5, o.bottom + 6); ctx.stroke();
        ctx.fillStyle = t.zero ? colors.ink : colors['ink-3'];
        ctx.textAlign = 'center';
        ctx.fillText(t.label, t.x, o.bottom + 22);
      }
    }
    if (o.kind === 'rows') {
      ctx.textAlign = 'left';
      for (const l of o.labels) {
        ctx.fillStyle = colors.ink;
        ctx.font = `600 13px ${colors['font-display']}`;
        ctx.fillText(l.text, pad().l, l.y);
        const wLabel = ctx.measureText(l.text).width;
        ctx.font = `12px ${colors['font-display']}`;
        ctx.fillStyle = colors['ink-3'];
        ctx.fillText(`  ${count(l.n)} hospitals, ${count(l.losers)} get less`, pad().l + wLabel, l.y);
      }
    }
    if (o.kind === 'scatter') {
      const { P, X, Y } = o;
      ctx.textAlign = 'right';
      for (const t of o.yTicks) {
        const y = Math.round(Y(t)) + 0.5;
        ctx.strokeStyle = t === 0 ? colors['rule-strong'] : colors.rule;
        ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(S.w - P.r, y); ctx.stroke();
        ctx.fillStyle = colors['ink-3'];
        ctx.fillText(t === 0 ? '0' : pct(t, { digits: 0 }), P.l - 6, y + 4);
      }
      ctx.textAlign = 'center';
      for (const t of o.xTicks) ctx.fillText(`${Math.round(t * 100)}%`, X(t), S.h - P.b + 18);
      ctx.fillStyle = colors['ink-2'];
      ctx.fillText(S.w < 600 ? '340B drug share of payments (modeled)' : '340B drugs as a share of the hospital’s outpatient payments (modeled)', (P.l + S.w - P.r) / 2, S.h - 8);
      if (o.be < 0.7) {
        const x = Math.round(X(o.be)) + 0.5;
        ctx.strokeStyle = colors.ink;
        ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, S.h - P.b); ctx.stroke();
        ctx.fillStyle = colors.ink;
        ctx.textAlign = 'left';
        ctx.font = `600 13px ${colors['font-display']}`;
        ctx.fillText(`Break-even ${Math.round(o.be * 100)}%`, x + 6, P.t + 34);
      }
    }
    if (o.kind === 'states') {
      ctx.textAlign = 'left';
      const small = S.w < 600;
      for (const l of o.labels) {
        ctx.fillStyle = colors.ink;
        ctx.font = `600 ${small ? 10 : 12}px ${colors['font-display']}`;
        ctx.fillText(l.st, l.x, l.y);
        ctx.fillStyle = colors['ink-3'];
        ctx.font = `${small ? 9 : 11}px ${colors['font-display']}`;
        ctx.textAlign = 'right';
        ctx.fillText(pct(l.pct, { digits: 0 }), l.x + o.labelW - 6, l.y);
        ctx.textAlign = 'left';
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);
    let t = 1;
    if (S.anim) {
      t = Math.min(1, (now - S.t0) / (S.dur + 300));
      for (let i = 0; i < N; i += 1) {
        const e = ease(Math.min(1, Math.max(0, ((now - S.t0) - delay[i] * 300) / S.dur)));
        S.x[i] = S.fx[i] + (S.tx[i] - S.fx[i]) * e;
        S.y[i] = S.fy[i] + (S.ty[i] - S.fy[i]) * e;
      }
      S.r = S.r0 + (S.tr - S.r0) * ease(t);
      if (t >= 1) S.anim = false;
    }
    drawOverlay(ctx, S.overlay, S.anim ? Math.max(0, (t - 0.6) / 0.4) : 1);
    const { gain, loss, neutral } = colors;
    [loss, gain, neutral].forEach((color, k) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const i of byColor[k]) {
        ctx.moveTo(S.x[i] + S.r, S.y[i]);
        ctx.arc(S.x[i], S.y[i], S.r, 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    for (const i of [S.hover, S.selected]) {
      if (i < 0) continue;
      ctx.beginPath();
      ctx.arc(S.x[i], S.y[i], Math.max(5, S.r * 2.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (S.selected >= 0 && !S.anim) {
      // Name the selected hospital beside its dot, on a paper chip, kept inside the field.
      const i = S.selected;
      const name = hs[i].name.length > 34 ? `${hs[i].name.slice(0, 33)}…` : hs[i].name;
      ctx.font = `600 13px ${colors['font-display']}`;
      const w = ctx.measureText(name).width + 12;
      const right = S.x[i] + 10 + w < S.w;
      const x = right ? S.x[i] + 10 : S.x[i] - 10 - w;
      const y = Math.min(Math.max(S.y[i] - 11, 2), S.h - 24);
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, 22);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 21);
      ctx.fillStyle = colors.ink;
      ctx.textAlign = 'left';
      ctx.fillText(name, x + 6, y + 15);
    }
    if (S.anim) requestAnimationFrame(draw);
  }

  let queued = false;
  const redraw = () => {
    if (S.anim || queued) return;
    queued = true;
    requestAnimationFrame((now) => { queued = false; draw(now); });
  };

  function go(mode, { animate = true } = {}) {
    if (!S.w) return;
    S.fx.set(S.x);
    S.fy.set(S.y);
    S.r0 = S.r;
    // The what-if rate only ever recolors the scatter; every other layout shows CMS's own numbers.
    applyValues(mode === 'scatter' ? S.discount : C0);
    S.overlay = LAYOUTS[mode]();
    S.mode = mode;
    canvas.setAttribute('aria-label', LABELS[mode]());
    tip.hide();
    S.hover = -1;
    if (animate && !reduce) {
      const was = S.anim;
      S.anim = true;
      S.t0 = performance.now();
      if (!was) requestAnimationFrame(draw);
    } else {
      S.x.set(S.tx);
      S.y.set(S.ty);
      S.r = S.tr;
      S.anim = false;
      redraw();
    }
  }

  const LABELS = {
    swarm: () => `Dot plot of ${count(N)} hospitals by CMS’s estimated change in 2027 outpatient payments: ${count(data.totals.losers)} get less, ${count(data.totals.gainers)} get more.`,
    rows: () => 'The same hospitals split into four rows: 340B hospitals, other nonprofit and public hospitals, rural sole community hospitals, and for-profit hospitals.',
    scatter: () => `Scatter plot of each hospital’s modeled 340B drug share against its change in payments. Break-even is about ${Math.round(100 * data.totals.breakeven)}% of payments.`,
    states: () => 'Each state’s hospitals as a strip of dots, states ranked from the biggest loss to the biggest gain, counting every 2027 change.',
  };

  function size() {
    const w = Math.round(field.clientWidth);
    const H = Math.round(field.clientHeight);
    if (!w || !H) return false;
    S.w = w;
    S.h = H;
    S.dpr = sizeCanvas(canvas, w, H);
    canvas.style.width = `${w}px`;
    return true;
  }

  // Start every dot on the zero line, so the first layout plays as the reveal.
  function start(mode) {
    if (!size()) return;
    const P = pad();
    const x0 = P.l + ((0 - LO) / (HI - LO)) * (S.w - P.l - P.r);
    S.x.fill(x0);
    S.y.fill(S.h / 2);
    S.r = 1.4;
    go(mode);
  }

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.round(field.clientWidth) === S.w && Math.round(field.clientHeight) === S.h) return;
      if (size() && S.mode) go(S.mode, { animate: false });
    }, 100);
  }).observe(field);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors = palette(field, COLORS); redraw(); });

  function nearest(px, py) {
    let best = -1;
    let bd = Math.max(64, (S.r * 3) ** 2);
    for (let i = 0; i < N; i += 1) {
      const dx = S.x[i] - px;
      if (dx > 12 || dx < -12) continue;
      const dd = dx * dx + (S.y[i] - py) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  let moveQueued = null;
  canvas.addEventListener('pointermove', (e) => {
    if (S.anim) return;
    const first = !moveQueued;
    moveQueued = [e.offsetX, e.offsetY];
    if (first) requestAnimationFrame(() => { const [px, py] = moveQueued; moveQueued = null; hover(px, py); });
  });
  function hover(px, py) {
    const i = nearest(px, py);
    if (i === S.hover) return;
    S.hover = i;
    if (i < 0) tip.hide();
    else {
      const x = hs[i];
      tip.show(S.x[i], S.y[i] - S.r,
        h('strong', null, x.name),
        h('span', null, [x.city, stateName(x.st)].filter(Boolean).join(', ')),
        h('span', { class: S.values[i] < 0 ? 'neg' : 'pos' }, `${pct(S.values[i])} in 2027${S.mode === 'scatter' && S.discount !== C0 ? ' at this rate' : ''}`));
    }
    canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
    redraw();
  }
  canvas.addEventListener('pointerleave', () => { S.hover = -1; tip.hide(); redraw(); });
  canvas.addEventListener('click', (e) => {
    if (S.anim) return;
    const i = nearest(e.offsetX, e.offsetY);
    if (i >= 0) onSelect(hs[i]);
  });

  return {
    start,
    go: (mode) => { if (mode !== S.mode) go(mode); },
    select(x) { S.selected = x ? x.i : -1; redraw(); },
    // The rate slider: recolor and move the dots at once (the scatter's y is the change).
    setDiscount(d) {
      S.discount = d;
      const values = d === C0 ? base : whatIf(data, d);
      if (S.mode !== 'scatter') return values;
      applyValues(d, values);
      {
        S.overlay = LAYOUTS.scatter();
        S.x.set(S.tx);
        S.y.set(S.ty);
        canvas.setAttribute('aria-label', LABELS.scatter());
        redraw();
      }
      return S.values;
    },
  };
}
