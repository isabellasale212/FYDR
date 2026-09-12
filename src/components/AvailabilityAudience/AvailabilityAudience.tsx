/* Who will read what, said before an availability change lands — PATTERN-S3 /
 * STAFF-SS-02-05 C4, approved 2026-09-12. "The permission rule is made
 * visible at the moment it is exercised, rather than stated once in
 * settings." Rendered by both availability forms as the step between the
 * button and the write; the rows state what each reader can read TODAY under
 * the RLS in force (docs/access-matrix.md; 04-data-model.md §14), not what a
 * board proposes — when SS-01 D4 decides who reads the reason, this changes
 * with it, because it is the one place the rule is spoken to the person
 * setting it.
 *
 * No named coach: the data model has no per-athlete coach assignment, so the
 * coaches are named by role. The athlete is named by name.
 */

type Props = {
  athleteName: string;
  status: 'available' | 'modified' | 'unavailable';
  /** Whether this change is linked to an injury record (the medic's form)
   *  or a non-injury absence (the coach's). */
  injuryLinked: boolean;
  hasNote: boolean;
  onConfirm: () => void;
  onBack: () => void;
  pending: boolean;
};

const STATUS_WORD: Record<Props['status'], string> = {
  available: 'Available',
  modified: 'Modified',
  unavailable: 'Unavailable',
};

export function AvailabilityAudience({ athleteName, status, injuryLinked, hasNote, onConfirm, onBack, pending }: Props) {
  const word = STATUS_WORD[status];
  const noteClause = hasNote ? ', and your note' : '';
  return (
    <div className="avail-audience" role="group" aria-labelledby="avail-audience-title">
      <p className="label" id="avail-audience-title" style={{ margin: 0 }}>
        Before this lands — who will read what
      </p>
      <ul className="avail-audience-rows">
        <li>
          <b>{athleteName}</b> — on their phone, from now: <b>{word}</b>, the restrictions, the expected return
          {injuryLinked ? ', and the injury record except the clinical notes' : ', and the reason'}.
        </li>
        <li>
          <b>The coaches and the S&amp;C</b> — on the squad, the schedule and the dashboard: <b>{word}</b>, the
          restriction line{injuryLinked ? ', "Injury" as the reason' : ', the reason'}
          {noteClause}. Never a diagnosis, a mechanism or a protocol stage.
        </li>
        <li>
          <b>Medical staff and the sport scientist</b> — everything above, and the injury record in full.
        </li>
      </ul>
      <div className="avail-audience-actions">
        <button type="button" className="btn-primary" disabled={pending} onClick={onConfirm}>
          {pending ? 'Saving…' : 'Confirm and update'}
        </button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
