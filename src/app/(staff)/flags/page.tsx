import Link from 'next/link';
import { FlagCard } from '@/components/FlagCard/FlagCard';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import { isUuid } from '@/lib/uuid';
import { fetchFlagsList } from '@/lib/queries/flags';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, todayIso } from '@/lib/format';
import { isPremium } from '@/lib/tier';
import { requireStaff } from '@/lib/session';
import { canEditFlag } from '@/lib/access';

export const metadata = { title: 'Flags · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, timezone, claims, tier } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const today = todayIso(timezone);

  /* Optional ?date= filter — added so the dashboard's "Need you" tile (which
   * counts flags raised on one specific day) has a real destination that
   * shows exactly that set, instead of linking back to itself (audit coach
   * finding 13). A plain YYYY-MM-DD string; anything else is ignored rather
   * than thrown, since a malformed date here should just show everything. */
  const dateParam = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;

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

  const [groups, allFlags] = await Promise.all([
    fetchGroups(db, orgId),
    fetchFlagsList(db, orgId, groupIds),
  ]);

  /* #17 (Isabella, 15 Sept 2026, mobile queue): one athlete's flags, by
   * ?athlete=<id>. The dropdown that writes it is drawn at phone width only
   * (data-phone-only, base.css's width gate); a desktop reader reaches it by
   * URL alone. Same shape as ?date=: a value that is not a uuid is ignored,
   * never thrown. The options are the athletes with an open flag in scope,
   * from the list itself — choosing one with none would show nothing. */
  const athleteParam = typeof params.athlete === 'string' && isUuid(params.athlete) ? params.athlete : null;
  const athleteOptions = [...new Map(allFlags.map((f) => [f.athlete_id, f.name])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const athleteName = athleteParam ? (athleteOptions.find((o) => o.value === athleteParam)?.label ?? null) : null;

  const flags = allFlags.filter((f) => (!dateParam || f.flag_date === dateParam) && (!athleteParam || f.athlete_id === athleteParam));
  const everyFlagHref = `/flags${groupIds.length > 0 ? `?groups=${groupIds.join(',')}` : ''}`;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {groupScopeLabel(groups, groupIds)} · {orgName} · {formatDate(today, timezone)}
          </p>
          <h1>Flags</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          {/* 3.5 (16 Sept 2026): the group filter, a dropdown in the top right. */}
          <GroupFilter groups={groups} selected={groupIds} />
        </div>
      </div>


      {/* #17: the athlete dropdown, phone width only. ReportSelectNav keeps
          every other param (the group filter, the day) as it writes this one;
          "Every athlete" clears it. */}
      {athleteOptions.length > 0 ? (
        <div data-phone-only="" style={{ marginBottom: 'var(--sp-14)' }}>
          <ReportSelectNav
            label="Athlete"
            paramKey="athlete"
            value={athleteParam && athleteName ? athleteParam : ''}
            clearValue=""
            options={[{ value: '', label: 'Every athlete' }, ...athleteOptions]}
            ariaLabel="Show one athlete's flags"
          />
        </div>
      ) : null}

      {dateParam ? (
        <p className="sub" style={{ margin: '0 0 var(--s-5)' }}>
          Filtered to flags raised on <b>{formatDate(dateParam, timezone)}</b> —{' '}
          <Link href={everyFlagHref} className="linklike">
            show every open flag
          </Link>
        </p>
      ) : null}
      {athleteParam ? (
        <p className="sub" style={{ margin: '0 0 var(--s-5)' }}>
          Showing <b>{athleteName ?? 'one athlete'}</b>&rsquo;s flags only —{' '}
          <Link href={everyFlagHref} className="linklike">
            show every athlete
          </Link>
        </p>
      ) : null}

      <div className="stack">
        <p className="sub" style={{ margin: 0 }}>
          {flags.length === 0
            ? dateParam
              ? `No flags raised on ${formatDate(dateParam, timezone)}.`
              : athleteParam
                ? 'No open flags for this athlete.'
                : 'No open flags.'
            : `${flags.length} open flag${flags.length === 1 ? '' : 's'}, most severe first · ${
                flags.filter((f) => f.status === 'raised' || f.status === 'notified').length
              } awaiting acknowledgement.`}
        </p>

        {flags.length === 0 ? (
          <EmptyState
            title={dateParam ? 'No flags that day' : athleteParam ? 'No open flags for this athlete' : 'No open flags'}
            body={
              dateParam
                ? `Nothing was raised on ${formatDate(dateParam, timezone)} in the current scope — the count on the dashboard may be for a different day if you've since navigated. Show every open flag above to check.`
                : athleteParam
                  ? `${athleteName ?? 'This athlete'} has no open flag in the current scope. Show every athlete above to see the rest.`
                  : groupIds.length > 0
                  ? `No open flags in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to check the whole squad.`
                  : 'The squad is within thresholds. That is the result, not a failure to load.'
            }
          />
        ) : (
          flags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              orgId={orgId}
              userId={claims.userId}
              today={today}
              timezone={timezone}
              premium={isPremium(tier)}
              /* Wording only, never authorisation (CLAUDE.md rule 2) — the roles
                 come from the server-resolved session either way. A clinician
                 writing a note here is writing into a column every coach in the
                 club reads, and the card says so. */
              viewerIsMedical={claims.roles.includes('medic')}
              /* Per flag, not per viewer: a nutritionist gets true on a
                 nutrition flag and false on the wellness flag beneath it. This
                 is the one gate on this page that cannot be hoisted out of the
                 map. */
              canEdit={canEditFlag(claims.roles, flag.domain)}
            />
          ))
        )}
      </div>
    </>
  );
}
