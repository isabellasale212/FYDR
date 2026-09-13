/* PATTERN-S9 (migration 0120): the athlete's data-consent state, as one
 * value the athlete shell, the entry forms and the squad list all read. Pure.
 *
 * Five states, from the athletes row:
 *   in_data           the performance decision is given, not declined, not
 *                     withdrawn — entries land, every denominator counts them
 *   undecided         no decision recorded (an adult who has not reached 3A)
 *   guardian_pending  under 18 and no decision recorded — a guardian answers
 *   declined          consent_declined_at set (artboard 3B)
 *   withdrawn         consent_withdrawn_at set (Settings › Your data)
 *
 * A declined or withdrawn athlete is in the squad, in the lists, has no
 * entries and no readiness, and is dropped from every count; the two
 * not-active-yet states render differently from those two (queue-pending
 * item 4). The database computes in_data; this function names the rest. */

export type ConsentState = 'in_data' | 'undecided' | 'guardian_pending' | 'declined' | 'withdrawn';

export type ConsentRow = {
  in_data: boolean | null;
  consent_given_at: string | null;
  consent_declined_at: string | null;
  consent_withdrawn_at: string | null;
};

export function consentState(row: ConsentRow, isMinor: boolean): ConsentState {
  if (row.in_data) return 'in_data';
  if (row.consent_withdrawn_at) return 'withdrawn';
  if (row.consent_declined_at) return 'declined';
  return isMinor ? 'guardian_pending' : 'undecided';
}

/** The date a not-active state carries on the squad list and the athlete's
 *  own screens: the decline, the withdrawal, or null for "not yet". */
export function consentStateAt(row: ConsentRow, state: ConsentState): string | null {
  if (state === 'declined') return row.consent_declined_at;
  if (state === 'withdrawn') return row.consent_withdrawn_at;
  return null;
}

/** The staff-side words beside a name. No judgement words; the date is the
 *  club's fact. */
export function consentStateLabel(state: ConsentState): string {
  switch (state) {
    case 'in_data':
      return 'In data';
    case 'undecided':
      return 'Not yet decided';
    case 'guardian_pending':
      return 'Guardian consent outstanding';
    case 'declined':
      return 'No data consent';
    case 'withdrawn':
      return 'Data consent withdrawn';
  }
}

/** True when the athlete's own entry forms are open. Only one state opens
 *  them; the other four lock all four forms (finding 3: the check-in, the
 *  rating, gym logging and the nutrition check-in are all the athlete
 *  entering data about themselves). */
export function entryFormsOpen(state: ConsentState): boolean {
  return state === 'in_data';
}

/** The athlete's own words for a locked form, by state. */
export function lockedFormLine(state: ConsentState): string {
  switch (state) {
    case 'guardian_pending':
      return 'This form opens once your guardian has answered. Nothing you type is held back waiting — it is simply not open yet.';
    case 'declined':
      return 'You said no to your data being recorded, so this form is closed. You can change that in Settings › Your data.';
    case 'withdrawn':
      return 'You withdrew your consent, so this form is closed. You can change that in Settings › Your data.';
    case 'undecided':
      return 'Read what staff can see and make your choice first.';
    case 'in_data':
      return '';
  }
}

/** j***@***.com — the shape artboard 4A masks a guardian's address to. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${local[0] ?? ''}***@***${tld}`;
}
