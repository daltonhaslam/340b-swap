import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
from swap import model  # noqa: E402
from swap.table112 import TABLE, groups  # noqa: E402


class RuleConstants(unittest.TestCase):
    def test_cut_is_asp_plus_6_to_minus_28(self):
        self.assertAlmostEqual(model.CUT, 1 - 0.72 / 1.06, places=12)
        self.assertAlmostEqual(model.CUT, 0.3208, places=4)

    def test_offset_matches_conversion_factors(self):
        # $99.970 * 0.9804 = $98.011 (PI p. 110)
        self.assertAlmostEqual(99.970 * 0.9804, model.CF_2027_OFFSET, places=3)
        self.assertAlmostEqual(model.OFFSET_FACTOR, 0.9804, places=4)
        self.assertAlmostEqual(model.OFFSET, 0.01999, places=4)

    def test_rate_cut(self):
        self.assertAlmostEqual(model.rate_cut(0.28), model.CUT, places=12)
        self.assertAlmostEqual(model.rate_cut(-0.06), 0.0, places=12)

    def test_breakeven_about_19_percent(self):
        self.assertAlmostEqual(model.GAIN / (model.GAIN + model.CUT), 0.1895, places=3)


class Shares(unittest.TestCase):
    def test_drug_share_identity_at_rho_1(self):
        for c in (0.0, 0.1, 0.5, 0.9):
            self.assertAlmostEqual(model.drug_share(c, 1.0), c)

    def test_drug_share_monotone_and_bounded(self):
        xs = [model.drug_share(c / 10, 1.3) for c in range(11)]
        self.assertEqual(xs, sorted(xs))
        self.assertEqual(xs[0], 0.0)
        self.assertAlmostEqual(xs[-1], 1.0)

    def test_implied_share_round_trip(self):
        s, b, other = 0.3, 0.2, 0.02
        nd = 100 * (1 - s)
        pre = 100 + model.GAIN * nd - model.CUT * b * 100 + other * 100
        h = dict(m=100.0, offset=True, n=pre * model.OFFSET_FACTOR)
        self.assertAlmostEqual(model.implied_340b_share(h, s, other), b, places=9)

    def test_history_share(self):
        h = dict(m=1.06 / 0.285, aaa_2021=1.0)
        self.assertAlmostEqual(model.history_340b_share(h, 1.0), 1.0)
        self.assertIsNone(model.history_340b_share(dict(m=10, aaa_2021=0), 2.0))


def toy():
    hs = []
    for i in range(40):
        m = 1e9 * (1 + i % 5)  # dollars at the scale of real hospital systems, so kappa stays near 1
        cand = i % 2 == 0
        b = 0.1 + 0.01 * i if cand else 0.0
        s = max(0.15, b)
        nd = m * (1 - s)
        n = (m + model.GAIN * nd - model.CUT * b * m + 0.02 * m) * model.OFFSET_FACTOR
        hs.append(dict(ccn='%06d' % i, m=m, n=n, offset=True, charge_share=s, candidate=cand,
                       aaa_2021=b * m * 0.285 / 1.06 / 2, aaa_total=1.0))
    return hs


class Fit(unittest.TestCase):
    def test_parts_add_to_cms_net(self):
        res, _ = model.fit(toy(), 1.0, 0.75)
        for r in res:
            self.assertAlmostEqual(r['cut'] + r['gain'] + r['off'] + r['other'], r['n'] - r['m'], places=4)

    def test_cut_pinned_to_target(self):
        res, _ = model.fit(toy(), 1.0, 0.75)
        self.assertAlmostEqual(sum(r['cut'] for r in res), -model.TARGET_CUT, delta=1.0)

    def test_noncandidates_have_no_cut_and_range_contains_estimate(self):
        res, _ = model.fit(toy(), 1.0, 0.75)
        for r in res:
            if not r['candidate']:
                self.assertEqual(r['cut'], 0.0)
            self.assertLessEqual(r['b'], model.CAP)
            self.assertGreaterEqual(r['s'] + 1e-12, r['b'] / model.CAP)


class Table112(unittest.TestCase):
    def test_groups_exist(self):
        row = dict(geo='LURBAN', beds='520', region='MA', rural_sch='0', teaching='MAJOR', dsh_pct='0.4', ownership='3')
        self.assertEqual(groups(row), ['ALL', 'URBAN', 'LURBAN', 'UB500+', 'U-MA', 'MAJOR', 'DSH35+', 'GOV'])
        for g in groups(row):
            self.assertIn(g, TABLE)


class Outputs(unittest.TestCase):
    """The committed build output keeps its promises."""
    def setUp(self):
        p = HERE.parent / 'web' / 'src' / 'data' / 'swap.json'
        self.d = json.loads(p.read_text(encoding='utf-8'))

    def test_every_row_ties_to_cms(self):
        c = self.d['cols']
        ix = {k: c.index(k) for k in ('m', 'n', 'cut', 'gain', 'off', 'other')}
        for r in self.d['rows']:
            parts = r[ix['cut']] + r[ix['gain']] + r[ix['off']] + r[ix['other']]
            self.assertLessEqual(abs(parts - (r[ix['n']] - r[ix['m']])), 3)  # rounding of four whole-dollar parts

    def test_fit_quality(self):
        ch = self.d['meta']['checks']
        self.assertLess(ch['table112_rms_points'], 0.3)
        self.assertGreater(ch['nondrug_raise_vs_cut_pct'], 90)
        self.assertEqual(ch['hospitals'], 3502)


if __name__ == '__main__':
    unittest.main()
