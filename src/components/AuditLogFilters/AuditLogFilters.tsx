'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { AuditActorOption, AuditAthleteOption } from '@/lib/queries/auditLog';
import { activeFilterCount, filtersButtonLabel, showEntriesLabel } from '@/lib/auditFilterWords';

type Props = {
  actors: readonly AuditActorOption[];
  athletes: readonly AuditAthleteOption[];
  /** The kinds the club's log holds (the chip row on desktop; a select in
   *  the phone sheet). */
  entityTypes: readonly string[];
  entityType: string;
  from: string;
  to: string;
  actorId: string;
  athleteId: string;
  q: string;
  isAllTime: boolean;
  usingDefaultWindow: boolean;
};

/** gameplan item 2.5: the audit log's filter controls. A plain GET-style
 *  navigation (build the query string, router.push it) rather than a
 *  form action, so the page it lands on is the same server-rendered,
 *  admin-gated page.tsx that already does the real query — this
 *  component only ever changes what's in the URL. Every submit drops
 *  `page` back to 1: changing a filter always restarts pagination,
 *  matching how the entity-type chips and the date-preset links already
 *  behave.
 *
 *  PATTERN-S8 C7 (2026-09-13): on a phone the same controls live in a
 *  sheet (the staff shell's More-sheet pattern: scrim, dialog, 80dvh),
 *  opened from a 44px "Filters · 3" button that carries the active count,
 *  and the sheet's button reads back the count it will show — "Show 128
 *  entries" — from /settings/audit/count as the controls change, so a
 *  person on a phone never applies a filter blind. The desktop card is the
 *  same state rendered a second time; CSS shows one of the two per width
 *  (.audit-filters-desktop / .audit-filters-phone), ids prefixed so both
 *  can sit in the DOM. The kind (entity type) is a select inside the
 *  sheet; on desktop it stays the chip row in page.tsx and is carried
 *  through untouched. */
