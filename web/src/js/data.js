// The build inlines web/src/data/swap.json; this turns its rows into hospital objects and precomputes totals.

// The four kinds of hospital the page compares, by the pipeline's status. '340b' and 'left' are the hospitals in 340B
// during 2025, the claims year CMS modeled; those are the ones with a drug cut in CMS's estimate.
export const GROUPS = [
  { key: 'in340', label: '340B hospitals', statuses: ['340b', 'left'] },
  { key: 'other', label: 'Other nonprofit and public hospitals', statuses: ['none', 'history', 'new'] },
  { key: 'exempt', label: 'Rural sole community hospitals', statuses: ['exempt'] },
  { key: 'proprietary', label: 'For-profit hospitals', statuses: ['proprietary'] },
];
const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => g.statuses.map((s) => [s, g.key])));
export const groupOf = (x) => GROUP_OF[x.status];

export function decode(raw) {
  const { meta, cols, rows } = raw;
  const hospitals = rows.map((r, i) => {
    const o = { i };
    cols.forEach((c, i) => { o[c] = r[i]; });
    o.net = o.n - o.m;
    o.netPct = o.m > 0 ? (100 * o.net) / o.m : 0;
    o.search = `${o.name} ${o.city} ${o.st} ${o.ccn}`.toLowerCase();
    o.group = groupOf(o);
    return o;
  });
  return { meta, hospitals, byCcn: new Map(hospitals.map((x) => [x.ccn, x])), totals: totals(hospitals, meta) };
}

const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

function totals(hs, meta) {
  const C = meta.constants;
  const gainers = hs.filter((x) => x.net > 0).length;
  const losers = hs.filter((x) => x.net < 0).length;
  const raise = sum(hs, (x) => x.gain);
  const groups = Object.fromEntries(GROUPS.map((g) => {
    const xs = hs.filter((x) => x.group === g.key);
    const m = sum(xs, (x) => x.m);
    const net = sum(xs, (x) => x.net);
    return [g.key, { n: xs.length, losers: xs.filter((x) => x.net < 0).length, m, net, pct: m ? (100 * net) / m : 0,
      cut: sum(xs, (x) => x.cut), gain: sum(xs, (x) => x.gain), raiseShare: sum(xs, (x) => x.gain) / raise }];
  }));
  const lossDollars = hs.filter((x) => x.net < 0).map((x) => x.net).sort((a, b) => a - b);
  const totalLoss = sum(lossDollars, (x) => x);
  return {
    n: hs.length,
    gainers,
    losers,
    m: sum(hs, (x) => x.m),
    net: sum(hs, (x) => x.net),
    groups,
    states: byState(hs),
    // National 340B and non-drug payment bases implied by CMS's own figures (not the model): $4.65B is 32.08% of the
    // 340B drug dollars, and 7.5% of the non-drug dollars.
    drugBase340b: C.targetCut / C.cut,
    nonDrugBase: C.targetCut / C.gain,
    top50LossShare: sum(lossDollars.slice(0, 50), (x) => x) / totalLoss,
    breakeven: C.gain / (C.gain + C.cut),
  };
}

// Every state's hospitals, summed, sorted from the biggest loss to the biggest gain (CMS's net, all changes).
// `idx` lists the hospitals' positions, the ones that get less first.
function byState(hs) {
  const by = new Map();
  hs.forEach((x, i) => {
    const s = by.get(x.st) || { st: x.st, idx: [], n: 0, n340: 0, losers: 0, m: 0, part: 0, net: 0 };
    s.idx.push(i);
    s.n += 1; s.m += x.m; s.net += x.net; s.part += x.cut + x.gain + x.off;
    if (x.group === 'in340') s.n340 += 1;
    if (x.net < 0) s.losers += 1;
    by.set(x.st, s);
  });
  const out = [...by.values()];
  for (const s of out) {
    s.pct = s.m ? (100 * s.net) / s.m : 0;
    s.idx.sort((a, b) => hs[a].netPct - hs[b].netPct);
  }
  return out.sort((a, b) => a.pct - b.pct);
}

// Share of each 340B drug dollar removed if Medicare paid ASP minus `discount` (0.28 in the final rule).
const cutRate = (C, discount) => 1 - (1 - discount) / C.oldRate;

// Recompute every hospital's net under a different 340B rate (ASP minus `discount`). The non-drug raise is budget
// neutral, so it scales with the total cut. Everything else stays as CMS estimated it.
export function whatIf(data, discount) {
  const C = data.meta.constants;
  const k = cutRate(C, discount) / C.cut;   // how much bigger (or smaller) the cut and the raise get
  return data.hospitals.map((x) => (x.m > 0 ? (100 * (x.net + (k - 1) * (x.cut + x.gain))) / x.m : 0));
}

export { cutRate };
