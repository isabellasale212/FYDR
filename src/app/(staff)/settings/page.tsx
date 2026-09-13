import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchThresholds } from '@/lib/queries/thresholds';
import { fetchGroups } from '@/lib/queries/groups';
import { mfaRequiredForRoles } from '@/lib/mfa';
import { requireStaff } from '@/lib/session';
import { isPremium, tierLabel } from '@/lib/tier';
import { GPS_IMPORT, REPORT_ACCESS, SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { settingsGroups } from '@/lib/settingsHub';

export const metadata = { title: 'Settings · Fydr' };

/** PATTERN-S8 C2 (2026-09-13): the hub in four groups on one screen —
 *  Club, People, Data, You — each a card of destination rows carrying a
 *  count, four across at desktop and stacked at 375; the long forms (this
 *  person's profile, password and two-factor; the plan, the integrations and
 *  the club details) sit one level down at /settings/profile and
 *  /settings/club. The hub measured 3,772px at desktop and 5,089 at phone
 *  before, eight sections in a column with the list at the bottom.
 *
 *  What is preserved from the version this replaces, and where it went:
 *  every real destination the old row list carried (Groups, GPS imports,
 *  Notifications, Users, Subject access, Data retention, Audit log,
 *  Thresholds, Exports) is a row here, with the same gates; the Plan card,
 *  the Integrations card and the club details form are /settings/club; the
 *  profile, avatar, password and two-factor cards are /settings/profile. Log
 *  out stays on the hub as the bordered button (PATTERN-S8 A1), in the You
 *  card. lib/settingsHub.ts holds the four groups as data so the phone shell
 *  and a guard can read the same list. */
export default async function SettingsPage() {
  const { db, orgId, orgName, claims, tier, previewingTier } = await requireStaff();
  const isAdmin = hasAnyRole(claims.roles, SETTINGS_ADMIN);
  const onPremium = isPremium(tier);
  const roleRequiresMfa = mfaRequiredForRoles(claims.roles);

  const [athleteCount, activeThresholds, mfaFactors, groups, staffCount, sarOpen, importBatches, auditRecent] = await Promise.all([
    db.from('athletes').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club'),
    fetchThresholds(db, orgId, false),
    db.auth.mfa.listFactors(),
    fetchGroups(db, orgId),
    isAdmin ? db.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).eq('status', 'active') : Promise.resolve({ count: null }),
    isAdmin || claims.roles.includes('medic')
      ? db.from('sar_requests').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'released')
      : Promise.resolve({ count: null }),
    hasAnyRole(claims.roles, GPS_IMPORT) && onPremium ? db.from('import_batches').select('id', { count: 'exact', head: true }).eq('org_id', orgId) : Promise.resolve({ count: null }),
    isAdmin
      ? db.from('audit_log').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('occurred_at', new Date(Date.now() - 90 * 86400000).toISOString())
      : Promise.resolve({ count: null }),
  ]);

  const squadSize = athleteCount.count ?? 0;
  const mfaOn = (mfaFactors.data?.totp.length ?? 0) > 0;

  const cards = settingsGroups({
    roles: claims.roles,
    isAdmin,
    canExport: hasAnyRole(claims.roles, REPORT_ACCESS),
    canImport: hasAnyRole(claims.roles, GPS_IMPORT),
    onPremium,
    previewingTier,
    tierWord: tierLabel(tier),
    counts: {
      groups: groups.length,
      thresholds: activeThresholds.length,
      users: staffCount.count ?? null,
      sarOpen: sarOpen.count ?? null,
      importBatches: importBatches.count ?? null,
      auditRecent: auditRecent.count ?? null,
    },
    mfa: mfaOn ? 'on' : roleRequiresMfa ? 'required' : 'off',
  });

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            Organisation · {orgName} · {squadSize} athlete{squadSize === 1 ? '' : 's'}
          </p>
          <h1>Settings</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* The one required-action notice on the hub: a role that must enrol
          two-factor and has not. Stated as a fact, not a block — the recorded
          boundary pending the RLS follow-up (the S8 record). */}
      {roleRequiresMfa && !mfaOn ? (
        <p className="banner" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          <span className="g g-bad" aria-hidden="true">
            !
          </span>
          <span>
            Your role requires two-factor authentication · not enrolled.{' '}
            <Link href="/settings/profile#password">Set it up under Profile and password</Link>.
          </span>
        </p>
      ) : null}

      <div className="set-groups">
        {cards.map((card) => (
          <section key={card.key} className="card set-card set-group" aria-labelledby={`set-group-${card.key}`}>
            <h2 className="card-title set-group-title" id={`set-group-${card.key}`}>
              {card.title}
            </h2>
            <div className="set-group-rows">
              {card.rows.map((row) =>
                row.href ? (
                  <Link key={row.key} href={row.href} className="set-list-row">
                    <span>
                      <span className="set-row-label">{row.label}</span>
                      <span className="set-row-sub">{row.sub}</span>
                    </span>
                    {row.count ? (
                      <span className={`num set-row-count${row.countTone ? ` pill pill-${row.countTone}` : ''}`}>{row.count}</span>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span aria-hidden="true" className="set-row-chev">
                      ›
                    </span>
                  </Link>
                ) : (
                  /* A row this role cannot open: the reason printed in the
                     row, no dead link, no title (test-blocked-controls). */
                  <div key={row.key} className="set-list-row" data-disabled="true" aria-disabled="true">
                    <span>
                      <span className="set-row-label" style={{ color: 'var(--faint)' }}>
                        {row.label}
                      </span>
                      <span className="set-row-sub">{row.sub}</span>
                    </span>
                    <span className="num set-row-count" style={{ color: 'var(--faint)' }}>
                      —
                    </span>
                    <span aria-hidden="true" />
                  </div>
                ),
              )}
            </div>
            {card.key === 'you' ? (
              /* PATTERN-S8 A1 (2026-09-13): Log out is a button, not a row whose
                  only submitting element is a 4.8px chevron — bordered, 44px (48
                  on a phone), its own label, set apart from the lists, with the
                  session it ends named beside it. */
              <form action="/auth/sign-out" method="post" className="set-logout-form">
                <button type="submit" className="btn-ghost set-logout">
                  Log out
                </button>
                <span className="tiny set-logout-note">Ends this session on this browser only</span>
              </form>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
