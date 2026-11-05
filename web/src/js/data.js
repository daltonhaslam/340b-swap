// The build inlines web/src/data/swap.json; this turns its rows into hospital objects and precomputes totals.

export function decode(raw) {
  const { meta, cols, rows } = raw;
  const hospitals = rows.map((r, i) => {
    const o = { i };
    cols.forEach((c, i) => { o[c] = r[i]; });
    o.net = o.n - o.m;
    o.netPct = o.m > 0 ? (100 * o.net) / o.m : 0;
    o.search = `${o.name} ${o.city} ${o.st} ${o.ccn}`.toLowerCase();
    return o;
  });
  return { meta, hospitals, byCcn: new Map(hospitals.map((x) => [x.ccn, x])), totals: totals(hospitals, meta) };
}

const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

function totals(hs, meta) {
  const C = meta.constants;
  const gainers = hs.filter((x) => x.net > 0).length;
  const losers = hs.filter((x) => x.net < 0).length;
  const byStatus = {};
  for (const x of hs) (byStatus[x.status] ||= []).push(x);
  const raise = sum(hs, (x) => x.gain);
  const status = Object.fromEntries(Object.entries(byStatus).map(([k, xs]) => [k, {
    n: xs.length,
    losers: xs.filter((x) => x.net < 0).length,
    m: sum(xs, (x) => x.m),
    net: sum(xs, (x) => x.net),
    cut: sum(xs, (x) => x.cut),
    gain: sum(xs, (x) => x.gain),
    raiseShare: sum(xs, (x) => x.gain) / raise,
  }]));
  // 340B hospitals in CMS's claims year: participating today, or in 340B during 2025 and since dropped.
  const merge = (keys) => {
    const parts = keys.map((k) => status[k]).filter(Boolean);
    const add = (f) => parts.reduce((s, p) => s + p[f], 0);
    return { n: add('n'), losers: add('losers'), m: add('m'), net: add('net'), cut: add('cut'), gain: add('gain'), raiseShare: add('raiseShare') };
  };
  status.in340 = merge(['340b', 'left']);
  status.other = merge(['none', 'history', 'new']);
  const lossDollars = hs.filter((x) => x.net < 0).map((x) => x.net).sort((a, b) => a - b);
  const totalLoss = sum(lossDollars, (x) => x);
  return {
    n: hs.length,
    gainers,
    losers,
    m: sum(hs, (x) => x.m),
    net: sum(hs, (x) => x.net),
    status,
    // National 340B and non-drug payment bases implied by CMS's own figures (not the model): $4.65B is 32.08% of the
    // 340B drug dollars, and 7.5% of the non-drug dollars.
    drugBase340b: C.targetCut / C.cut,
    nonDrugBase: C.targetCut / C.gain,
    top50LossShare: sum(lossDollars.slice(0, 50), (x) => x) / totalLoss,
    breakeven: C.gain / (C.gain + C.cut),
  };
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

export function breakevenAt(data, discount) {
  const C = data.meta.constants;
  const cut = cutRate(C, discount);
  const gain = C.gain * (cut / C.cut);
  return cut > 0 ? gain / (gain + cut) : 1;
}
