// The whole page as DOM. Runs at build time (prerender, so the text reads without JavaScript) and again in the browser,
// where main.js mounts the interactive pieces into the slots.
import { h } from './dom.js';
import { money, count } from './format.js';
import { SITE, AS_OF, DISCLAIMER, RULE } from './site.js';
import { ledger, groupBars, raiseBar } from './charts.js';

const pi = (p) => h('span', { class: 'cite' }, `(final rule, p. ${p})`);
const a = (href, text) => h('a', { href }, text);

export function renderPage(data) {
  const T = data.totals;
  const C = data.meta.constants;
  const ch = data.meta.checks;
  const S = T.status;
  const p340 = S.in340;
  const backTo340 = Math.round(100 * p340.raiseShare);
  const outOf340 = -(p340.cut + p340.gain);

  const masthead = h('header', { class: 'masthead wide' },
    h('p', { class: 'mast-name' }, SITE.name),
    h('p', { class: 'mast-by' }, 'Built by ', a(SITE.linkedin, SITE.byline), h('span', { class: 'mast-date' }, `Rules and data as of ${AS_OF}`)));

  const hero = h('section', { class: 'hero', 'aria-labelledby': 'h1' },
    h('div', { class: 'wide' },
      h('h1', { id: 'h1' }, 'On January 1, Medicare moves ', h('span', { class: 'nowrap' }, '$4.65 billion'), ' between hospitals.'),
      h('p', { class: 'dek' }, 'It will pay much less for drugs hospitals buy at the 340B discount, and spend the savings paying every hospital 7.5% more '
        + 'for everything else. Each dot is one hospital, placed by how much CMS expects its 2027 outpatient payments to change.')),
    h('div', { class: 'wide swarm-block' },
      h('div', { class: 'swarm-counts' },
        h('p', { class: 'cnt neg' }, h('strong', null, count(T.losers)), ' hospitals get less'),
        h('p', { class: 'cnt pos' }, h('strong', null, count(T.gainers)), ' get more')),
      h('div', { id: 'swarm', class: 'swarm' },
        h('p', { class: 'nojs' }, `CMS expects ${count(T.losers)} of ${count(T.n)} hospitals to get less in 2027 and ${count(T.gainers)} to get more. `
          + 'The dot plot needs JavaScript; the per-hospital table is in the download below.')),
      h('div', { id: 'focus', class: 'focus', role: 'group', 'aria-label': 'Highlight a group of hospitals' }),
      h('p', { class: 'note' }, 'CMS’s estimate of every 2027 change to outpatient (OPPS) payments, the 340B parts included. Hospitals past 30% either way sit at the edges. '
        + 'Critical access hospitals and Maryland hospitals are paid another way and aren’t in it.')),
    h('div', { class: 'wide find-block' },
      h('div', { id: 'find-slot', class: 'find' }),
      h('div', { id: 'statement-slot', class: 'statement-slot', 'aria-live': 'polite' })));

  const how = h('section', { class: 'sec', id: 'how', 'aria-labelledby': 'how-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'how-h' }, 'Where the $4.65 billion comes from, and where it goes'),
      h('p', null, 'Hospitals that serve many low-income patients can join the federal 340B program and buy outpatient drugs at deep discounts. '
        + 'Medicare has paid them for those drugs as if they paid full price: the drug’s average sales price (ASP) plus 6%.'),
      h('p', null, 'From January 1, 2027, Medicare pays ASP minus 28% for drugs a hospital bought through 340B. That is 32% less per dose. '
        + 'CMS estimates the cut at $4.65 billion in a year, counting patients’ copays ', pi('1213'), '. The law requires these changes '
        + 'to be budget neutral, so the same $4.65 billion goes back out as a 7.5% raise on everything that isn’t a separately paid drug, '
        + 'at every hospital paid this way ', pi('110, 1213'), '.')),
    h('div', { class: 'wide' }, ledger(data)),
    h('div', { class: 'col' },
      h('p', null, 'Three groups don’t take the drug cut: rural sole community hospitals, children’s hospitals and cancer hospitals ', pi('661'), '. '
        + 'Vaccines and new drugs still on pass-through status are exempt too. Every hospital gets the raise.'),
      h('p', null, 'A second, smaller cut rides along. From 2018 to 2022 Medicare paid 340B drugs at ASP minus 22.5%, raised everything else to '
        + 'match, and lost in the Supreme Court (', h('i', null, 'American Hospital Association v. Becerra'), ', 2022). It repaid the 340B '
        + 'hospitals about $9 billion, then started taking back the $7.8 billion that everything else had been overpaid ', pi('523'), '. '
        + 'That “remedy offset” was 0.5% a year. In 2027 it becomes 2 points off the payment update, until the money is recovered, '
        + 'which CMS expects in 2031 ', pi('552'), '. It applies to almost every hospital that billed Medicare before 2018, 340B or not.')));

  const tip = h('section', { class: 'sec', id: 'tipping', 'aria-labelledby': 'tp-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'tp-h' }, 'One number decides most hospitals'),
      h('p', null, `A hospital loses 32 cents of each 340B drug dollar and gains 7.5 cents on each of its other dollars. If all its drugs are 340B, `
        + `those cancel when 340B drugs are ${Math.round(100 * T.breakeven)}% of its Medicare outpatient payments. Above that line, the swap costs it money. `
        + `About ${Math.round((100 * p340.n) / ch.hospitals)}% of hospitals in CMS’s estimate are 340B hospitals; `
        + `by this model, ${count(data.hospitals.filter((x) => x.b > T.breakeven).length)} of the ${count(p340.n)} are above the line.`),
      h('p', null, 'Move the rate to see how the picture shifts. ASP minus 33.4% is what CMS’s 2026 survey of hospitals’ drug costs found, '
        + 'and what CMS proposed in July. It settled on 28%, a figure built from 340B ceiling prices ', pi('630, 634'), '.')),
    h('div', { class: 'wide' }, h('div', { id: 'tipping-slot', class: 'tipping' },
      h('p', { class: 'nojs' }, 'An interactive scatter plot goes here; it needs JavaScript.'))));

  const who = h('section', { class: 'sec', id: 'who', 'aria-labelledby': 'who-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'who-h' }, 'Who comes out ahead'),
      h('p', null, 'CMS’s own estimate, by hospital group, before any modeling here. For-profit hospitals can’t join 340B, so they take '
        + 'no drug cut and keep the whole raise. Large teaching hospitals and those with the most low-income patients lose the most.')),
    h('div', { class: 'wide' }, groupBars(data)),
    h('div', { class: 'col' },
      h('p', null, `The money doesn’t travel as far as it looks. By this model, ${backTo340}% of the raise goes to 340B hospitals themselves, `
        + `because they also do a lot of non-drug work. Net, about ${money(outOf340, { digits: 1 })} leaves today’s 340B hospitals for everyone else, `
        + `and ${count(p340.losers)} of ${count(p340.n)} of them come out behind.`)),
    h('div', { class: 'wide' }, raiseBar(data)),
    h('div', { class: 'col' },
      h('p', null, `The losses are concentrated. Fifty hospitals carry ${Math.round(100 * T.top50LossShare)}% of all the dollars lost. `
        + 'The gains are spread thin across thousands.')));

  const states = h('section', { class: 'sec', id: 'states', 'aria-labelledby': 'st-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'st-h' }, 'State by state'),
      h('p', null, 'The 340B parts (drug cut, raise and offset, as modeled) added up for each state’s hospitals, as a share of their 2026 '
        + 'outpatient payments. Switch to every 2027 change to see CMS’s full estimate, which also carries Alaska and Hawaii’s new '
        + 'cost-of-living adjustment and this year’s wage-index changes. Maryland’s hospitals are paid under the state’s own model, so they aren’t here.')),
    h('div', { class: 'wide' }, h('div', { id: 'states-slot', class: 'states' })));

  const changed = h('section', { class: 'sec', id: 'changed', 'aria-labelledby': 'cg-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'cg-h' }, 'What the comment period changed'),
      h('table', { class: 'data-table compare' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, ''), h('th', { scope: 'col' }, 'July proposal'), h('th', { scope: 'col' }, 'November final'))),
        h('tbody', null,
          h('tr', null, h('th', { scope: 'row' }, '340B drug rate'), h('td', null, 'ASP − 33.4%'), h('td', null, 'ASP − 28%')),
          h('tr', null, h('th', { scope: 'row' }, 'Drug cut'), h('td', null, '$4.85 billion'), h('td', null, '$4.65 billion')),
          h('tr', null, h('th', { scope: 'row' }, 'Raise on everything else'), h('td', null, '8.44%'), h('td', null, '7.5%')),
          h('tr', null, h('th', { scope: 'row' }, 'Remedy offset'), h('td', null, '3 points'), h('td', null, '2 points')))),
      h('p', null, `Comparing CMS’s two hospital files, ${count(ch.flipped_to_gain)} hospitals went from losing under the proposal to gaining `
        + `under the final rule, and ${count(ch.flipped_to_loss)} went the other way. Each hospital’s proposed figure is on its statement above.`),
      h('p', { class: 'small' }, 'Sources: final rule pp. 105–106, 634, 681–682, 1213; proposed and final hospital impact files.')));

  const sides = h('section', { class: 'sec', id: 'sides', 'aria-labelledby': 'sd-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'sd-h' }, 'The argument, in each side’s words'),
      h('p', null, 'Quoted from the final rule, which summarizes thousands of public comments and answers them.')),
    h('div', { class: 'wide sides' },
      h('div', { class: 'side' },
        h('h3', null, 'Hospitals and their groups'),
        h('blockquote', null, h('p', null, '“340B status is not a relevant characteristic.”'), h('footer', null, 'Commenters on CMS’s authority to pay 340B hospitals differently, p. 624')),
        h('blockquote', null, h('p', null, 'The cuts “would threaten their ability to continue providing services.”'), h('footer', null, 'Commenters, p. 613')),
        h('blockquote', null, h('p', null, 'Patients’ out-of-pocket burden is “redistributed, not decreased.”'), h('footer', null, 'Commenters on copays, p. 653')),
        h('p', null, 'They also argued the survey drew too few responses to count as a “large sample of hospitals” under the statute (p. 578).')),
      h('div', { class: 'side' },
        h('h3', null, 'CMS'),
        h('blockquote', null, h('p', null, '“The nearly 40 percent discrepancy … is so drastic and obvious it needs to be addressed immediately.”'), h('footer', null, 'p. 681')),
        h('blockquote', null, h('p', null, '“[T]he purpose of the 340B Payment Policy is not to replace the 340B Program.”'), h('footer', null, 'p. 684')),
        h('blockquote', null, h('p', null, 'The offset “is not a penalty on hospitals.”'), h('footer', null, 'On the remedy offset, p. 546')),
        h('p', null, 'CMS also notes patients pay 20% of the drug rate, so their copays on 340B drugs fall, by about $1.1 billion in 2027 (p. 656). '
          + 'Copays on other services rise with the raise.'))),
    h('div', { class: 'col' },
      h('p', null, 'CMS based the cut on a survey of hospitals’ drug costs it ran from January to April 2026, the step the Supreme Court said '
        + 'was missing in 2022 (p. 523). 43.6% of the 4,494 hospitals surveyed responded (p. 574). Lawsuits over the new cut, if any, '
        + `aren’t reflected here; this page is current as of ${AS_OF}.`)));

  const methods = h('section', { class: 'sec methods', id: 'methods', 'aria-labelledby': 'mt-h' },
    h('div', { class: 'col' },
      h('h2', { id: 'mt-h' }, 'How this was built'),
      h('h3', null, 'What is CMS’s, and what is modeled'),
      h('p', null, 'Each hospital’s total change is CMS’s: its estimated 2026 and 2027 outpatient payments from the final rule’s hospital impact file, '
        + 'simulated from 2025 claims, Medicare and patient copays together. CMS doesn’t publish how much of each hospital’s total is 340B drugs. '
        + 'So the split is modeled here, and the last line, everything else, is whatever is left of CMS’s total. The parts always add up to CMS’s number.'),
      h('ul', null,
        h('li', null, h('strong', null, 'Drug share. '), 'From each hospital’s latest cost report (HCRIS, worksheet D part V): Medicare outpatient drug '
          + `charges as a share of all its Medicare outpatient charges, converted to a payment share with one national factor (${data.meta.fit.rho}) chosen so `
          + 'the model reproduces CMS’s published results for for-profit and rural hospitals, which have no 340B cut.'),
        h('li', null, h('strong', null, '340B drug share. '), 'Two estimates, blended 3 to 1. The first works back from CMS’s total: what 340B share leaves '
          + 'CMS’s number once the raise, the offset and the rule’s typical other changes are counted. The second is the hospital’s own 340B history: what '
          + 'Medicare withheld from it in 2021 under the old cut, from CMS’s 2023 remedy file, grown to today’s volume. All of it is scaled so the national '
          + 'cut equals CMS’s $4.65 billion. Only hospitals in 340B during 2025 get a drug cut.'),
        h('li', null, h('strong', null, 'Offset. '), 'CMS’s Addendum R lists who pays it. Its size is the ratio of the two 2027 conversion factors, '
          + `$${C.cf2027Offset.toFixed(3)} to $${C.cf2027.toFixed(3)}, applied the way CMS’s estimate applies it: to the hospital’s whole 2027 payment `
          + '(Table 112 shows −2.0% for every group, p. 1216). In actual claims the offset applies only to non-drug services (Addendum A), so for '
          + 'drug-heavy hospitals the real offset is somewhat smaller than CMS’s estimate implies.'),
        h('li', null, h('strong', null, 'Who counts as 340B. '), 'A hospital with an HRSA 340B registration in force at any time in 2025, the year of '
          + 'claims CMS simulated. Hospitals that joined in 2026 have no cut in CMS’s numbers, though they will in 2027; their statements say so.')),
      h('h3', null, 'How it was checked'),
      h('ul', null,
        h('li', null, `CMS publishes the 340B effect for ${Object.keys(data.meta.table112).length} hospital groups (Table 112, column 4). Added up the same way, `
          + `the model matches them within ${ch.table112_rms_points.toFixed(2)} percentage points on average.`),
        h('li', null, `The modeled raise totals ${money(ch.nondrug_raise_total)}, ${Math.round(ch.nondrug_raise_vs_cut_pct)}% of the $4.65 billion cut, `
          + 'without being fitted to it. Budget neutrality says they should match.'),
        h('li', null, `The modeled offset totals ${money(-ch.offset_total)} for ${count(ch.offset_hospitals)} hospitals, without being fitted. `
          + 'CMS projects about $1.6 billion (p. 1208).'),
        h('li', null, 'What is left over (everything else) is spread about the same for 340B hospitals as for the rest, centered between 2% and 3%, near the 2.3% update.')),
      h('h3', null, 'Limits'),
      h('ul', null,
        h('li', null, 'A single hospital’s split can be off, most of all for hospitals whose two estimates disagree; its statement shows the range. '
          + 'The total is CMS’s and isn’t a forecast of what the hospital will actually be paid.'),
        h('li', null, 'Cost reports are a year or two old, and 340B participation is HRSA’s list on Nov. 5, 2026.'),
        h('li', null, 'Off-campus departments paid under the physician fee schedule also take the 340B cut, without a raise; CMS puts that at '
          + '$640 million and it isn’t in the hospital file (p. 668).')),
      h('p', null, h('a', { href: 'data/340b-swap-cy2027-hospitals.csv', download: '' }, `Download all ${count(T.n)} hospitals (CSV)`)),
      h('h3', null, 'Sources'),
      h('ul', { class: 'sources' },
        h('li', null, a(RULE.pi, RULE.title), ', public-inspection copy, Nov. 4, 2026. Page numbers above refer to it.'),
        h('li', null, a(RULE.page, 'CMS-1850-FC supporting files'), ': the hospital impact file and Addendum R.'),
        h('li', null, a('https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient/regulations-notices/cms-1850-p', 'CMS-1850-P'), ': the proposed rule’s hospital impact file.'),
        h('li', null, a('https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient/regulations-notices/cms-1793-f', 'CMS-1793-F'), ' (2023 340B remedy), Addenda AAA and BBB.'),
        h('li', null, a('https://340bopais.hrsa.gov/Reports', 'HRSA 340B OPAIS'), ' covered-entity export, Nov. 5, 2026.'),
        h('li', null, a('https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports', 'CMS HCRIS'), ' hospital cost reports, FY 2023–2025.'))));

  const footer = h('footer', { class: 'foot' },
    h('div', { class: 'col' },
      h('p', null, DISCLAIMER),
      h('p', null, 'Built with Claude Code. Every figure is public federal data or a labeled estimate from it.')));

  return h('div', { class: 'page' }, masthead, h('main', { id: 'main' }, hero, how, tip, who, states, changed, sides, methods), footer);
}

