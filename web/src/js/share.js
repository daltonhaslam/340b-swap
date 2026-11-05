// "Save as image": draws one hospital's statement onto a 1200 x 1200 canvas (a square post image) and downloads it.
import { money, pct, stateName } from './format.js';
import { verdict } from './statement.js';

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

export async function saveImage(x, siteUrl) {
  if (document.fonts?.ready) await document.fonts.ready;
  const S = 1200;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  // Always the light palette, so the image reads the same in every feed.
  const P = { paper: '#f5f7f4', ink: '#17242e', ink2: '#46545e', rule: '#cdd6d0', bar: '#e3eee3', gain: '#2f68b3', loss: '#c24d16' };
  const disp = '"Libre Franklin Variable", "Franklin Gothic Medium", Arial, sans-serif';
  const text = '"Literata Variable", Georgia, serif';
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, S, S);
  const M = 84;
  ctx.fillStyle = P.ink2;
  ctx.font = `600 30px ${disp}`;
  ctx.fillText('The 340B swap: Medicare outpatient payments, 2027', M, M + 10);
  ctx.fillStyle = P.ink;
  ctx.font = `800 62px ${disp}`;
  let y = wrapText(ctx, x.name, M, M + 100, S - 2 * M, 68);
  ctx.font = `400 32px ${text}`;
  ctx.fillStyle = P.ink2;
  ctx.fillText([x.city, stateName(x.st)].filter(Boolean).join(', '), M, y + 4);
  y += 92;
  ctx.fillStyle = x.net < 0 ? P.loss : P.gain;
  ctx.font = `800 150px ${disp}`;
  ctx.fillText(pct(x.netPct), M - 6, y + 70);
  ctx.font = `600 36px ${disp}`;
  ctx.fillStyle = P.ink;
  ctx.fillText(`${money(x.net, { sign: true })} in 2027, CMS estimate`, M, y + 130);
  y += 190;
  ctx.font = `400 31px ${text}`;
  ctx.fillStyle = P.ink;
  y = wrapText(ctx, verdict(x), M, y, S - 2 * M, 44) + 10;
  const rows = [
    ['340B drug cut (modeled)', x.cut],
    ['7.5% raise on everything else (modeled)', x.gain],
    ['Remedy offset (modeled)', x.off],
    ['All other 2027 changes', x.other],
  ];
  rows.forEach(([label, val], i) => {
    const top = y + i * 64;
    if (i % 2 === 0) { ctx.fillStyle = P.bar; ctx.fillRect(M - 16, top - 44, S - 2 * M + 32, 64); }
    ctx.fillStyle = P.ink;
    ctx.font = `400 30px ${text}`;
    ctx.fillText(label, M, top);
    ctx.font = `700 32px ${disp}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = val < 0 ? P.loss : P.ink;
    ctx.fillText(money(val, { sign: true }), S - M, top);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = P.ink2;
  ctx.font = `400 25px ${text}`;
  ctx.fillText('Total from CMS’s CY 2027 OPPS final rule impact file. Split modeled from public CMS and HRSA data.', M, S - M - 34);
  ctx.font = `600 27px ${disp}`;
  ctx.fillStyle = P.ink;
  ctx.fillText(siteUrl.replace(/^https?:\/\//, ''), M, S - M + 8);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `340b-swap-${x.ccn}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
