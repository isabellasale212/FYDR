import Link from 'next/link';
import { AvailabilityBanner } from '@/components/AvailabilityBanner/AvailabilityBanner';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { OutboxFlusher } from '@/components/OutboxFlusher/OutboxFlusher';
import { Pill } from '@/components/Pill/Pill';
import { fetchAthleteAvailability } from '@/lib/queries/availability';
import { fetchMyOutstanding } from '@/lib/queries/compliance';
import { fetchAthleteDaySessions, mondayOf } from '@/lib/queries/schedule';
import { fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import { fetchMyAllocation } from '@/lib/queries/teamAllocation';
import { COMPLIANCE_STATUS } from '@/lib/status';
import {
  BLANK,
  addDays,
  enumLabel,
  formatDate,
  formatTime,
  initials,
  mdLabel,
  todayIso,
} from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Today · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, claims, timezone, firstName, lastName } =
    await requireAthlete();
  const params = await searchParams;
  const today = todayIso(timezone);

  const nutritionWeekStart = addDays(mondayOf(today), -7);
  const weekStart = mondayOf(today);

  const [availability, outstanding, sessions, nutritionCheckin, myAllocation, nutritionTarget] =
    await Promise.all([
      fetchAthleteAvailability(db, orgId, athleteId),
      fetchMyOutstanding(db, athleteId, today),
      fetchAthleteDaySessions(db, orgId, athleteId, today),
      fetchCheckinForWeek(db, athleteId, nutritionWeekStart),
      fetchMyAllocation(db, athleteId, weekStart),
      resolveTargetForDate(db, athleteId, today),
    ]);

  const submittedKind =
    params.submitted === '1'
      ? 'wellness'
      : params.submitted === 'rpe'
        ? 'rpe'
        : params.submitted === 'nutrition'
          ? 'nutrition'
          : null;

  return (
    <>
      <div className="hd">
        <span className="av" aria-hidden="true">
          {initials({ first_name: firstName, last_name: lastName })}
        </span>
        <h1 className="d">{formatDate(today)}</h1>
      </div>

      <OutboxFlusher
        orgId={orgId}
        athleteId={athleteId}
        userId={claims.userId}
      />

      {submittedKind === 'wellness' ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Check-in saved.</b> Thanks. You are done for the morning.
          </span>
        </p>
      ) : submittedKind === 'rpe' ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Rating saved.</b> Thanks.
          </span>
        </p>
      ) : submittedKind === 'nutrition' ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Nutrition check-in done.</b> Thanks.
          </span>
        </p>
      ) : null}

      <AvailabilityBanner
        status={availability.current?.status ?? null}
        restrictions={availability.current?.restrictions ?? []}
      />

      {myAllocation ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Team this week: {myAllocation.team_name}.</b> Set by your coach.
          </span>
        </p>
      ) : null}

      {nutritionTarget ? (
        <section aria-labelledby="fuelling-title">
          <h2 className="sect" id="fuelling-title">
            Fuelling today
          </h2>
          <div className="card">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                gap: 12,
              }}
            >
              {nutritionTarget.protein_g !== null ? (
                <div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {nutritionTarget.protein_g}g
                  </div>
                  <div className="tiny">Protein</div>
                </div>
              ) : null}
              {nutritionTarget.carbs_g !== null ? (
                <div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {nutritionTarget.carbs_g}g
                  </div>
                  <div className="tiny">Carbs</div>
                </div>
              ) : null}
              {nutritionTarget.fat_g !== null ? (
                <div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {nutritionTarget.fat_g}g
                  </div>
                  <div className="tiny">Fat</div>
                </div>
              ) : null}
              {nutritionTarget.fluid_ml !== null ? (
                <div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {(nutritionTarget.fluid_ml / 1000).toFixed(1)}L
                  </div>
                  <div className="tiny">Fluid</div>
                </div>
              ) : null}
              {nutritionTarget.energy_kcal !== null ? (
                <div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {nutritionTarget.energy_kcal}
                  </div>
                  <div className="tiny">kcal</div>
                </div>
              ) : null}
            </div>
            <p className="tiny" style={{ marginTop: 10 }}>
              {nutritionTarget.md_specific
                ? `Set for ${mdLabel(nutritionTarget.md_offset) ?? 'today'}.`
                : 'Your standing target.'}{' '}
              Guidance only &mdash; nothing to log here.
            </p>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="todo-title">
        <h2 className="sect" id="todo-title">
          To do{' '}
          <span className="mono" style={{ color: 'var(--faint)' }}>
            {outstanding.length}
          </span>
        </h2>
        {outstanding.length === 0 ? (
          <div className="card">
            <p className="sub" style={{ margin: 0 }}>
              <span className="g-good" aria-hidden="true">
                ✓{' '}
              </span>
              Nothing outstanding. Everything expected of you today is in.
            </p>
          </div>
        ) : (
          <div className="card flush">
            {outstanding.map((item, index) => (
              <div key={`${item.domain}-${item.session_id ?? index}`}>
                {index > 0 ? <div className="hair" /> : null}
                <Link href={item.href} className="todo">
                  <span className="gl" aria-hidden="true">
                    ♥
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {item.label}
                    </span>
                    <span
                      className="tiny"
                      style={{ display: 'block', marginTop: 2 }}
                    >
                      {enumLabel(item.domain)} · about{' '}
                      <span className="mono">30</span> seconds
                    </span>
                  </span>
                  <Pill status={COMPLIANCE_STATUS.pending} />
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {!nutritionCheckin ? (
        <section aria-labelledby="nutrition-title">
          <h2 className="sect" id="nutrition-title">
            This week
          </h2>
          <div className="card flush">
            <Link href="/nutrition-check-in" className="todo">
              <span className="gl" aria-hidden="true">
                ♥
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  Did you hit your protein target most days this week?
                </span>
                <span className="tiny" style={{ display: 'block', marginTop: 2 }}>
                  Weekly check-in · about 10 seconds
                </span>
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="today-title">
        <h2 className="sect" id="today-title">
          Today
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing scheduled"
            body="You are not named in a session today. Rest or check with your coach."
          />
        ) : (
          <div className="card flush">
            {sessions.map((session, index) => {
              const md = mdLabel(session.md_offset);
              const cancelled = session.status === 'cancelled';
              return (
                <div key={session.id}>
                  {index > 0 ? <div className="hair" /> : null}
                  <div className="sess" style={{ opacity: cancelled ? 0.55 : 1 }}>
                    <span className="tm mono">
                      {formatTime(session.starts_at)}
                    </span>
                    <div>
                      <div className="ti">
                        <span
                          style={{
                            textDecoration: cancelled ? 'line-through' : 'none',
                          }}
                        >
                          {session.title}
                        </span>
                        <span className="pill pill-neutral">
                          {enumLabel(session.session_type)}
                        </span>
                        {/* screens/schedule.md's realtime broadcast on
                         * cancellation is not built here — see
                         * lib/queries/schedule.ts's header comment. An
                         * athlete only learns of a cancellation by opening
                         * this screen, not the moment it happens, which is
                         * a real, documented gap for the case the spec
                         * calls out as the one to get right. */}
                        {cancelled ? (
                          <span className="pill pill-bad">Cancelled</span>
                        ) : null}
                      </div>
                      <div className="lo">
                        {session.location ?? 'Location not set'} ·{' '}
                        <span className="mono">
                          {session.duration_min ?? BLANK}
                        </span>{' '}
                        min
                      </div>
                    </div>
                    {md ? (
                      <span className="pill pill-neutral mono">{md}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
