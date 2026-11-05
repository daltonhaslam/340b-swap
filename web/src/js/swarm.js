// The hero: every hospital as one dot, placed by CMS's estimated change in 2027 outpatient payments.
// A symmetric dot plot on canvas (3,500 marks), with one load animation: every dot starts on the zero line, then moves
// to where the 2027 rule puts it.
import { h } from './dom.js';
import { pct, stateName } from './format.js';

const LO = -30;
const HI = 30;

function cssVar(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function layout(values, width, maxHeight) {
  const plotW = width;
  let d = Math.min(6, Math.max(2, width / 170));
  for (let i = 0; i < 40; i += 1) {
    const ncol = Math.floor(plotW / d);
    const cols = new Map();
    values.forEach((v, idx) => {
      const c = Math.min(ncol - 1, Math.max(0, Math.floor(((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * ncol)));
      if (!cols.has(c)) cols.set(c, []);
      cols.get(c).push(idx);
    });
    let maxStack = 0;
    for (const v of cols.values()) maxStack = Math.max(maxStack, v.length);
    if (maxStack * d <= maxHeight || d <= 1.6) {
      const pos = new Array(values.length);
      for (const [c, idxs] of cols) {
        idxs.sort((a, b) => values[a] - values[b]);
        idxs.forEach((idx, k) => {
          const off = k === 0 ? 0 : Math.ceil(k / 2) * (k % 2 ? -1 : 1);
          pos[idx] = { x: (c + 0.5) * d, dy: off * d };
        });
      }
      return { pos, d, height: maxStack * d, ncol };
    }
    d *= 0.94;
  }
  throw new Error('swarm layout did not converge');
}

export function mountSwarm(root, data, { onSelect }) {
  const hs = data.hospitals;
  const values = hs.map((x) => x.netPct);
  const canvas = h('canvas', { class: 'swarm-canvas', role: 'img',
    'aria-label': `Dot plot of ${hs.length.toLocaleString('en-US')} hospitals by CMS's estimated change in 2027 outpatient payments. `
      + `${data.totals.losers} get less, ${data.totals.gainers.toLocaleString('en-US')} get more.` });
  const tip = h('div', { class: 'tip', hidden: true, role: 'presentation' });
  const axis = h('div', { class: 'swarm-axis', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'swarm-wrap' }, canvas, tip);
  root.append(wrap, axis);

  const state = { L: null, selected: null, focus: null, t0: null, anim: false, hover: -1, w: 0 };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function measure() {
    const w = Math.round(wrap.clientWidth);
    if (!w) return false;
    const maxH = Math.min(window.innerHeight * 0.42, w < 600 ? 300 : 340);
    state.L = layout(values, w, maxH);
    state.w = w;
    const H = Math.max(state.L.height + 16, 120);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    state.H = H;
    state.dpr = dpr;
    drawAxis();
    return true;
  }

  function xOf(v) { return ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * state.w; }

  function drawAxis() {
    const ticks = state.w < 560 ? [-20, 0, 20] : [-30, -20, -10, 0, 10, 20, 30];
    axis.replaceChildren(...ticks.map((t) => h('span', {
      class: t === 0 ? 'tick zero' : 'tick', style: { left: `${(xOf(t) / state.w) * 100}%` },
    }, t === 0 ? 'No change' : pct(t, { digits: 0 }))));
  }

  const ease = (t) => 1 - (1 - t) ** 3;

  function draw(now) {
    const { L, H, dpr } = state;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.w, H);
    const gain = cssVar(root, '--gain');
    const loss = cssVar(root, '--loss');
    const neutral = cssVar(root, '--neutral');
    const ink = cssVar(root, '--ink');
    const cy = H / 2;
    const x0 = xOf(0);
    ctx.strokeStyle = cssVar(root, '--rule-strong');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x0) + 0.5, 0);
    ctx.lineTo(Math.round(x0) + 0.5, H);
    ctx.stroke();
    let running = false;
    const r = Math.max(0.8, L.d / 2 - 0.35);
    const focus = state.focus;
    for (let i = 0; i < hs.length; i += 1) {
      const p = L.pos[i];
      let x = p.x;
      let y = cy + p.dy;
      if (state.anim) {
        const delay = 250 + (Math.abs(values[i]) / 30) * 600;
        const t = Math.min(1, Math.max(0, (now - state.t0 - delay) / 1100));
        if (t < 1) running = true;
        const e = ease(t);
        x = x0 + (p.x - x0) * e;
        y = cy + p.dy * e;
      }
      const v = values[i];
      const dim = focus && !focus(hs[i]);
      ctx.globalAlpha = dim ? 0.13 : 1;
      ctx.fillStyle = v > 0 ? gain : v < 0 ? loss : neutral;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const i of [state.hover, state.selected]) {
      if (i == null || i < 0) continue;
      const p = L.pos[i];
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, cy + p.dy, Math.max(5, L.d * 1.3), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (running) requestAnimationFrame(draw);
    else state.anim = false;
  }

  function redraw() { if (state.L) requestAnimationFrame(draw); }

  function nearest(px, py) {
    const { L, H } = state;
    const cy = H / 2;
    const col = Math.floor(px / L.d);
    let best = -1;
    let bd = (Math.max(8, L.d * 2)) ** 2;
    for (let i = 0; i < hs.length; i += 1) {
      const p = L.pos[i];
      if (Math.abs(Math.floor(p.x / L.d) - col) > 3) continue;
      const dd = (p.x - px) ** 2 + (cy + p.dy - py) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  function showTip(i) {
    if (i < 0) { tip.hidden = true; return; }
    const x = hs[i];
    const p = state.L.pos[i];
    tip.replaceChildren(
      h('strong', null, x.name),
      h('span', null, [x.city, stateName(x.st)].filter(Boolean).join(', ')),
      h('span', { class: x.net < 0 ? 'neg' : 'pos' }, `${pct(x.netPct)} in 2027`),
    );
    tip.hidden = false;
    const left = Math.min(Math.max(p.x, 90), state.w - 90);
    tip.style.left = `${left}px`;
    tip.style.top = `${state.H / 2 + p.dy - 14}px`;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (state.anim) return;
    const b = canvas.getBoundingClientRect();
    const i = nearest(e.clientX - b.left, e.clientY - b.top);
    if (i !== state.hover) { state.hover = i; showTip(i); redraw(); }
    canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { state.hover = -1; tip.hidden = true; redraw(); });
  canvas.addEventListener('click', () => { if (state.hover >= 0) onSelect(hs[state.hover]); });

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.round(wrap.clientWidth) !== state.w && measure()) redraw();
    }, 80);
  }).observe(wrap);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

  if (measure()) {
    if (!reduce) { state.anim = true; state.t0 = performance.now(); }
    requestAnimationFrame(draw);
  }

  return {
    select(x) {
      state.selected = x ? hs.indexOf(x) : null;
      redraw();
    },
    setFocus(fn) { state.focus = fn; redraw(); },
    redraw,
  };
}
