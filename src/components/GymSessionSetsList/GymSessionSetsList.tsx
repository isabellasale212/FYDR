import Link from 'next/link';
import type { GymSessionSetDetail } from '@/lib/queries/programmes';

type Props = {
  sets: readonly GymSessionSetDetail[];
  /** ATH-ADULT-13 C2 (2026-09-13): where a row's correction opens — the
   *  logger's own correction for that set (`/gym/[sessionId]?log=…&correct=…`),
   *  the one correction component since the chip-and-footer shape of 09 C1 /
   *  11 C1. Null when the log has no programme session to open the logger
   *  on, in which case the row simply has no control. */
  correctHref: (setId: string) => string | null;
};

/** My Data, gym tab, session detail — a flat list of the sets logged, each
 *  row linking to its correction in the logger. This component used to carry
 *  its own inline correction form (a second revise_gym_set_log path with its
 *  own validation); since 2026-09-13 the logger's correction is the one, so
 *  a set from any day is corrected in the same place with the same words. */
export function GymSessionSetsList({ sets, correctHref }: Props) {
  if (sets.length === 0) {
    return <p className="cap">No sets were logged for this session.</p>;
  }

  return (
    <div className="stack" style={{ gap: 'var(--sp-10)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <caption className="visually-hidden">Sets logged in this session</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Exercise</th>
              <th scope="col" className="r">
                Reps
              </th>
              <th scope="col" className="r">
                Load
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => {
              const href = correctHref(s.id);
              return (
                <tr key={s.id}>
                  <td className="num sub">{s.set_number}</td>
                  <td className="nm">{s.exercise_name}</td>
                  {/* Words for an absent number, never a dash — ATH-ADULT-12/13,
                      the rule the rest of My data follows. */}
                  <td className="r num" data-missing={s.reps_completed === null ? '' : undefined}>
                    {s.reps_completed ?? 'Not logged'}
                  </td>
                  <td className="r num" data-missing={s.load_kg === null ? '' : undefined}>
                    {s.load_kg !== null ? `${s.load_kg} kg` : 'Not logged'}
                  </td>
                  <td className="sub">
                    {href ? (
                      <Link href={href} className="btn-ghost" aria-label={`Correct set ${s.set_number} of ${s.exercise_name}`}>
                        Correct ›
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* The board's two sentences (ATH-ADULT-13). Both true of revise_gym_set_log
          (0044/0045): the original row is kept as superseded, and nothing limits
          how long after a session a set can be corrected. */}
      <p className="tiny">
        A correction keeps the original. Corrections stay open on a finished
        session.
      </p>
    </div>
  );
}
