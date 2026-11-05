"""Build the site's data from pipeline/derived/: fit the model, check it against CMS's own numbers, write the outputs.

Outputs:
  web/src/data/swap.json   everything the page needs
  docs/data/340b-swap-cy2027-hospitals.csv   the per-hospital table, for readers to download
  pipeline/out/checks.txt  the checks, human-readable (also checks.json)
Run: python3 -I pipeline/build_data.py
"""
import csv
import json
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from swap import model  # noqa: E402
from swap.table112 import TABLE, groups  # noqa: E402

DER = HERE / 'derived'
HISTORY_WEIGHT = 0.75  # weight on the implied estimate; see methods (precision-weighted, both sources' error measured)
RHO_GRID = [round(0.80 + 0.05 * i, 2) for i in range(25)]

# CCN digits 1-2 -> state, for rows without a cost report (CMS State Operations Manual, ch. 2, 2779A1).
CCN_STATE = {
    '01': 'AL', '02': 'AK', '03': 'AZ', '04': 'AR', '05': 'CA', '06': 'CO', '07': 'CT', '08': 'DE', '09': 'DC', '10': 'FL',
    '11': 'GA', '12': 'HI', '13': 'ID', '14': 'IL', '15': 'IN', '16': 'IA', '17': 'KS', '18': 'KY', '19': 'LA', '20': 'ME',
    '21': 'MD', '22': 'MA', '23': 'MI', '24': 'MN', '25': 'MS', '26': 'MO', '27': 'MT', '28': 'NE', '29': 'NV', '30': 'NH',
    '31': 'NJ', '32': 'NM', '33': 'NY', '34': 'NC', '35': 'ND', '36': 'OH', '37': 'OK', '38': 'OR', '39': 'PA', '40': 'PR',
    '41': 'RI', '42': 'SC', '43': 'SD', '44': 'TN', '45': 'TX', '46': 'UT', '47': 'VT', '49': 'VA', '50': 'WA', '51': 'WV',
    '52': 'WI', '53': 'WY', '55': 'CA', '67': 'TX', '68': 'FL',
}

# Never used as an example, default or featured hospital anywhere on the page (they stay searchable like any other).
NOT_FEATURED = ('MARY WASHINGTON', 'STAFFORD', 'UVA ', 'UNIVERSITY OF VIRGINIA', 'CULPEPER', 'PRINCE WILLIAM', 'HAYMARKET')


