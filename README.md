# The 340B Swap

**On January 1, 2027, Medicare moves $4.65 billion between hospitals.**

Medicare will pay much less for outpatient drugs that hospitals buy through the 340B discount program: ASP minus 28%, down
from ASP plus 6%. The law keeps the change budget neutral, so the same $4.65 billion goes back out as a 7.5% raise on
everything else every outpatient hospital is paid for. This site shows which side of that trade each of 3,502 hospitals
lands on, and why.

Live site: **https://340b-swap.vercel.app**

## What the site shows

- Every hospital as one dot, in a field that rearranges as you scroll: by CMS's estimated change in 2027 outpatient
  payments, by kind of hospital, by how much of its payments are 340B drugs (with a slider for the 340B rate), and state by
  state.
- A statement for any hospital: CMS's estimated change, split into the 340B drug cut, the 7.5% raise, the 340B remedy
  offset, and everything else in the rule. The four lines always add up to CMS's number.
- How the swap works, CMS's own results by hospital group, what changed between the July proposal and the final rule, and
  each side's argument quoted from the rule.

## What is CMS's and what is modeled

Each hospital's total change is CMS's own estimate, from the final rule's hospital impact file. CMS doesn't publish how
much of a hospital's payments are 340B drugs, so the split is modeled, and the last line (everything else) is whatever is
left of CMS's number.

- **Drug share:** each hospital's Medicare outpatient drug charges as a share of its Medicare outpatient charges (cost
  report worksheet D part V), converted to a payment share with one national factor.
- **340B drug share:** a 3-to-1 blend of (a) the share that, with the rule's other changes at their typical size, leaves
  CMS's number, and (b) the hospital's own 340B history from CMS's 2023 remedy file, grown to today's volume. Scaled so the
  national cut equals CMS's $4.65 billion. Only hospitals with an HRSA 340B registration in force during 2025 (the year of
  claims CMS simulated) get a cut; rural sole community hospitals are exempt.
- **Remedy offset:** CMS's Addendum R lists who pays it; its size is the ratio of the two 2027 conversion factors, applied
  the way CMS's estimate applies it.

Checks, in `pipeline/out/checks.txt`:
- Summed by hospital group, the model matches CMS's own 340B results (final rule Table 112, column 4) for all 50 groups
  within 0.17 percentage points.
- Not fitted: the modeled raise totals $4.56 billion against the $4.65 billion cut (budget neutrality says they match), and
  the modeled offset totals $1.64 billion against CMS's "about $1.6 billion."
- Every hospital's four lines sum to CMS's estimate (tested).

A single hospital's split can be off, most of all where its two 340B estimates disagree; its statement shows the range.

## Data

| Source | Used for |
|---|---|
| CMS, CY 2027 OPPS final rule (CMS-1850-FC): hospital impact file, Addendum R | Each hospital's estimated 2026 and 2027 payment; who pays the remedy offset |
| CMS, CY 2027 OPPS proposed rule (CMS-1850-P): hospital impact file | The proposal's estimate, for comparison |
| CMS, 340B remedy final rule (CMS-1793-F), Addendum AAA | Each hospital's 340B drug history, 2018–2022 |
| HRSA 340B OPAIS covered-entity export (Nov. 5, 2026) | 340B status and registration dates (contact fields dropped) |
| CMS HCRIS hospital cost reports, FY 2023–2025 | Medicare outpatient drug and total charges; city, state |
| The final rule's text (public-inspection copy, Nov. 4, 2026) | Rates, factors, exemptions, quotes; page numbers on the site refer to it |

Every raw file is pinned by SHA-256 in `pipeline/sources.json`. The raw files are not in the repo (about 2.7 GB with the
cost reports); the small tables the model reads are, in `pipeline/derived/`.

## Build

```
python3 -I pipeline/extract.py      # raw files in data/raw/ -> pipeline/derived/ (needs the raw files)
python3 -I pipeline/build_data.py   # fit the model, run the checks, write web/src/data/swap.json and the CSV
python3 -I pipeline/run_tests.py
cd web && npm install && node build.mjs && node og.mjs   # docs/index.html, docs/og.png
npm test                             # drives the built page in Chromium
```

The output is one self-contained page, `docs/index.html`, with styles, data and script inlined and fonts served from the
same site (SIL Open Font License). It makes no third-party requests, sets no cookies and has no analytics. The text is
prerendered, so it reads without JavaScript; the dot field and the statements need it.

## Feedback

Spot something wrong? Use the feedback link on the site.

## License

Code: MIT (see `LICENSE`). Data: public US federal data.

Also by the same author: [Paid & Penalized](https://paidandpenalized.org), on how Medicare pays and penalizes hospitals.

An independent, personal project. Built by Dalton Haslam, MD, MBA, with Claude Code. Does not represent the work or the
view of the author's employer, CMS, HRSA, or any hospital, drug maker or industry group.
