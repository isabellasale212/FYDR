import Link from 'next/link';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { formatDate, formatDateTime } from '@/lib/format';
import { PREMIUM_INVENTORY, PRICE_PLACEHOLDER } from '@/lib/premiumWords';
import { refuse, requireStaff } from '@/lib/session';
import { isPremium, tierLabel } from '@/lib/tier';

export const metadata = { title: 'Plan · Fydr' };

/** The plan page — Settings › Plan (docs/decisions/absence-rule.md, "Where a
 *  basic club learns premium exists", 14 September 2026; built 15 September).
 *  The ONE place a Basic club learns what Premium contains: D-20 hides every
 *  wholly premium destination and shows a card for a premium region, and
 *  nothing else in the product teases. Visible to the sport scientist. It is
 *  also the answer to "no screen tells a downgraded club its GPS history is
 *  kept": premium_history_kept() (0126) says what the club holds on any plan,
 *  from a table its staff cannot read while on Basic (0119). The price is a
 *  placeholder — not decided. docs/screens/47-settings.md. */
export default async function PlanPage() {
  const { db, orgId, orgName, claims, tier, timezone, previewingTier } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) await refuse(db, 'plan', '/settings/plan');
  const onPremium = isPremium(tier);

  const [kept, lastFlip] = await Promise.all([
    db.rpc('premium_history_kept').maybeSingle(),
    /* When the plan last changed: the audit row the tier trigger writes (0126).
       Absent for a club whose plan has never changed since the row was
       introduced, and the page says nothing about a date then. */
    db.from('audit_log').select('occurred_at, metadata').eq('org_id', orgId).eq('action', 'org.tier.changed').order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const history = kept.data ?? null;
  const gpsRows = history ? Number(history.gps_rows ?? 0) : 0;
  const flipAt = lastFlip.data?.occurred_at ?? null;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Club · {orgName}
          </p>
          <h1>Plan</h1>
        </div>
      </div>

      <div className="set-body">
        <section className="card set-card" aria-labelledby="plan-now-title" data-plan={onPremium ? 'premium' : 'basic'}>
          <h2 className="card-title" id="plan-now-title" style={{ margin: 0 }}>
            This club is on {tierLabel(tier)}
          </h2>
          <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 0' }}>
            {onPremium
              ? 'Everything Premium contains is on, and everything in Basic with it.'
              : 'Wellness, gym, nutrition, the schedule, injuries, testing, reports and exports — everything but the list below.'}
            {flipAt ? ` The plan last changed on ${formatDateTime(flipAt, timezone)}; every change is in the audit log.` : ''}
          </p>
          {previewingTier ? (
            <p className="pill" style={{ background: 'var(--wash-warn)', color: 'var(--warn-pill-text)', marginTop: 'var(--sp-8)' }}>
              Previewing Basic · this club’s real plan is still Premium
            </p>
          ) : null}
          <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
            The plan is changed with Fydr, not from this screen. The Basic preview for Fydr staff is on{' '}
            <Link href="/settings/club#plan">Club details</Link>.
          </p>
        </section>

        <section className="card set-card" aria-labelledby="plan-contains-title">
          <h2 className="card-title" id="plan-contains-title" style={{ margin: 0 }}>
            What Premium contains
          </h2>
          <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 var(--sp-10)' }}>
            {PREMIUM_INVENTORY.length} things. Everything else in the product is in both plans, and a Basic club is never shown a locked copy of any of these — they are absent, and this page is where they are named.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-inventory>
            {PREMIUM_INVENTORY.map((item, i) => (
              <li key={item.label} style={{ padding: 'var(--sp-10) 0', borderTop: i === 0 ? undefined : '1px solid var(--hair)' }}>
                <b style={{ display: 'block', fontSize: 'var(--fs-14)' }}>{item.label}</b>
                <span style={{ display: 'block', color: 'var(--muted)', fontSize: 'var(--fs-13)', marginTop: 'var(--sp-2)' }}>{item.sentence}</span>
              </li>
            ))}
          </ul>
          <p className="legal-pending" data-placeholder="price" style={{ marginTop: 'var(--sp-12)' }}>
            {PRICE_PLACEHOLDER}
          </p>
        </section>

        <section className="card set-card" aria-labelledby="plan-kept-title" data-kept={gpsRows > 0 ? 'some' : 'none'}>
          <h2 className="card-title" id="plan-kept-title" style={{ margin: 0 }}>
            {onPremium ? 'Your GPS history' : 'What is kept while the club is on Basic'}
          </h2>
          <p style={{ fontSize: 'var(--fs-13)', margin: 'var(--sp-6) 0 0' }} data-kept-sentence>
            {gpsRows > 0 && history
              ? onPremium
                ? `${gpsRows.toLocaleString('en-GB')} GPS records from ${formatDate(history.first_date, timezone)} to ${formatDate(history.last_date, timezone)}, from ${Number(history.import_batches ?? 0).toLocaleString('en-GB')} import${Number(history.import_batches ?? 0) === 1 ? '' : 's'}. If the club ever leaves Premium they are kept, hidden from every screen, and return the day the plan does.`
                : `${gpsRows.toLocaleString('en-GB')} GPS records from ${formatDate(history.first_date, timezone)} to ${formatDate(history.last_date, timezone)} are kept. They are hidden from every screen while the club is on Basic and return with Premium — nothing was deleted when the plan changed.`
              : 'This club holds no GPS records.'}
          </p>
          <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
            Kept does not mean kept forever: GPS records age under the club’s normal retention like everything else, on any plan —{' '}
            <Link href="/settings/retention">Data retention</Link>.
          </p>
        </section>
      </div>
    </>
  );
}
