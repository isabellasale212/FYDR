/* 09-security-and-compliance.md §6: a SAR pack must carry "purposes,
 * categories, recipients, retention periods, source of the data, and the
 * existence of the other rights" in plain English, not just the rows
 * themselves. This is that document. It is static, versioned policy text,
 * not something generated per-request — an individual disclosure's
 * category counts and date range come from the actual query results in
 * sarPack.ts; this file is the same for every pack a club releases, the
 * same way a privacy notice is the same for every visitor.
 *
 * The retention figures below are transcribed from §7 of the same
 * document's own retention schedule, not invented for this file — copying
 * a number here that drifts from the real schedule would be worse than
 * not stating one. If that schedule changes, this file needs updating in
 * the same commit, the same rule CLAUDE.md §5 states for any doc/behaviour
 * change generally. */

export const SAR_MANIFEST_VERSION = '2026-08-08';

export type SarManifestCategory = {
  category: string;
  purpose: string;
  source: string;
  retention: string;
};

export const SAR_CATEGORIES: readonly SarManifestCategory[] = [
  {
    category: 'Profile and account details',
    purpose: 'Identifying you within your club and operating your account (contract, Article 6(1)(b)).',
    source: 'Provided by you or entered by your club when your account was created.',
    retention: 'Duration of squad membership plus 12 months, then pseudonymised, keeping only what a retained injury record still needs.',
  },
  {
    category: 'Wellness check-ins',
    purpose: 'Monitoring your recovery and readiness to train, and detecting patterns that may need a coach or medical response (contract; special category health data under Article 9(2)(h), health assessment).',
    source: 'Submitted by you.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Nutrition targets and weekly check-ins',
    purpose: 'Supporting nutrition guidance appropriate to your training load.',
    source: 'Set by your club’s staff; the weekly check-in answer is submitted by you.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Training load: RPE, gym sessions and sets, GPS',
    purpose: 'Managing training load and injury risk.',
    source: 'Submitted by you (RPE, gym) or recorded by GPS vendor hardware your club provided.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Test results and body composition',
    purpose: 'Tracking physical performance benchmarks over time.',
    source: 'Recorded by your club’s staff during testing sessions.',
    retention: 'Current season plus 5 completed seasons.',
  },
  {
    category: 'Session attendance',
    purpose: 'Recording your participation in scheduled training and matches.',
    source: 'Recorded by your club’s staff.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Availability status and restrictions',
    purpose: 'Communicating what you can and cannot do to coaching staff, without disclosing clinical detail to them (special category health data, Article 9(2)(h)).',
    source: 'Set by your club’s medical staff.',
    retention: 'As injury records, below.',
  },
  {
    category: 'Injury records (non-clinical: body area, dates, status)',
    purpose: 'Tracking injury history and return-to-play planning.',
    source: 'Recorded by your club’s medical staff.',
    retention: '8 years from injury closure. If you were under 18 at the time, until your 25th birthday or 8 years, whichever is longer.',
  },
  {
    category: 'Injury clinical detail (diagnosis, mechanism, clinical notes, treatment, imaging, referrals)',
    purpose: 'Clinical care and treatment planning (special category health data, Article 9(2)(h), provided by a health professional).',
    source: 'Recorded by your club’s medical staff.',
    retention: '8 years from last treatment entry. If you were under 18 at the time, until your 25th birthday or 8 years, whichever is longer. A specific note may be withheld from this pack under the Data Protection Act 2018, Schedule 3 Part 2 serious-harm test — see the covering note in this pack if any note is withheld.',
  },
  {
    category: 'Flags and coach/medical actions on them',
    purpose: 'Alerting staff to a meaningful change in your data so they can check in with you.',
    source: 'Generated automatically from the data above; actions on a flag are recorded by staff.',
    retention: 'Current season plus 3 completed seasons, as the underlying data.',
  },
  {
    category: 'Programme and rehab assignments',
    purpose: 'Delivering a gym or rehab programme prescribed to you.',
    source: 'Assigned by your club’s staff.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Squad group membership',
    purpose: 'Organising the squad for training and communication.',
    source: 'Set by your club’s staff.',
    retention: 'Duration of squad membership plus 12 months.',
  },
  {
    category: 'Compliance (expected vs. submitted entries)',
    purpose: 'Measuring how consistently expected entries were submitted, not their content.',
    source: 'Derived automatically from the categories above.',
    retention: 'Current season plus 3 completed seasons.',
  },
  {
    category: 'Consent records',
    purpose: 'Evidencing the lawful basis for processing your data, including parental consent if you were under 18 when you joined.',
    source: 'Recorded when consent was given.',
    retention: 'Duration of squad membership plus 12 months.',
  },
  {
    category: 'Processing records about you (audit log)',
    purpose: 'Recording who accessed or exported your data, and when — itself part of accountability under Article 5(2).',
    source: 'Generated automatically whenever staff read or export a category of your data above.',
    retention: '6 years for consent, erasure, subject access, clinical read, and support-access events. 24 months for other events.',
  },
] as const;

export const SAR_RECIPIENTS =
  'Your club’s coaching, medical and admin staff, within the limits set out above (coaching staff never receive clinical detail). ' +
  'Fydr, as the processor operating the platform on your club’s behalf, under a data processing agreement. ' +
  'No other organisation receives your personal data through this platform.';

export const SAR_YOUR_RIGHTS =
  'Alongside the right of access this pack responds to, UK GDPR gives you the right to rectification of inaccurate data (Article 16), ' +
  'to erasure in some circumstances (Article 17), to restrict processing (Article 18), to data portability for data you provided yourself (Article 20, available any time from Me → Export my data), ' +
  'to object to processing (Article 21), and the right to complain to the Information Commissioner’s Office (ico.org.uk) if you believe your data has been mishandled. ' +
  'Contact your club to exercise any of these.';
