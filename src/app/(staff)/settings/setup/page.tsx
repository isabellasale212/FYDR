import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchSetupCounts } from '@/lib/queries/setupChecklist';
import { setupSteps, setupSummary } from '@/lib/setupChecklist';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Club setup · Fydr' };

/** PATTERN-S8 C1 (2026-09-13): the setup checklist — the S8 board's artboard
 *  0. Five steps in the order that saves the most rework, each with a count
 *  and a done / outstanding state, a list of what is still on a default and
 *  not a gate. The sport scientist's (the steps are theirs to take); it lives
 *  here in Settings for good, and the dashboard carries one line while any
 *  step is outstanding. D8, answered: a threshold with no creator is a Fydr
 *  default. */
export default async function SetupPage() {
  const { db, orgId, claims, orgName } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) redirect('/settings');
  const counts = await fetchSetupCounts(db, orgId);
  const steps = setupSteps(counts, orgName);
  const summary = setupSummary(steps);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Club
          </p>
          <h1>Getting {orgName} set up</h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 'var(--sp-14)' }}>
        Five steps, in this order, because each one needs the one above it. You can use Fydr from the first step onwards
        — this is a list of what is still on a default, not a gate. <b>{summary.count}.</b>
      </p>

      <div className="setup-bar" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.key} className={`setup-bar-seg${s.done ? ' setup-bar-done' : ''}`} />
        ))}
      </div>

      <section className="card flush" aria-label="Setup steps">
        <ol className="setup-list">
          {steps.map((s) => (
            <li key={s.key} className={`setup-step${s.done ? '' : ' setup-step-open'}`}>
              <span className={`setup-n${s.done ? ' setup-n-done' : ''}`} aria-hidden="true">
                {s.n}
              </span>
              <div className="setup-body">
                <p className="nm setup-title">
                  {s.title}
                  <span className={`pill ${s.done ? 'pill-good' : 'pill-warn'} setup-state`}>{s.state}</span>
                </p>
                <p className="tiny">{s.why}</p>
                <p className="tiny num setup-count">{s.count}</p>
              </div>
              <Link href={s.href} className={s.done ? 'btn-ghost setup-cta' : 'btn-primary setup-cta'}>
                {s.cta}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {summary.mattersMost?.key === 'thresholds' ? (
        <section className="card setup-matters" aria-labelledby="setup-matters-title">
          <p className="eyebrow">The one that matters most</p>
          <h2 className="card-title" id="setup-matters-title">
            Thresholds, because every colour in the app is currently a Fydr default
          </h2>
          <p className="tiny">
            {orgName}&apos;s dashboard is already flagging athletes against lines nobody at the club chose. The defaults are
            reasonable, not right, and each rule says so on the thresholds screen — &ldquo;One of the club defaults&rdquo;
            — until someone here sets it.
          </p>
        </section>
      ) : null}

      {summary.complete ? (
        <p className="cap" style={{ marginTop: 'var(--sp-12)' }}>
          Every step is done. This page stays here in Settings; nothing on it blocks anything.
        </p>
      ) : null}
    </>
  );
}
