'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import type { AuditActorOption, AuditAthleteOption } from '@/lib/queries/auditLog';

type Props = {
  actors: readonly AuditActorOption[];
  athletes: readonly AuditAthleteOption[];
  from: string;
  to: string;
  actorId: string;
  athleteId: string;
  q: string;
  isAllTime: boolean;
};

/** gameplan item 2.5: the audit log's filter controls. A plain GET-style
 *  navigation (build the query string, router.push it) rather than a
 *  form action, so the page it lands on is the same server-rendered,
 *  admin-gated page.tsx that already does the real query — this
 *  component only ever changes what's in the URL. Every submit drops
 *  `page` back to 1: changing a filter always restarts pagination,
 *  matching how the entity-type chips and the date-preset links already
 *  behave. `type` (the entity-type chip row, still plain Links in
 *  page.tsx) is read from the URL and carried through untouched so this
 *  form and those chips don't stomp on each other. */
export function AuditLogFilters({ actors, athletes, from, to, actorId, athleteId, q, isAllTime }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [actorVal, setActorVal] = useState(actorId);
  const [athleteVal, setAthleteVal] = useState(athleteId);
  const [qVal, setQVal] = useState(q);

  function navigate(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    search.delete('page');
    for (const key of ['from', 'to', 'range', 'actor', 'athlete', 'q']) search.delete(key);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ from: fromVal, to: toVal, actor: actorVal, athlete: athleteVal, q: qVal.trim() });
  }

  function showAllTime() {
    setFromVal('');
    setToVal('');
    navigate({ from: '', to: '', range: 'all', actor: actorVal, athlete: athleteVal, q: qVal.trim() });
  }

  function clearAll() {
    setFromVal('');
    setToVal('');
    setActorVal('');
    setAthleteVal('');
    setQVal('');
    navigate({});
  }

  const hasNonDateFilter = Boolean(actorVal || athleteVal || q);
  const hasAnyFilter = hasNonDateFilter || Boolean(from || to) || isAllTime;

  return (
    <form onSubmit={onSubmit} className="card" style={{ marginBottom: 'var(--sp-14)' }} aria-label="Filter the audit log">
      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-12)' }}>
        <div>
          <label className="label" htmlFor="audit-from">
            From
          </label>
          <input id="audit-from" type="date" className="field" value={fromVal} max={toVal || undefined} onChange={(e) => setFromVal(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="audit-to">
            To
          </label>
          <input id="audit-to" type="date" className="field" value={toVal} min={fromVal || undefined} onChange={(e) => setToVal(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="audit-actor">
            Staff member
          </label>
          <select id="audit-actor" className="field" value={actorVal} onChange={(e) => setActorVal(e.target.value)}>
            <option value="">All staff</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="audit-athlete">
            Athlete
          </label>
          <select id="audit-athlete" className="field" value={athleteVal} onChange={(e) => setAthleteVal(e.target.value)}>
            <option value="">All athletes</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row" style={{ display: 'flex', gap: 'var(--sp-12)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label className="label" htmlFor="audit-q">
            Search
          </label>
          <input
            id="audit-q"
            type="text"
            className="field"
            placeholder="Action or staff name"
            value={qVal}
            onChange={(e) => setQVal(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">
          Apply filters
        </button>
        {!isAllTime ? (
          <button type="button" className="btn-ghost" onClick={showAllTime}>
            Show all time
          </button>
        ) : null}
        {hasAnyFilter ? (
          <button type="button" className="btn-ghost" onClick={clearAll}>
            Clear filters
          </button>
        ) : null}
      </div>
    </form>
  );
}
