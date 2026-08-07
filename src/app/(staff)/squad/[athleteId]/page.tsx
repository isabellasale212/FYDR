import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchAthleteInjuries } from '@/lib/queries/injuries';
import { fetchAthleteRecentSessions } from '@/lib/queries/schedule';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import {
  BLANK,
  addDays,
  ageFrom,
  enumLabel,
  formatDate,
  formatNumber,
  formatTime,
  todayIso,
} from '@/lib/format';
import { bandPosition } from '@/lib/stats';
import { availabilityStatus } from '@/lib/status';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Athlete · Fydr' };

const WINDOW_DAYS = 42;
const ROLLING_DAYS = 14;

function dateRange(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

export default async function AthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { athleteId } = await params;
  const { error: sarError } = await searchParams;
  const { db, orgId, timezone, claims } = await requireStaff();

  const today = todayIso(timezone);
  const from = addDays(today, -(WINDOW_DAYS - 1));

  const athlete = await fetchAthlete(db, orgId, athleteId);
  if (!athlete) notFound();

  const [entries, injuries, sessions] = await Promise.all([
    fetchWellnessByAthlete(db, athleteId, { from, to: today }),
    fetchAthleteInjuries(db, orgId, athleteId),
    fetchAthleteRecentSessions(db, orgId, athleteId, from, today),
  ]);

  const dates = dateRange(from, WINDOW_DAYS);
  const series = wellnessSeries(entries, dates, 'readiness', ROLLING_DAYS);
  const submitted = series.filter((s) => s.value !== null).length;
  const outside = series.filter((s) => {
    const p = bandPosition(s);
    return p === 'above' || p === 'below';
  }).length;

  const status = availabilityStatus(athlete.availability?.status ?? null);
  const restrictions = athlete.availability?.restrictions ?? [];
  const age = ageFrom(athlete.date_of_birth);
  const openInjury = athlete.open_injuries[0];

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/squad">Squad overview</Link> · Athlete
          </p>
          <h1>
            {athlete.first_name} {athlete.last_name}
          </h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="pbar">
        <div className="l1">
          <span className="nmx">
            {athlete.first_name} {athlete.last_name}
          </span>
          <span className="sub">
            {athlete.position ?? BLANK}
            {age !== null ? ` · ${age}` : ''}
            {athlete.team_name ? ` · ${athlete.team_name}` : ''}
          </span>
          <Pill status={status} />
          {restrictions.length > 0 ? (
            <span className="sub">{restrictions.map(enumLabel).join(' · ')}</span>
          ) : null}
        </div>
        <div className="l2">
          <span>
            Squad no.{' '}
            <b className="mono">{athlete.squad_number ?? BLANK}</b>
          </span>
          <span className="dot">·</span>
          <span>
            Height{' '}
            <b className="mono">
              {athlete.height_cm !== null ? `${athlete.height_cm} cm` : BLANK}
            </b>
          </span>
          <span className="dot">·</span>
          <span>
            Groups{' '}
            <b>{athlete.group_names.length > 0 ? athlete.group_names.join(', ') : BLANK}</b>
          </span>
          {openInjury ? (
            <>
              <span className="dot">·</span>
              <span>
                {enumLabel(openInjury.body_area)}
                {openInjury.side ? ` (${enumLabel(openInjury.side)})` : ''}, back{' '}
                <b className="mono">
                  {openInjury.expected_return
                    ? formatDate(openInjury.expected_return)
                    : 'not set'}
                </b>
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="profile-grid">
        <div className="stack">
          <section className="card" aria-labelledby="wellness-title">
            <h2 className="card-title" id="wellness-title">
              Wellness
            </h2>
            <p className="import-sub">
              Composite readiness against his own {ROLLING_DAYS} day rolling mean
              and &plusmn;1SD band. The question is never what he scored, it is
              whether this is normal for him.
            </p>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--accent)' }} /> {ROLLING_DAYS} day
                rolling mean
              </span>
              <span>
                <i
                  className="sq"
                  style={{ background: 'rgb(var(--accent-rgb) / 0.14)' }}
                />{' '}
                his own &plusmn;1 SD
              </span>
              <span>
                <i
                  className="sq"
                  style={{ background: 'var(--muted)', borderRadius: '50%' }}
                />{' '}
                daily value
              </span>
              <span className="g-warn">△ above band</span>
              <span className="g-bad">▽ below band</span>
            </div>

            {submitted === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No wellness entries in this window"
                body="Nothing has been submitted in the last 42 days. That is an absence of data, not a low score."
              />
            ) : (
              <WellnessChart
                series={series}
                min={0}
                max={100}
                ticks={[0, 25, 50, 75, 100]}
                title={`Readiness for ${athlete.first_name} ${athlete.last_name}`}
              />
            )}

            <p className="cap">
              Self-reported, morning form.{' '}
              <b>
                {submitted} of {WINDOW_DAYS}
              </b>{' '}
              days submitted; the {WINDOW_DAYS - submitted} missing days are drawn
              as gaps, never as zero. {outside} day
              {outside === 1 ? '' : 's'} fell outside his own band.
            </p>
          </section>

          <section className="card" aria-labelledby="sessions-title">
            <h2 className="card-title" id="sessions-title">
              Recent sessions
            </h2>
            <p className="import-sub">
              What he was scheduled for and what he reported afterwards. A blank
              RPE means no entry, which is not the same as an easy session.
            </p>
            {sessions.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No sessions in this window"
                body="He is not named in any session in the last 42 days, directly or through a group."
              />
            ) : (
              <table className="tbl">
                <caption className="visually-hidden">
                  Recent sessions with reported RPE
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Session</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="r">
                      Minutes
                    </th>
                    <th scope="col" className="r">
                      RPE
                    </th>
                    <th scope="col" className="r">
                      Load
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} style={{ opacity: session.status === 'cancelled' ? 0.55 : 1 }}>
                      <td className="mono sub">
                        {formatDate(session.starts_at)}{' '}
                        {formatTime(session.starts_at)}
                      </td>
                      <td className="nm">{session.title}</td>
                      <td className="sub">
                        {enumLabel(session.session_type)}
                        {session.status === 'cancelled' ? (
                          <span className="pill pill-bad" style={{ marginInlineStart: 6 }}>
                            Cancelled
                          </span>
                        ) : null}
                      </td>
                      <td className="r mono">
                        {session.duration_min ?? BLANK}
                      </td>
                      <td className="r mono">
                        {formatNumber(session.rpe, 1)}
                      </td>
                      <td className="r mono">
                        {formatNumber(session.session_load, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card" aria-labelledby="injury-title">
            <h2 className="card-title" id="injury-title">
              Injury and availability
            </h2>
            <p className="import-sub">
              Body area, side, onset and expected return. Diagnosis, mechanism
              and treatment are medical only and are not fetched here.
            </p>
            {injuries.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No injury recorded"
                body="Nothing has been logged against this athlete."
              />
            ) : (
              <table className="tbl">
                <caption className="visually-hidden">Injury history</caption>
                <thead>
                  <tr>
                    <th scope="col">Body area</th>
                    <th scope="col">Side</th>
                    <th scope="col">Onset</th>
                    <th scope="col">Status</th>
                    <th scope="col">Expected return</th>
                  </tr>
                </thead>
                <tbody>
                  {injuries.map((injury) => (
                    <tr key={injury.id}>
                      <td className="nm">{enumLabel(injury.body_area)}</td>
                      <td className="sub">{enumLabel(injury.side)}</td>
                      <td className="mono sub">{formatDate(injury.onset_date)}</td>
                      <td className="sub">{enumLabel(injury.status)}</td>
                      <td className="mono sub">
                        {injury.actual_return
                          ? `Returned ${formatDate(injury.actual_return)}`
                          : injury.expected_return
                            ? formatDate(injury.expected_return)
                            : BLANK}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="availability-title">
            <h2 className="card-title" id="availability-title">
              Availability
            </h2>
            <div className="kv">
              <span className="sub">Status</span>
              <Pill status={status} />
            </div>
            <div className="kv">
              <span className="sub">Reason</span>
              <span className="sub">
                {enumLabel(athlete.availability?.reason_category ?? null)}
              </span>
            </div>
            <div className="kv">
              <span className="sub">Set</span>
              <span className="mono sub">
                {athlete.availability
                  ? formatDate(athlete.availability.effective_from)
                  : BLANK}
              </span>
            </div>
            <p className="cap">
              Set by medical staff. A coach sees no control at all, here or
              anywhere.
            </p>
          </section>

          <section className="card" aria-labelledby="restrictions-title">
            <h2 className="card-title" id="restrictions-title">
              Restrictions
            </h2>
            {restrictions.length === 0 ? (
              <p className="cap">No restriction recorded.</p>
            ) : (
              restrictions.map((restriction) => (
                <div className="kv" key={restriction}>
                  <span className="sub">{enumLabel(restriction)}</span>
                  <Pill
                    status={availabilityStatus('modified')}
                    label="In force"
                  />
                </div>
              ))
            )}
          </section>

          {claims.roles.includes('admin') ? (
            <section className="card" aria-labelledby="sar-title">
              <h2 className="card-title" id="sar-title">
                Subject access request
              </h2>
              <p className="cap" style={{ marginBottom: 10 }}>
                Article 15, UK GDPR. Generates every row referencing {athlete.first_name} across every table, once
                medical has reviewed any clinical detail.
              </p>
              {sarError ? (
                <p className="form-error" role="alert" style={{ marginBottom: 10 }}>
                  {sarError}
                </p>
              ) : null}
              <form action={`/squad/${athleteId}/subject-access`} method="post">
                <button type="submit" className="btn-ghost">
                  Generate subject access pack →
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
