export const SITE = {
  name: 'The 340B Swap',
  url: 'https://340b-swap.vercel.app',
  byline: 'Dalton Haslam, MD, MBA',
  linkedin: 'https://www.linkedin.com/in/dalton-haslam',
  repo: 'https://github.com/daltonhaslam/340b-swap',
};

// Reader feedback: a shared Google Form, with this site and page prefilled (both visible and editable by the reader).
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSekdB41siZs44_4gLNBGD2OqalK2TGNk7o8Q0bHl20ggYBy_Q/viewform';
export const FEEDBACK = `${FORM}?entry.2047320042=${encodeURIComponent(SITE.name)}&entry.1326474028=${encodeURIComponent(SITE.url)}`;

// Everything on the page is as of this date: the final rule went on public inspection Nov. 4, 2026.
export const AS_OF = 'Nov. 5, 2026';

export const DISCLAIMER = 'An independent, personal project. It does not represent the work or the view of the author’s employer, CMS, '
  + 'HRSA, or any hospital, drug maker or industry group.';

export const RULE = {
  title: 'CY 2027 OPPS/ASC final rule with comment period (CMS-1850-FC)',
  pi: 'https://public-inspection.federalregister.gov/2026-22739.pdf',
  page: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient/regulations-notices/cms-1850-fc',
};
