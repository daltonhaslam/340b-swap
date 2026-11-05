"""Read every pinned raw source (data/raw/, gitignored) and write the small tables the model needs to pipeline/derived/.

The derived tables are committed, so build_data.py runs without the raw files (about 2.7 GB with HCRIS).
Run: python3 -I pipeline/extract.py
"""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = ROOT / 'data' / 'raw'
OUT = HERE / 'derived'
CCN = re.compile(r'\d{6}')


def sources():
    return {s['name']: s for s in json.loads((HERE / 'sources.json').read_text(encoding='utf-8'))}


def open_pinned(name):
    """The pinned zip for one source, after checking its SHA-256 against sources.json."""
    s = sources()[name]
    path = RAW / s['file']
    if not path.exists():
        sys.exit('%s is missing. Fetch it from %s%s' % (path, s['url'], ('\n' + s['manual']) if s.get('manual') else ''))
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    if h.hexdigest() != s['sha256']:
        sys.exit('%s: SHA-256 %s does not match the pin %s. Re-pin deliberately if CMS reposted it.' % (path, h.hexdigest(), s['sha256']))
    return zipfile.ZipFile(path)


def member(z, pattern):
    """The one zip member whose name matches pattern (a regex)."""
    hits = [n for n in z.namelist() if re.search(pattern, n)]
    if len(hits) != 1:
        raise SystemExit('expected one member matching %r, found %r' % (pattern, hits))
    return hits[0]


def money(x):
    x = (x or '').replace('$', '').replace(',', '').replace('"', '').strip()
    if x in ('', '.', '-'):
        return None
    return float(x)


