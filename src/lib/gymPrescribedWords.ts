/* PATTERN-S5 C1 (0111): the words for the prescription a logged set was
 * logged against, read from the row itself — never re-read from the
 * programme. "Not recorded" for a set logged before the snapshot existed or
 * with none to state; a bodyweight set prescribed reps only reads "8 reps".
 * Words, never a dash or a zero. Pure; exercised by
 * scripts/test-gym-prescription-snapshot.ts. */
export function prescribedWords(s: { prescribed_reps: number | null; prescribed_load_kg: number | null }): string {
  if (s.prescribed_load_kg === null && s.prescribed_reps === null) return 'Not recorded';
  if (s.prescribed_load_kg === null) return `${s.prescribed_reps} reps`;
  if (s.prescribed_reps === null) return `${s.prescribed_load_kg} kg`;
  return `${s.prescribed_load_kg} kg × ${s.prescribed_reps}`;
}
