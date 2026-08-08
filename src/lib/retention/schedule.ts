/* 09-security-and-compliance.md §7's own retention schedule, transcribed
 * faithfully — the same rule this build already applies to the SAR
 * pack's own manifest (lib/subjectAccess/manifest.ts): a number here that
 * drifts from the real schedule is worse than not stating one, so if §7
 * changes, this file needs updating in the same commit.
 *
 * This is reference/display data only. The actual cutoff computation
 * lives in compute.ts, which encodes the same rules as real date
 * arithmetic rather than just displaying them. */

export type RetentionScheduleRow = {
  category: string;
  retention: string;
  clockStartsOn: string;
  automated: boolean;
  note?: string;
};

export const RETENTION_SCHEDULE: readonly RetentionScheduleRow[] = [
  {
    category: 'Injury clinical detail (diagnosis, notes, treatment)',
    retention: '8 years. Under 18 at closure: until 25th birthday, or 8 years, whichever is longer.',
    clockStartsOn: 'Injury closure',
    automated: true,
  },
  {
    category: 'Injuries, availability, rehab assignments',
    retention: 'As clinical detail — part of the same record.',
    clockStartsOn: 'Injury closure',
    automated: true,
    note: 'This pass redacts the injury row itself; availability and rehab_assignments rows referencing it are not yet redacted in step — a real, separate piece of the same work.',
  },
  {
    category: 'Wellness, training, gym session and set logs',
    retention: 'Current season plus 3 completed seasons.',
    clockStartsOn: 'Season end',
    automated: false,
    note: 'Preview only — none of these tables has a deleted_at column yet. Adding one to four tables and updating every read path that queries them is real, separate work.',
  },
  {
    category: 'GPS records',
    retention: 'Current season plus 3 completed seasons.',
    clockStartsOn: 'Season end',
    automated: false,
    note: 'Same gap as above — gps_records has no deleted_at column.',
  },
  {
    category: 'Test results, body composition',
    retention: 'Current season plus 5 completed seasons.',
    clockStartsOn: 'Test date',
    automated: false,
    note: 'test_results has a deleted_at column and is redacted for real by this pass; body_composition does not yet, so it is preview only.',
  },
  {
    category: 'Import batch raw files',
    retention: '30 days.',
    clockStartsOn: 'Upload',
    automated: true,
    note: 'Genuinely deleted, not redacted — these are reconciliation metadata for a failed import, never athlete data.',
  },
  {
    category: 'Audit log',
    retention: '24 months general; 6 years for consent, erasure, SAR, clinical read, support access, role change.',
    clockStartsOn: 'Event',
    automated: false,
    note: 'Not automated in this pass, deliberately: audit_log has no update or delete policy anywhere in this schema, on purpose (migration 0012), because it is itself the compliance record. Automating its own expiry needs a distinct, carefully-scoped process this pass does not build.',
  },
  {
    category: 'Deactivated staff accounts',
    retention: '12 months, then anonymise.',
    clockStartsOn: 'Deactivation',
    automated: false,
    note: 'Real, separate work — anonymising a users row while preserving audit_log attribution needs its own careful design.',
  },
  {
    category: 'Athlete identity and contact details',
    retention: 'Duration of squad membership plus 12 months, then pseudonymise.',
    clockStartsOn: 'athletes.left_at',
    automated: false,
    note: "The compliance doc's own words: \"retaining only the link needed for retained injury records\" — genuinely hard to get right, real, separate work.",
  },
] as const;