def write(name, cols, rows):
    OUT.mkdir(exist_ok=True)
    with open(OUT / name, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(cols)
        w.writerows(rows)
    print('%-24s %5d rows' % (name, len(rows)))


def impacts(name, out):
    z = open_pinned(name)
    text = z.read(member(z, r'508.*\.csv$')).decode('cp1252')
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        ccn = r['Provider Number'].strip().zfill(6)
        dsh = r['Disproportionate Share Patient Percentage'].strip().replace('%', '')
        rows.append([
            ccn, r['Provider Name'].strip(), r['CBSA Code'].strip(),
            r['Rural Sole Community and Essential Access Hospitals'].strip(),
            r['Post Reclassification Wage Index'].strip(), r['Urban/Rural Geographic Location'].strip(), r['Region'].strip(),
            ('%.4f' % (float(dsh) / 100)) if dsh else '', r['Number of Beds'].strip().replace(',', ''),
            r['Teaching Hospitals'].strip(), r['Ownership'].strip(), r['CMHC'].strip(),
            '%.2f' % money(r['Estimated 2026 OPPS Payment']), '%.2f' % money(r['Estimated 2027 OPPS Payment']),
            '%.2f' % (money(r['Estimated 2027 Outlier Payment']) or 0),
        ])
    write(out, ['ccn', 'name', 'cbsa', 'rural_sch', 'wage_index', 'geo', 'region', 'dsh_pct', 'beds', 'teaching',
                'ownership', 'cmhc', 'pay_2026', 'pay_2027', 'outlier_2027'], sorted(rows))


def addendum_r():
    z = open_pinned('addenda_final')
    text = z.read(member(z, r'508.*Addendum R.*\.csv$')).decode('cp1252')
    rows = sorted({r[0].strip() for r in csv.reader(io.StringIO(text)) if r and CCN.fullmatch(r[0].strip())})
    write('addendum_r.csv', ['ccn'], [[c] for c in rows])


def remedy():
    z = open_pinned('remedy_aaa')
    text = z.read(member(z, r'Remedy Payment FR.*\.txt$')).decode('cp1252')
    rows = []
    for line in text.splitlines():
        c = line.split('\t')
        if c and CCN.fullmatch(c[0].strip()):
            v = [money(x) or 0.0 for x in c[2:8]]
            rows.append([c[0].strip()] + ['%.2f' % x for x in v])
    write('remedy_aaa.csv', ['ccn', 'y2018', 'y2019', 'y2020', 'y2021', 'y2022', 'total'], sorted(rows))
    z = open_pinned('remedy_bbb')
    text = z.read(member(z, r'\.txt$')).decode('cp1252')
    rows = sorted({line.split('\t')[0].strip() for line in text.splitlines() if CCN.fullmatch(line.split('\t')[0].strip())})
    write('remedy_bbb.csv', ['ccn'], [[c] for c in rows])


HOSPITAL_TYPES = ('DSH', 'RRC', 'SCH', 'CAN', 'PED', 'CAH')


def opais():
    z = open_pinned('opais')
    data = json.loads(z.read(member(z, r'\.JSON$')).decode('utf-8'))
    rows = []
    for c in data['coveredEntities']:
        # Parent registrations only (child sites carry a parentId340B); no contact or address fields.
        if c.get('entityType') not in HOSPITAL_TYPES or c.get('parentId340B') or not c.get('cmsCertificationNumber'):
            continue
        rows.append([c['cmsCertificationNumber'].strip().zfill(6), c['id340B'], c['entityType'], c.get('participating', ''),
                     (c.get('participatingStartDate') or '')[:10], (c.get('terminationDate') or '')[:10]])
    write('opais_hospitals.csv', ['ccn', 'id340b', 'entity_type', 'participating', 'start_date', 'termination_date'], sorted(rows))


# Worksheet D Part V, hospital component, Title XVIII: Medicare Part B charges for services paid under OPPS (column 2).
DPT5 = {('07300', '00200'): 'drug_charges', ('20200', '00200'): 'total_charges'}
# Worksheet S-2 Part I, line 2: city, state, ZIP.
S2 = {('00200', '00100'): 'city', ('00200', '00200'): 'state', ('00200', '00300'): 'zip'}


def hcris():
    best = {}
    for name in ('hcris_fy2023', 'hcris_fy2024', 'hcris_fy2025'):
        z = open_pinned(name)
        rpt = {}
        with z.open(member(z, r'_rpt\.csv$')) as f:
            for r in csv.reader(io.TextIOWrapper(f, encoding='latin-1')):
                rpt[r[0]] = dict(ccn=r[2].strip().zfill(6), begin=r[5], end=r[6])
        vals = {}
        with z.open(member(z, r'_nmrc\.csv$')) as f:
            for r in csv.reader(io.TextIOWrapper(f, encoding='latin-1')):
                if r[1] == 'D00A185':
                    k = DPT5.get((r[2], r[3]))
                    if k:
                        vals.setdefault(r[0], {})[k] = float(r[4])
        with z.open(member(z, r'_alpha\.csv$')) as f:
            for r in csv.reader(io.TextIOWrapper(f, encoding='latin-1')):
                if r[1] == 'S200001':
                    k = S2.get((r[2], r[3]))
                    if k and r[0] in vals:
                        vals[r[0]][k] = r[4].strip()
        for rec, v in vals.items():
            m = rpt.get(rec)
            if not m or not v.get('total_charges'):
                continue
            mb, db, yb = m['begin'].split('/')
            me, de, ye = m['end'].split('/')
            from datetime import date
            days = (date(int(ye), int(me), int(de)) - date(int(yb), int(mb), int(db))).days + 1
            row = dict(v, ccn=m['ccn'], end='%s-%s-%s' % (ye, me, de), days=days)
            # Prefer the latest full-year report (300+ days); a short report only if nothing longer exists.
            key = (days >= 300, row['end'])
            cur = best.get(m['ccn'])
            if cur is None or key > (cur['days'] >= 300, cur['end']):
                best[m['ccn']] = row
    rows = [[c, r['end'], r['days'], '%.0f' % r.get('drug_charges', 0), '%.0f' % r['total_charges'],
             r.get('city', '').title(), r.get('state', ''), r.get('zip', '')[:5]] for c, r in sorted(best.items())]
    write('hcris_part_b.csv', ['ccn', 'period_end', 'days', 'drug_charges', 'total_charges', 'city', 'state', 'zip'], rows)


def main():
    impacts('impacts_final', 'impacts_final.csv')
    impacts('impacts_proposed', 'impacts_proposed.csv')
    addendum_r()
    remedy()
    opais()
    hcris()


if __name__ == '__main__':
    main()
