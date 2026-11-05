// A tiny element builder. Strings become text nodes (never HTML), so data can't inject markup.
const SVG = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'rect', 'line', 'path', 'circle', 'text', 'title', 'defs', 'pattern', 'polyline', 'tspan']);

export function h(tag, props, ...kids) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// CSS custom properties as one object, read once per draw instead of once per mark.
export function palette(el, names) {
  const cs = getComputedStyle(el);
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()]));
}

// Size a canvas to w x H CSS pixels at the screen's pixel density; returns that density.
export function sizeCanvas(canvas, w, H) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.height = `${H}px`;
  return dpr;
}

// A tooltip inside `host` (which must be position: relative). show() centers it above (x, y), kept 90px from the edges.
export function makeTip(host) {
  const el = h('div', { class: 'tip', hidden: true, role: 'presentation' });
  host.append(el);
  return {
    show(x, y, ...kids) {
      el.replaceChildren(...kids);
      const w = host.clientWidth;
      el.style.left = `${Math.min(Math.max(x, 90), w - 90)}px`;
      el.style.top = `${y - 14}px`;
      el.hidden = false;
    },
    hide() { el.hidden = true; },
  };
}