export function AuditLogFilters({ actors, athletes, entityTypes, entityType, from, to, actorId, athleteId, q, isAllTime, usingDefaultWindow }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [typeVal, setTypeVal] = useState(entityType);
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [actorVal, setActorVal] = useState(actorId);
  const [athleteVal, setAthleteVal] = useState(athleteId);
  const [qVal, setQVal] = useState(q);
  const [allTimeVal, setAllTimeVal] = useState(isAllTime);
  /* The 30-day default is shown in the date fields but is not a filter the
     person chose: until a date is touched it is not sent and not counted,
     so Apply does not turn the default into "2 filters". */
  const [datesTouched, setDatesTouched] = useState(!usingDefaultWindow);

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const sheetId = useId();

  function navigate(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    search.delete('page');
    for (const key of ['type', 'from', 'to', 'range', 'actor', 'athlete', 'q']) search.delete(key);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const sendDates = datesTouched && !allTimeVal;
  const current = () => ({
    type: typeVal,
    from: sendDates ? fromVal : '',
    to: sendDates ? toVal : '',
    range: allTimeVal ? 'all' : '',
    actor: actorVal,
    athlete: athleteVal,
    q: qVal.trim(),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    navigate(current());
  }

  function showAllTime() {
    setFromVal('');
    setToVal('');
    setAllTimeVal(true);
    navigate({ ...current(), from: '', to: '', range: 'all' });
  }

  function clearAll() {
    setTypeVal('');
    setFromVal('');
    setToVal('');
    setActorVal('');
    setAthleteVal('');
    setQVal('');
    setAllTimeVal(false);
    setDatesTouched(false);
    setOpen(false);
    navigate({});
  }

  /* The applied state (from the URL) is what the header counts; the sheet's
     pending state is what its button counts. */
  const applied = activeFilterCount({ type: entityType, from, to, actor: actorId, athlete: athleteId, q, allTime: isAllTime, usingDefaultWindow });
  const pendingDefaultWindow = !allTimeVal && (!datesTouched || (!fromVal && !toVal));
  const pendingActive = activeFilterCount({ type: typeVal, from: fromVal, to: toVal, actor: actorVal, athlete: athleteVal, q: qVal, allTime: allTimeVal, usingDefaultWindow: pendingDefaultWindow });

  /* The read-back: while the sheet is open, every change re-asks the count
     after a short pause. Same defaults as the page (no date = last 30 days). */
  useEffect(() => {
    if (!open) return;
    const c = current();
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(c)) if (v) search.set(k, v);
    let cancelled = false;
    setCounting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/settings/audit/count?${search.toString()}`, { cache: 'no-store' });
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setCount(typeof data.count === 'number' ? data.count : null);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeVal, fromVal, toVal, actorVal, athleteVal, qVal, allTimeVal, datesTouched]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const hasNonDateFilter = Boolean(actorVal || athleteVal || q);
  const hasAnyFilter = hasNonDateFilter || Boolean(from || to) || isAllTime || Boolean(entityType);

  const controls = (prefix: string, phone: boolean) => (
    <>
      {phone ? (
        <div>
          <label className="label" htmlFor={`${prefix}-type`}>
            Kind
          </label>
          <select id={`${prefix}-type`} className="field" value={typeVal} onChange={(e) => setTypeVal(e.target.value)}>
            <option value="">Every kind</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor={`${prefix}-from`}>
          From
        </label>
        <input
          id={`${prefix}-from`}
          type="date"
          className="field"
          value={fromVal}
          max={toVal || undefined}
          onChange={(e) => {
            setFromVal(e.target.value);
            setAllTimeVal(false);
            setDatesTouched(true);
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-to`}>
          To
        </label>
        <input
          id={`${prefix}-to`}
          type="date"
          className="field"
          value={toVal}
          min={fromVal || undefined}
          onChange={(e) => {
            setToVal(e.target.value);
            setAllTimeVal(false);
            setDatesTouched(true);
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-actor`}>
          Staff member
        </label>
        <select id={`${prefix}-actor`} className="field" value={actorVal} onChange={(e) => setActorVal(e.target.value)}>
          <option value="">All staff</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-athlete`}>
          Athlete
        </label>
        <select id={`${prefix}-athlete`} className="field" value={athleteVal} onChange={(e) => setAthleteVal(e.target.value)}>
          <option value="">All athletes</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: the card, as before. */}
      <form onSubmit={onSubmit} className="card audit-filters-desktop" style={{ marginBottom: 'var(--sp-14)' }} aria-label="Filter the audit log">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-12)' }}>{controls('audit', false)}</div>

        <div className="form-row" style={{ display: 'flex', gap: 'var(--sp-12)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label className="label" htmlFor="audit-q">
              Search
            </label>
            <input id="audit-q" type="text" className="field" placeholder="Action, staff name or a D- reference" value={qVal} onChange={(e) => setQVal(e.target.value)} />
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

      {/* Phone: one button carrying the active count, and the sheet. */}
      <div className="audit-filters-phone">
        <button ref={openerRef} type="button" className="btn-ghost audit-filters-open" aria-expanded={open} aria-controls={sheetId} onClick={() => setOpen(true)}>
          {filtersButtonLabel(applied)}
        </button>
        {hasAnyFilter ? (
          <button type="button" className="btn-ghost" onClick={clearAll}>
            Clear
          </button>
        ) : null}
        <div className="ph-sheet-scrim" hidden={!open} onClick={() => setOpen(false)} aria-hidden="true" />
        <form id={sheetId} className="ph-sheet audit-sheet" role="dialog" aria-modal="true" aria-labelledby={`${sheetId}-title`} hidden={!open} onSubmit={onSubmit}>
          <p className="ph-sheet-title" id={`${sheetId}-title`}>
            Filter the log{pendingActive > 0 ? ` · ${pendingActive} active` : ''}
          </p>
          <div className="audit-sheet-fields">
            {controls('audit-ph', true)}
            <div>
              <label className="label" htmlFor="audit-ph-q">
                Search
              </label>
              <input id="audit-ph-q" type="search" className="field" placeholder="Action, staff name or a D- reference" value={qVal} onChange={(e) => setQVal(e.target.value)} />
            </div>
            <label className="audit-sheet-alltime">
              <input
                type="checkbox"
                checked={allTimeVal}
                onChange={(e) => {
                  setAllTimeVal(e.target.checked);
                  setDatesTouched(true);
                  if (e.target.checked) {
                    setFromVal('');
                    setToVal('');
                  }
                }}
              />{' '}
              All time, not just the last 30 days
            </label>
          </div>
          <div className="audit-sheet-actions">
            <button type="submit" className="btn-primary" aria-live="polite">
              {showEntriesLabel(count, counting)}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
