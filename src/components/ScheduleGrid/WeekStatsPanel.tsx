'use client';

import { TYPE_STYLE, type DbSessionType } from '@/lib/scheduleGeometry';
import { enumLabel } from '@/lib/format';
import type { NormalWeek } from '@/lib/queries/schedule';
import type { GroupOption } from './types';

type StatSession = { type: DbSessionType; mins: number; athleteIds: string[]; groupIds: string[] };

type GroupWithCount = GroupOption & { memberCount: number };

type Props = {
  sessions: readonly StatSession[];
  typical: NormalWeek;
  groups: readonly GroupWithCount[];
};

const ROW_TYPES: DbSessionType[] = ['training', 'gym', 'rehab', 'testing', 'match', 'meeting', 'recovery'];

function diffTone(diff: number, threshold: number): 'within' | 'over' | 'under' {
  if (diff > threshold) return 'over';
  if (diff < -threshold) return 'under';
  return 'within';
}

function signed(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `${r}`;
}

function weeksPhrase(n: number): string {
  if (n === 0) return 'no weeks';
  if (n === 1) return 'the last 1 week';
  return `the last ${n} weeks`;
}

/** SCHEDULE-SPEC.md §7 "This week against a normal week" and §8 "Contact
 *  time per group". Both cards are recomputed from the live, overlaid week
 *  (edits included) so a stepper press updates them immediately, per §9's
 *  "every stepper press... flips the publish banner" — the same real-time
 *  feedback extends to these two cards, not just the banner dot.
 *
 *  §7's own rule (§11.6): "Athlete contact time is every session type an
 *  athlete attends, and Staff-only sessions are excluded wherever minutes
 *  are totalled." This build's real proxy for Staff-only is a session with
 *  zero real athlete participants (see scheduleGeometry.ts's header) —
 *  applied identically here, in the day-header minutes, and in
 *  fetchNormalWeek, so the three can never disagree the way the spec's own
 *  "rows summed to 795m under a total of 885m" defect did. */
export function WeekStatsPanel({ sessions, typical, groups }: Props) {
  const counted = sessions.filter((s) => s.athleteIds.length > 0);

  const thisByType: Record<DbSessionType, { count: number; mins: number }> = {
    training: { count: 0, mins: 0 },
    gym: { count: 0, mins: 0 },
    match: { count: 0, mins: 0 },
    testing: { count: 0, mins: 0 },
    recovery: { count: 0, mins: 0 },
    meeting: { count: 0, mins: 0 },
    rehab: { count: 0, mins: 0 },
  };
  let thisTotal = 0;
  for (const s of counted) {
    thisByType[s.type].count += 1;
    thisByType[s.type].mins += s.mins;
    thisTotal += s.mins;
  }
  const typicalTotal = typical.totalMins;
  const totalTone = typical.weeksUsed > 0 ? diffTone(thisTotal - typicalTotal, 40) : null;

  const groupMins = new Map<string, number>();
  for (const s of counted) {
    for (const gid of s.groupIds) groupMins.set(gid, (groupMins.get(gid) ?? 0) + s.mins);
  }
  const groupRows = groups
    .filter((g) => g.memberCount > 0)
    .map((g) => ({ ...g, mins: groupMins.get(g.id) ?? 0 }))
    .sort((a, b) => b.mins - a.mins);
  const maxGroupMins = Math.max(1, ...groupRows.map((g) => g.mins));

  return (
    <div className="stack">
      <div className="card">
        <p className="card-title">This week against a normal week</p>
        <p className="sg-cmp-sub">
          Sessions and contact minutes, not load. Typical is the mean of {weeksPhrase(typical.weeksUsed)} with a
          fixture.
        </p>

        <div className="sg-cmp-head">
          <span>Type</span>
          <span>This</span>
          <span>Typical</span>
          <span>Diff</span>
        </div>

        {ROW_TYPES.map((t) => {
          const row = thisByType[t];
          const typ = typical.byType[t];
          const tone = typical.weeksUsed > 0 ? diffTone(row.mins - typ.mins, 15) : null;
          return (
            <div key={t} className="sg-cmp-row">
              <span className="sg-cmp-type">
                <span className="sg-cmp-bar" style={{ '--tone': TYPE_STYLE[t].tone } as React.CSSProperties} />
                {enumLabel(t)}
              </span>
              <span className="sg-cmp-num mono">
                {row.count} · {row.mins}m
              </span>
              <span className="sg-cmp-num sg-cmp-typical mono">
                {typical.weeksUsed > 0 ? `${typ.count.toFixed(1)} · ${Math.round(typ.mins)}m` : '·'}
              </span>
              <span className="sg-cmp-num sg-cmp-diff mono" data-tone={tone ?? undefined}>
                {tone ? `${signed(row.mins - typ.mins)}m` : '·'}
              </span>
            </div>
          );
        })}

        <div className="sg-cmp-total">
          <span>Contact minutes</span>
          <span className="mono">{thisTotal}m</span>
          <span className="mono">{typical.weeksUsed > 0 ? `${Math.round(typicalTotal)}m` : '·'}</span>
          <span className="sg-cmp-diff mono" data-tone={totalTone ?? undefined}>
            {totalTone ? `${signed(thisTotal - typicalTotal)}m` : '·'}
          </span>
        </div>

        <p className="sg-cmp-read">
          {typical.weeksUsed === 0
            ? 'Not enough real history yet to compare this week against a typical one.'
            : totalTone === 'within'
              ? `A normal week. Contact time is within 40 minutes of your ${typical.weeksUsed}-week mean for a fixture week.`
              : totalTone === 'over'
                ? `This week carries ${Math.round(thisTotal - typicalTotal)} minutes more contact time than a normal fixture week.`
                : `This week is ${Math.round(typicalTotal - thisTotal)} minutes lighter than a normal fixture week.`}
        </p>
      </div>

      <div className="card">
        <p className="card-title">Contact time per group</p>
        <p className="sg-cmp-sub">Scheduled minutes this week, pitch and gym.</p>
        <div className="sg-group-bars">
          {groupRows.length === 0 ? (
            <p className="cap" style={{ margin: 0 }}>
              No group has a session named this week.
            </p>
          ) : (
            groupRows.map((g) => (
              <div key={g.id}>
                <div className="sg-group-row-head">
                  <span className="sg-group-name">{g.name}</span>
                  <span className="sg-group-mins mono">{g.mins}m</span>
                </div>
                <div className="sg-group-track">
                  <div
                    className="sg-group-fill"
                    style={{
                      width: `${(g.mins / maxGroupMins) * 100}%`,
                      background: g.group_type === 'rehab' ? 'var(--warn)' : 'var(--accent)',
                    }}
                  />
                </div>
                <p className="sg-group-foot">{g.memberCount} athletes</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