def read(name):
    with open(DER / name, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def kind(ccn):
    """Provider type from CCN digits 3-6 (State Operations Manual 2779A1)."""
    n = int(ccn[2:])
    if n <= 879:
        return 'acute'
    if 2000 <= n <= 2299:
        return 'ltch'
    if 3025 <= n <= 3099:
        return 'rehab'
    if 4000 <= n <= 4499:
        return 'psych'
    if 3300 <= n <= 3399:
        return 'children'
    return 'other'


def load():
    final = [r for r in read('impacts_final.csv') if r['cmhc'] == 'N']
    proposed = {r['ccn']: r for r in read('impacts_proposed.csv') if r['cmhc'] == 'N'}
    offset = {r['ccn'] for r in read('addendum_r.csv')}
    aaa = {r['ccn']: r for r in read('remedy_aaa.csv')}
    hc = {r['ccn']: r for r in read('hcris_part_b.csv')}
    op = {}
    for r in read('opais_hospitals.csv'):
        cur = op.get(r['ccn'])
        if r['participating'] == 'TRUE' and (cur is None or cur['participating'] != 'TRUE' or r['start_date'] < cur['start_date']):
            op[r['ccn']] = r
        elif cur is None:
            op[r['ccn']] = r
    shares = [float(h['drug_charges']) / float(h['total_charges']) for h in hc.values() if float(h['total_charges']) > 0]
    median_share = statistics.median(shares)
    out = []
    for r in final:
        c = r['ccn']
        h = hc.get(c)
        cs = float(h['drug_charges']) / float(h['total_charges']) if h and float(h['total_charges']) > 0 else None
        o = op.get(c)
        participating = bool(o and o['participating'] == 'TRUE')
        a = aaa.get(c)
        rural_sch = r['rural_sch'] == '1'
        proprietary = r['ownership'] == '2'
        candidate = (participating or bool(a and float(a['total']) > 0)) and not rural_sch and not proprietary
        p = proposed.get(c)
        out.append(dict(
            r, m=float(r['pay_2026']), n=float(r['pay_2027']), offset=c in offset,
            charge_share=cs if cs is not None else median_share, has_cost_report=cs is not None,
            aaa_2021=float(a['y2021']) if a else 0.0, aaa_total=float(a['total']) if a else 0.0,
            participating=participating, op_type=o['entity_type'] if o else '', op_start=o['start_date'] if participating else '',
            candidate=candidate, use_history=candidate and participating,
            city=h['city'] if h else '', state=(h['state'] if h and h['state'] else CCN_STATE.get(c[:2], '')),
            kind=kind(c),
            p_net=(float(p['pay_2027']) / float(p['pay_2026']) - 1) if p and float(p['pay_2026']) > 0 else None,
        ))
    return out


def status(h):
    if h['rural_sch'] == '1':
        return 'exempt'          # rural SCHs (and EACHs) are excepted from the drug cut (PI p. 1212)
    if h['ownership'] == '2':
        return 'proprietary'     # for-profit hospitals can't be 340B covered entities
    if h['participating']:
        return '340b'            # HRSA OPAIS, participating today
    if h['candidate']:
        return 'history'         # 340B drug claims in 2018-2022 (CMS-1793-F), not participating in OPAIS today
    return 'none'


def fit_all(hosps):
    best = None
    for rho in RHO_GRID:
        res, scal = model.fit([dict(h) for h in hosps], rho, HISTORY_WEIGHT)
        err, _ = model.score(res, TABLE, groups)
        if best is None or err < best[0]:
            best = (err, rho, res, scal)
    err, rho, res, scal = best
    return res, dict(scal, score=err)


def pct(a, b):
    return 100 * a / b if b else 0.0


def main():
    hosps = load()
    res, scal = fit_all(hosps)
    err, table_rows = model.score(res, TABLE, groups)
    M = sum(r['m'] for r in res)
    N = sum(r['n'] for r in res)
    cut = sum(r['cut'] for r in res)
    gain = sum(r['gain'] for r in res)
    off = sum(r['off'] for r in res)
    gainers = sum(1 for r in res if r['n'] > r['m'])
    losers = sum(1 for r in res if r['n'] < r['m'])
    cand = [r for r in res if r['candidate'] and r['m'] > 1e6]
    noncand = [r for r in res if not r['candidate'] and r['m'] > 1e6]
    q = lambda xs: [round(100 * v, 1) for v in statistics.quantiles(xs, n=10)]
    resid_c = q([r['other'] / r['m'] for r in cand])
    resid_n = q([r['other'] / r['m'] for r in noncand])
    # Break-even: the 340B drug share at which the cut equals the raise, for a hospital whose drugs are all 340B.
    breakeven = model.GAIN / (model.GAIN + model.CUT)
    worst = max(table_rows, key=lambda x: abs(x[2] - x[3]))
    checks = {
        'hospitals': len(res), 'cms_hospitals_table112': TABLE['ALL'][0],
        'pay_2026': M, 'pay_2027': N, 'net': N - M, 'net_pct': pct(N - M, M),
        'gainers': gainers, 'losers': losers, 'unchanged': len(res) - gainers - losers,
        'drug_cut_total': cut, 'drug_cut_target': -model.TARGET_CUT,
        'nondrug_raise_total': gain,
        'nondrug_raise_vs_cut_pct': pct(gain, -cut),
        'offset_total': off, 'offset_cms_estimate': -model.TARGET_OFFSET,
        'offset_hospitals': sum(1 for r in res if r['offset']), 'offset_cms_count_all_providers': 3322,
        'fit': scal, 'table112_rms_points': err, 'table112_worst_group': worst,
        'residual_deciles_340b_pct': resid_c, 'residual_deciles_other_pct': resid_n,
        'breakeven_share': breakeven,
        'status_counts': {s: sum(1 for r in res if status(r) == s) for s in ('340b', 'history', 'exempt', 'proprietary', 'none')},
        'no_cost_report': sum(1 for r in res if not r['has_cost_report']),
    }
    (HERE / 'out').mkdir(exist_ok=True)
    (HERE / 'out' / 'checks.json').write_text(json.dumps(checks, indent=2, default=str) + '\n', encoding='utf-8')
    lines = [
        'CY 2027 OPPS 340B swap: model checks',
        '',
        'Hospitals: %d (Table 112: %d)' % (len(res), TABLE['ALL'][0]),
        'CMS net, all hospitals: $%.2fB -> $%.2fB (%+.2f%%); %d gain, %d lose' % (M / 1e9, N / 1e9, pct(N - M, M), gainers, losers),
        '',
        'Fit: rho %.2f, history weight %.2f, everything-else median %.2f%%, growth 2021->claims %.2f, kappa %.3f'
        % (scal['rho'], scal['weight'], 100 * scal['everything_else'], scal['growth'], scal['kappa']),
        'Table 112 col 4, %d groups: weighted RMS gap %.2f points; worst %s (model %.2f vs CMS %.1f)'
        % (len(table_rows), err, worst[0], worst[2], worst[3]),
        '',
        'Drug cut total: $%.2fB (pinned to CMS $4.65B)' % (cut / 1e9),
        'Non-drug raise total: $%.2fB (budget neutral would equal the cut: %.0f%% of it; not fitted)' % (gain / 1e9, pct(gain, -cut)),
        'Remedy offset total: $%.2fB on %d hospitals (CMS: about $1.6B, 3,322 providers incl. CMHCs; not fitted)'
        % (off / 1e9, checks['offset_hospitals']),
        '',
        'Everything-else residual deciles, %% of 2026 payments:',
        '  340B candidates: %s' % resid_c,
        '  everyone else:   %s' % resid_n,
        '',
        'Status: %s' % checks['status_counts'],
        'No cost report (median drug share used): %d' % checks['no_cost_report'],
        'Break-even 340B drug share (all drugs 340B): %.1f%%' % (100 * breakeven),
        '',
        'Table 112 column 4, model vs CMS:',
    ] + ['  %-10s n=%-5d model %6.2f  CMS %5.1f' % r for r in sorted(table_rows)]
    (HERE / 'out' / 'checks.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines[:22]))
    write_site(res, scal, checks)


def write_site(res, scal, checks):
    rows = []
    for r in sorted(res, key=lambda r: r['ccn']):
        rows.append([
            r['ccn'], r['name'], r['city'], r['state'], round(r['m']), round(r['n']),
            round(r['cut']), round(r['gain']), round(r['off']), round(r['other']),
            round(r['b'], 4), round(r['b_lo'], 4), round(r['b_hi'], 4), round(r['s'], 4),
            status(r), r['op_type'] if r['participating'] else '', r['op_start'][:4] if r['op_start'] else '',
            1 if r['offset'] else 0, None if r['p_net'] is None else round(100 * r['p_net'], 2),
            r['kind'], r['ownership'], r['teaching'], r['geo'],
            1 if any(x in r['name'].upper() for x in NOT_FEATURED) else 0,
        ])
    cols = ['ccn', 'name', 'city', 'st', 'm', 'n', 'cut', 'gain', 'off', 'other', 'b', 'bLo', 'bHi', 's', 'status', 'opType',
            'opStart', 'offset', 'pNet', 'kind', 'own', 'teach', 'geo', 'noFeature']
    meta = dict(
        constants=dict(oldRate=model.OLD_RATE, newRate=model.NEW_RATE, cut=model.CUT, gain=model.GAIN, offset=model.OFFSET,
                       targetCut=model.TARGET_CUT, targetOffset=model.TARGET_OFFSET, cf2026=model.CF_2026, cf2027=model.CF_2027,
                       cf2027Offset=model.CF_2027_OFFSET),
        fit={k: round(v, 4) for k, v in scal.items()},
        checks={k: v for k, v in checks.items() if k not in ('fit', 'table112_worst_group')},
        table112={g: list(v) for g, v in TABLE.items()},
    )
    data = dict(meta=meta, cols=cols, rows=rows)
    out = ROOT / 'web' / 'src' / 'data' / 'swap.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, separators=(',', ':')) + '\n', encoding='utf-8')
    print('wrote %s (%.0f KB)' % (out.relative_to(ROOT), out.stat().st_size / 1024))
    dl = ROOT / 'docs' / 'data' / '340b-swap-cy2027-hospitals.csv'
    dl.parent.mkdir(parents=True, exist_ok=True)
    with open(dl, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['ccn', 'name', 'city', 'state', 'cms_est_2026_opps_payment', 'cms_est_2027_opps_payment', 'cms_net_change',
                    'modeled_340b_drug_cut', 'modeled_nondrug_raise', 'modeled_remedy_offset', 'everything_else',
                    'modeled_340b_drug_share', 'modeled_340b_drug_share_low', 'modeled_340b_drug_share_high',
                    'status', 'hrsa_entity_type', 'on_addendum_r', 'proposed_rule_net_pct'])
        for x in rows:
            w.writerow([x[0], x[1], x[2], x[3], x[4], x[5], x[5] - x[4], x[6], x[7], x[8], x[9], x[10], x[11], x[12], x[14], x[15], x[17], x[18]])


if __name__ == '__main__':
    main()
