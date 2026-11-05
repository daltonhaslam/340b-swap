// Number formatting. Minus is U+2212 so signed figures line up and read as numbers.
const MINUS = '−';

export function money(x, { sign = false, digits } = {}) {
  const a = Math.abs(x);
  let s;
  if (a >= 1e9) s = '$' + (a / 1e9).toFixed(digits ?? (a >= 1e10 ? 1 : 2)) + ' billion';
  else if (a >= 1e6) s = '$' + (a / 1e6).toFixed(digits ?? (a >= 1e8 ? 0 : 1)) + ' million';
  else if (a >= 1e4) s = '$' + Math.round(a / 1e3).toLocaleString('en-US') + ',000';
  else s = '$' + Math.round(a).toLocaleString('en-US');
  if (x < 0 && Math.round(a) > 0) return MINUS + s;
  return (sign && Math.round(a) > 0 ? '+' : '') + s;
}

// Compact form for tight spaces: $4.7B, $12.3M, $840K.
export function moneyShort(x, { sign = false } = {}) {
  const a = Math.abs(x);
  let s;
  if (a >= 1e9) s = '$' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
  else if (a >= 1e6) s = '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M';
  else if (a >= 1e3) s = '$' + Math.round(a / 1e3) + 'K';
  else s = '$' + Math.round(a);
  if (x < 0 && a >= 0.5) return MINUS + s;
  return (sign && a >= 0.5 ? '+' : '') + s;
}

export function pct(x, { sign = true, digits = 1 } = {}) {
  const r = Number(x.toFixed(digits));
  const s = Math.abs(r).toFixed(digits) + '%';
  if (r < 0) return MINUS + s;
  return (sign && r > 0 ? '+' : '') + s;
}

export function count(n) {
  return n.toLocaleString('en-US');
}

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
export const stateName = (st) => STATE_NAMES[st] || st;
