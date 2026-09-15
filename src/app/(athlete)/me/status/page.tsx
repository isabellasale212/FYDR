import { InjuryClinical } from '@/components/InjuryClinical/InjuryClinical';
import { fetchAthleteAvailability } from '@/lib/queries/availability';
import { fetchAthleteInjuryClinical } from '@/lib/queries/athleteInjuryClinical';
import { fetchStaffName } from '@/lib/queries/staffName';
import { fetchMyProtocol } from '@/lib/queries/injuryStages';
import { restrictionLine } from '@/lib/restrictions';
import { canITrainToday, stageLadder, whatCanIDo, whenAmIBack } from '@/lib/statusScreen';
import { availabilityStatus } from '@/lib/status';
import { bodyAreaPhrase, enumLabel, formatDate, formatDateTime, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My status · Fydr' };

/** PATTERN-S3 C2: the athlete's status screen. Three cards in order — Can I
 *  train today · What can I do and not do · When am I back — answers as
 *  sentences, not pills; restrictions one row each; the stage ladder where a
 *  protocol exists (C3); medical detail lower, labelled for the athlete and
 *  their medical team; "Not known yet" where the medic has set nothing; the
 *  cleared state after an injury. Opening it marks the open availability row
 *  seen (C1, 0122) — the one act this screen performs, which is why the
 *  Today card goes. docs/athlete/screens/22-my-status.md. */
export default async function MyStatusPage() {
  const { db, orgId, athleteId, timezone } = await requireAthlete();
  const today = todayIso(timezone);
  const [availability, protocol] = await Promise.all([fetchAthleteAvailability(db, orgId, athleteId), fetchMyProtocol(db, athleteId)]);
  const current = availability.current;
  const injury = availability.injury;
  const [clinical, setBy, lastClosed] = await Promise.all([
    fetchAthleteInjuryClinical(db, injury?.id),
    current ? fetchStaffName(orgId, current.set_by) : Promise.resolve(null),
    db.from('injuries').select('actual_return').eq('athlete_id', athleteId).eq('status', 'closed').not('actual_return', 'is', null).order('actual_return', { ascending: false }).limit(1).maybeSingle(),
  ]);
  /* The read receipt: the open row is now seen. Idempotent; the athlete's own
     row only (mark_availability_seen, 0122). */
  if (current && current.athlete_seen_at === null) await db.rpc('mark_availability_seen');

  const restrictions = restrictionLine(current?.restrictions);
  const q1 = canITrainToday({ status: current?.status ?? null, reason: current?.reason_category ?? null, restrictions, note: current?.note ?? null });
  const q2 = whatCanIDo({ status: current?.status ?? null, restrictions, note: current?.note ?? null, label: enumLabel });
  const clearedOn = !injury && lastClosed.data?.actual_return && (current?.status === 'available' || !current) ? lastClosed.data.actual_return : null;
  const q3 = whenAmIBack({ status: current?.status ?? null, expectedReturn: injury?.expected_return ?? null, today, clearedOn, format: (d) => formatDate(d, timezone) });
  const ladder = stageLadder(protocol?.current_stage ?? null, protocol?.total_stages ?? null, injury === null && protocol !== null);
  const word = availabilityStatus(current?.status ?? null);

  return (
    <>
      {/* The head /me/notifications uses: the layout's Back button stands
          above it, so the page draws no dismiss of its own. */}
      <div className="hd">
        <h1 className="d">My status</h1>
      </div>

      <div className="stack">
        <section className="card" aria-labelledby="q1" data-status-card="train">
          <h2 className="card-title" id="q1">
            {q1.heading}
          </h2>
          <p className="td-name" style={{ fontSize: 'var(--fs-20)' }}>{q1.sentence}</p>
          {q1.sub ? <p className="import-sub" style={{ marginBottom: 0 }}>{q1.sub}</p> : null}
          {current ? (
            <p className="tiny num" style={{ marginTop: 'var(--sp-8)' }}>
              {word.label} · set by {setBy ? `${setBy.name}${setBy.role ? `, ${setBy.role}` : ''}` : 'the club'} · {formatDateTime(current.effective_from, timezone)}
              {current.note ? ` · “${current.note}”` : ''}
            </p>
          ) : null}
        </section>

        <section className="card" aria-labelledby="q2" data-status-card="do">
          <h2 className="card-title" id="q2">
            {q2.heading}
          </h2>
          {q2.sentence ? (
            <p className="import-sub" style={{ marginBottom: 0 }}>{q2.sentence}</p>
          ) : (
            <ul className="pw-rules" aria-label="Restrictions">
              {q2.rows.map((r) => (
                <li key={r} className="pw-rule" data-state="unmet" style={{ minHeight: 'var(--tap-min)', alignItems: 'center' }}>
                  <span className="pw-rule-mark" aria-hidden="true">–</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="q3" data-status-card="back">
          <h2 className="card-title" id="q3">
            {q3.heading}
          </h2>
          <p className="td-name" style={{ fontSize: 'var(--fs-20)' }}>{q3.sentence}</p>
          {q3.sub ? <p className="import-sub" style={{ marginBottom: 0 }}>{q3.sub}</p> : null}
          {/* The academy slot: a place, not a policy (board notes). No club
              setting for academy return rules exists (open question 9), so the
              line states that nothing is recorded and claims nothing about age. */}
          <p className="tiny" style={{ marginTop: 'var(--sp-8)' }} data-academy-slot>
            If the club sets different return rules for academy athletes, they appear here. None are recorded.
          </p>
        </section>

        {ladder.length > 0 ? (
          <section className="card" aria-labelledby="ladder" data-status-card="ladder">
            <h2 className="card-title" id="ladder">
              Return to play
            </h2>
            <p className="import-sub">
              {protocol!.total_stages} stages in the club’s protocol. The criteria for each live in the protocol; the physiotherapist moves you on.
            </p>
            <ol className="install-steps" aria-label="Stages">
              {ladder.map((r) => (
                <li key={r.n} className="install-step" data-rung={r.state} style={{ minHeight: 'var(--tap-min)', alignItems: 'center' }}>
                  <span className="install-step-n" aria-hidden="true" style={r.state === 'now' ? undefined : { background: 'var(--surf2)', color: 'var(--muted)' }}>
                    {r.n}
                  </span>
                  <span>
                    Stage {r.n} · <b>{r.state === 'done' ? 'Done' : r.state === 'now' ? 'Now' : r.state === 'next' ? 'Next' : r.state === 'cleared' ? 'Cleared' : 'Later'}</b>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {injury ? (
          <section className="card" aria-labelledby="medical" data-status-card="medical">
            <p className="eyebrow">For you and your medical team</p>
            <h2 className="card-title" id="medical">
              {bodyAreaPhrase(injury)} · {enumLabel(injury.status)}
            </h2>
            <p className="import-sub">Since {formatDate(injury.onset_date, timezone)}.</p>
            {clinical.diagnosis || clinical.mechanism ? (
              <InjuryClinical diagnosis={clinical.diagnosis} mechanism={clinical.mechanism} />
            ) : (
              <p className="tiny">No diagnosis or mechanism has been recorded for you to read yet.</p>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
