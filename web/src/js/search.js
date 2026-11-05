// Hospital search: an ARIA combobox over name, city, state and CCN.
import { h } from './dom.js';
import { pct, stateName } from './format.js';

const MAX = 8;

export function match(hospitals, q) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = [];
  for (const x of hospitals) {
    if (terms.every((t) => x.search.includes(t))) {
      const name = x.name.toLowerCase();
      const score = (x.ccn === terms[0] ? 0 : name.startsWith(terms[0]) ? 1 : name.includes(` ${terms[0]}`) ? 2 : 3);
      hits.push([score, x]);
    }
  }
  hits.sort((a, b) => a[0] - b[0] || b[1].m - a[1].m);
  return hits.slice(0, MAX).map((p) => p[1]);
}

export function mountSearch(root, data, { onSelect }) {
  const input = h('input', {
    id: 'find', type: 'search', class: 'find-input', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'find-list', 'aria-autocomplete': 'list',
    placeholder: 'Name, city or CCN',
  });
  const list = h('ul', { id: 'find-list', role: 'listbox', class: 'find-list', hidden: true, 'aria-label': 'Matching hospitals' });
  const hint = h('p', { class: 'find-hint', id: 'find-hint' },
    `All ${data.hospitals.length.toLocaleString('en-US')} hospitals in CMS’s estimate. Critical access and Maryland hospitals aren’t paid this way, so they aren’t here.`);
  input.setAttribute('aria-describedby', 'find-hint');
  root.append(h('label', { for: 'find', class: 'find-label' }, 'Find a hospital'), h('div', { class: 'find-box' }, input, list), hint);

  let results = [];
  let active = -1;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function choose(x) {
    input.value = x.name;
    close();
    onSelect(x);
  }

  function paint() {
    list.replaceChildren(...results.map((x, i) => h('li', {
      id: `opt-${x.ccn}`, role: 'option', class: 'find-opt', 'aria-selected': i === active ? 'true' : 'false',
      onmousedown: (e) => { e.preventDefault(); choose(x); },
    }, h('span', { class: 'find-name' }, x.name),
    h('span', { class: 'find-meta' }, [x.city, stateName(x.st)].filter(Boolean).join(', ')),
    h('span', { class: `find-net ${x.net < 0 ? 'neg' : 'pos'}` }, pct(x.netPct)))));
    if (!results.length && input.value.trim()) {
      list.replaceChildren(h('li', { class: 'find-empty', role: 'option', 'aria-disabled': 'true' },
        'No match. Try fewer words, the city, or the six-character CCN.'));
    }
    list.hidden = !input.value.trim();
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0 && results[active]) input.setAttribute('aria-activedescendant', `opt-${results[active].ccn}`);
    else input.removeAttribute('aria-activedescendant');
  }

  input.addEventListener('input', () => { results = match(data.hospitals, input.value); active = results.length ? 0 : -1; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) { active = (active + 1) % results.length; paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && results.length) { active = (active - 1 + results.length) % results.length; paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0 && results[active]) { choose(results[active]); e.preventDefault(); }
    else if (e.key === 'Escape' && !list.hidden) { close(); e.stopPropagation(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { input, setValue(v) { input.value = v; } };
}
