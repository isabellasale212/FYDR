import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchTemplates, weekTotalLoad } from '@/lib/queries/weekTemplates';
import { mdLabel } from '@/lib/format';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Week templates · Fydr' };

/** screens/md-planner.md, screen 18, reduced — see
 *  lib/queries/weekTemplates.ts's header for the full list of what this
 *  pass cuts and why (no Edge Function, no drag, no monotony threshold,
 *  templates always apply to the whole squad). week_templates itself
 *  (migration 0003) had zero application code before this file — the
 *  same shape of gap already closed this session for organisations.tier,
 *  session_attendance and audit_log. Medical reads and writes exactly
 *  like coach at the real RLS layer; the spec's own "medical is
 *  read-only except rehab-only templates" rule is a UI courtesy applied
 *  in the builder, not a database restriction that exists yet. */
export default async function WeekTemplatesPage() {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  /* week_templates is coach and sport scientist (0070). This read coach or
     medic, so it offered writing to a medic and withheld it from the sport
     scientist. */
  const canWrite = hasAnyRole(claims.roles, SESSION_EDIT);
  /* And the list itself is now behind the same gate, not just the create button.
     G-33 is explicit — "Medic loses scheduling, INCLUDING WEEK TEMPLATES" — and a
     page that renders read-only for a role that has lost the feature is the
     "hidden button is not a gate" mistake from the tier work: the URL is still
     there. The Schedule chip linking here is hidden for the same roles, so this
     closes the typed-URL route to match. */
  if (!canWrite) redirect('/schedule');
  const templates = await fetchTemplates(db, orgId, timezone);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · {orgName}
          </p>
          <h1>Week templates</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canWrite ? (
            <Link href="/schedule/planner/new" className="btn-primary">
              + New template
            </Link>
          ) : null}
        </div>
      </div>

      

      {templates.length === 0 ? (
        <EmptyState
          title="No week templates yet"
          body="A template describes what happens at each MD-n position, so you build a week once."
        />
      ) : (
        <div className="stack">
          {templates.map((t) => (
            /* Was a single <Link> wrapping the whole card, so the list had one
               verb and never said which. It cannot stay one: an anchor may not
               contain the two controls below it, and a browser recovering from
               that reflows them somewhere the source never described. */
            <div key={t.id} className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="nm" style={{ fontSize: 15 }}>
                  {t.name}
                </span>
                <span className="num tiny" style={{ marginLeft: 'auto', color: 'var(--faint)' }}>
                  {t.applyCount > 0 ? `Used ${t.applyCount} time${t.applyCount === 1 ? '' : 's'}` : 'Never applied'}
                </span>
              </div>
              <div className="tiny" style={{ marginTop: 4 }}>
                {t.structure.days.filter((d) => d.sessions.length > 0).length} days planned ·{' '}
                {t.structure.days.reduce((s, d) => s + d.sessions.length, 0)} sessions · load{' '}
                {weekTotalLoad(t.structure).toLocaleString()}
              </div>
              <div className="chiprow" style={{ marginTop: 8 }}>
                {t.structure.days
                  .filter((d) => d.sessions.length > 0)
                  .map((d) => (
                    <span key={d.mdOffset} className="pill pill-neutral">
                      {mdLabel(d.mdOffset)}
                    </span>
                  ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {/* Apply carries the template it sits next to. The apply screen
                    accepts ?template= and its picker filters archived ones out,
                    so offering Apply on an archived row would land somebody on a
                    select that cannot select what they asked for. */}
                {t.archived ? null : (
                  <Link href={`/schedule/planner/apply?template=${t.id}`} className="btn-primary">
                    Apply
                  </Link>
                )}
                <Link href={`/schedule/planner/${t.id}`} className="btn-ghost">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
