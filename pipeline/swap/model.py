"""The per-hospital split of CMS's CY 2027 OPPS estimate into the 340B drug cut, the non-drug raise, the remedy offset,
and everything else. Pure functions; no file access.

Cited pages are the public-inspection copy of the CY 2027 OPPS final rule (CMS-1850-FC, FR doc 2026-22739).
"""
import statistics

# --- Rule constants -------------------------------------------------------------------------------------------------
OLD_RATE = 1.06            # 340B-acquired drugs paid at ASP + 6% in CY 2026 (PI p. 1208)
NEW_RATE = 0.72            # ... and at ASP - 28% from 2027-01-01 (PI pp. 1209, 1212)
CUT = 1 - NEW_RATE / OLD_RATE   # share of each 340B drug dollar that goes away: 32.08%
GAIN = 0.075               # budget-neutrality factor 1.0750 on the conversion factor for non-drug services (PI p. 110)
TARGET_CUT = 4.65e9        # CMS: 340B drug payments fall about $4.65 billion, copays included (PI p. 1213)
CF_2026 = 91.415           # CY 2026 conversion factor (PI p. 1220)
CF_2027 = 99.970           # CY 2027 conversion factor (PI p. 110)
CF_2027_OFFSET = 98.011    # ... for providers subject to the 340B remedy offset (PI p. 110)
# The offset factor, $98.011 / $99.970. CMS's impact estimate applies it to a hospital's whole 2027 payment: Table 112
# column 8 shows -2.0 for every group, drug-heavy ones included, and CMS says the offset "reduces overall provider payment
# by 2.0 percent" (PI p. 1216). So the offset line is the hospital's 2027 payment over the factor, less the payment.
OFFSET_FACTOR = CF_2027_OFFSET / CF_2027
OFFSET = 1 / OFFSET_FACTOR - 1   # share of the hospital's (offset-reduced) 2027 payment that the offset took: 1.999%
TARGET_OFFSET = 1.6e9      # CMS: the offset reduces OPPS spending about $1.6 billion in CY 2027 (PI pp. 1208-1209)


def rate_cut(discount):
    """Share of each 340B drug dollar removed if CMS paid ASP minus `discount` (0.28 for the final rule)."""
    return 1 - (1 - discount) / OLD_RATE


def drug_share(charge_share, rho):
    """Drugs' share of a hospital's OPPS payments, from their share of its Medicare Part B charges (HCRIS D Part V).

    rho is how many payment dollars a drug charge dollar is worth relative to any other charge dollar; it is fitted so
    the model reproduces CMS's own group results (Table 112, column 4).
    """
    return rho * charge_share / (rho * charge_share + 1 - charge_share)


def offset_dollars(h):
    """The remedy offset in dollars (negative) as CMS's estimate carries it: 2% off the hospital's whole 2027 payment."""
    return -OFFSET * h['n'] if h['offset'] else 0.0


def implied_340b_share(h, s, everything_else):
    """The 340B drug share of 2026 payments that, with the rule's other parts at their typical size, leaves CMS's net.

    CMS's net = GAIN * non-drug - CUT * 340B drugs - offset (if on Addendum R) + everything else, solved for the 340B
    drugs. `everything_else` is the typical size of the rule's other changes, as a share of 2026 payments.
    """
    nd = h['m'] * (1 - s)
    net = h['n'] - h['m']
    b = (GAIN * nd + offset_dollars(h) + everything_else * h['m'] - net) / CUT
    return b / h['m']


def history_340b_share(h, growth):
    """The 340B drug share of 2026 payments from the hospital's own 340B drug history (CMS-1793-F Addendum AAA).

    Addendum AAA's yearly figure is what the old ASP - 22.5% rate withheld: 28.5 points of ASP. So a year's 340B drug
    payments at ASP + 6% were that figure * 1.06 / 0.285. Returns None for a hospital with no 2021 figure (no history). 2021 is the last full year the old rate applied (CMS's 2022
    column is much smaller and not a full year), so it is the base; a hospital with no 2021 figure has no history.
    `growth` scales 2021 to the CY 2025 claims CMS modeled.
    """
    base = h['aaa_2021']
    if base <= 0:
        return None
    return base * OLD_RATE / 0.285 * growth / h['m']


CAP = 0.95  # 340B drugs never more than 95% of a hospital's OPPS payments (a few non-drug services always remain)


def fit(hospitals, rho, weight):
    """Run the model for one rho and history weight; returns per-hospital results and the fit's scalars."""
    clamp = lambda x: min(max(x, 0.0), CAP)
    # 1. Typical size of everything else: the median, over hospitals with no 340B drugs, of what's left of CMS's net
    #    after the non-drug raise and the offset.
    rest = []
    for h in hospitals:
        h['_s'] = drug_share(h['charge_share'], rho)
        if not h['candidate'] and h['m'] > 1e6:
            nd = h['m'] * (1 - h['_s'])
            rest.append((h['n'] - h['m'] - GAIN * nd - offset_dollars(h)) / h['m'])
    everything_else = statistics.median(rest)
    # 2. Two estimates of each candidate's 340B drug share, history grown to match the implied total.
    cand = [h for h in hospitals if h['candidate']]
    for h in cand:
        h['_imp'] = clamp(implied_340b_share(h, h['_s'], everything_else))
    hist_hospitals = [h for h in cand if history_340b_share(h, 1.0) is not None]
    growth = (sum(h['_imp'] * h['m'] for h in hist_hospitals)
              / sum(history_340b_share(h, 1.0) * h['m'] for h in hist_hospitals))
    for h in cand:
        hist = history_340b_share(h, growth)
        h['_hist'] = None if hist is None else clamp(hist)
        h['_blend'] = h['_imp'] if h['_hist'] is None else weight * h['_imp'] + (1 - weight) * h['_hist']
    # 3. Scale so the drug cut totals CMS's $4.65 billion.
    kappa = TARGET_CUT / (CUT * sum(h['_blend'] * h['m'] for h in cand))
    out = []
    for h in hospitals:
        b = clamp(kappa * h['_blend']) if h['candidate'] else 0.0
        s = max(h['_s'], b / CAP)
        nd = h['m'] * (1 - s)
        cut = -CUT * b * h['m']
        gain = GAIN * nd
        off = offset_dollars(h)
        net = h['n'] - h['m']
        if h['candidate']:
            lo_hi = [clamp(kappa * h['_imp'])] + ([clamp(kappa * h['_hist'])] if h['_hist'] is not None else [])
        else:
            lo_hi = [0.0]
        out.append(dict(h, s=s, b=b, nd=nd, cut=cut, gain=gain, off=off, other=net - cut - gain - off, net=net,
                        b_lo=min(lo_hi), b_hi=max(lo_hi)))
    return out, dict(rho=rho, weight=weight, everything_else=everything_else, growth=growth, kappa=kappa)


def score(results, table, groups_of):
    """Weighted RMS gap (points) between the model's 340B column and CMS's Table 112 column 4, over every group."""
    agg = {}
    for r in results:
        c4 = r['gain'] + r['cut']
        for g in groups_of(r):
            a = agg.setdefault(g, [0.0, 0.0])
            a[0] += c4
            a[1] += r['m']
    num = den = 0.0
    rows = []
    for g, (c4, m) in agg.items():
        n, col4 = table[g][0], table[g][1]
        model = 100 * c4 / m
        num += n ** 0.5 * (model - col4) ** 2
        den += n ** 0.5
        rows.append((g, n, round(model, 2), col4))
    return (num / den) ** 0.5, rows
