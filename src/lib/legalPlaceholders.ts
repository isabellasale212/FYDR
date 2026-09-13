/** PATTERN-S9's legal gate: the seven placeholders the board names (and
 *  LEGAL-3F from finding 2) — their reference, the length the box is sized
 *  for, and what is needed. No legal wording is drafted, paraphrased or
 *  improved here: each caption says what is needed, never what it might say.
 *  The build ships with these visible; it does not ship to a real club until
 *  each is replaced. */
export const LEGAL_PLACEHOLDERS = {
  'LEGAL-1A': { lines: 2, needs: 'Where an athlete forwards a suspicious invite, and any wording about reporting it.' },
  'LEGAL-3A': { lines: 2, needs: 'Lawful basis and purpose, performance data. Two sentences.' },
  'LEGAL-3B': { lines: 4, needs: 'Explicit consent wording for health and injury data, including special-category handling.' },
  'LEGAL-3C': { lines: 2, needs: 'The club’s attestation that declining does not affect selection, and what Fydr may say on its behalf.' },
  'LEGAL-3D': { lines: 2, needs: 'The version identifier shown and stored, and the rule for when a wording change requires re-asking.' },
  'LEGAL-3E': { lines: 4, needs: 'Retention and deletion on decline or withdrawal: what is deleted, what is kept, for how long, and what the club keeps in its audit trail.' },
  'LEGAL-3F': { lines: 2, needs: 'How an athlete asks for their data (a subject access request), and what the club must do with it.' },
  'LEGAL-4A': { lines: 4, needs: 'Who holds the decision for an athlete under 18, whether the athlete’s own agreement is also required, and when it transfers to them.' },
} as const;

export type LegalRef = keyof typeof LEGAL_PLACEHOLDERS;

/** The version identifier stored with a decision until LEGAL-3D is drafted:
 *  it names the placeholders the screen showed, so a reviewer reading a row
 *  can see what was on screen. */
export const CONSENT_VERSION = 'placeholder:LEGAL-3A+3B:2026-09-13';
