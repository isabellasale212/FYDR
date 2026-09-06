import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { RosterTable } from '@/components/RosterTable/RosterTable';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Squad overview · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SquadPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims } = await requireStaff();

  // 01-roles-and-permissions.md (superseded) §2: admin gets `no` for "View squad
  // dashboard", and docs/20-route-map.md §2.3 lists /squad's own roles as
  // coach/medical only, no admin, no aggregate note. This page is the full
  // named roster plus availability and restrictions — exactly the
  // performance data §1 says admin doesn't read. Same pattern as /flags.
  /* Was `coach || medic`, which in the four-role model was the phrase for "any
     staff who is not an admin". The sport scientist, the S&C and the
     nutritionist are none of those, so this screen refused all three. The
     access matrix gives every staff role this page. */
    /* No role gate here, and that is the rule rather than an omission. This page
     is open to every staff role: requireStaff() has already turned away anyone
     who is not staff, and ALL_STAFF is by definition the rest.

     There WAS a gate, keyed on the four-role model's `coach || medic` — the
     phrase that model used for "any staff who is not an admin". The five-role
     model has no admin, so that phrase excluded the sport scientist, the S&C and
     the nutritionist, and G-39 corrected it to ALL_STAFF. What it left behind was
     a refusal branch that could no longer fire, rendering "Not part of this role"
     for a condition nothing satisfies, explained by a comment citing a document
     that now says do not build against it. Removed 2026-09-06: unreachable code
     that reads as a live rule is worse than no code, because the next audit
     believes it. */

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, rows] = await Promise.all([
    fetchGroups(db, orgId),
    fetchSquadList(db, orgId, groupIds),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">{groupScopeLabel(groups, groupIds)} · {orgName}</p>
          <h1>Squad overview</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* D-16, resolved by screen 63. Until now there was no way to put a
              player on the roster from anywhere in this app. Sport scientist
              only, the same set that gates Club details and Users: creating an
              athlete is an administration action, while EDITING one once they
              exist stays with the coach (ATHLETE_BIO_EDIT). The two must not be
              collapsed into one set. */}
          {hasAnyRole(claims.roles, SETTINGS_ADMIN) ? (
            <Link href="/squad/new" className="btn-primary">
              Add athlete
            </Link>
          ) : null}
          <Link href="/settings/groups" className="btn-ghost">
            Manage groups
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <section className="card">
        <h2 className="card-title">
          {rows.length} athletes
          {groupIds.length > 0 ? ' in the selected groups' : ' in the squad'}
        </h2>
        {/* KEPT ON PURPOSE, against Design.pdf p5, which does not show it.
            Removing this was rolled back once already at the client's request
            (see the handoff changelog's "Squad overview (reverted)"), it was
            removed again in 87ee155 as part of matching the design, and the
            client asked for it back a second time. It stays. */}
        <p className="import-sub">
          Injury-linked availability is set by medical staff. A coach can also record a
          non-injury absence directly — illness, personal, academic, representative, or
          other — from an athlete&rsquo;s profile.
        </p>
        <RosterTable orgId={orgId} groupIds={groupIds} initialRows={rows} />
      </section>
    </>
  );
}
