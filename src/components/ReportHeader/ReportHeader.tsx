'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type HeaderTab = { label: string; selected: boolean; onSelect: () => void };

export type ReportHeaderGroup = { id: string; name: string };

export type ReportHeaderProps = {
  groups: readonly ReportHeaderGroup[];
  /** The group ids currently in force. Empty means the whole squad. */
  groupIds: readonly string[];
  eyebrow: React.ReactNode;
  title: string;
  /** Rendered right of the eyebrow. Primary action first, then exports. */
  actions?: React.ReactNode;
  /** The tab segment, for a page whose view state lives in React. On the
   *  reports that is ReportPager, so it is passed in rather than held here. */
  tabs?: readonly HeaderTab[];
  /** The tab segment already rendered, for a page whose view state lives in
   *  the address instead. The training report's Day/Week is a pair of links,
   *  not buttons, because it is a real navigation. Styled to match either
   *  way. */
  tabsNode?: React.ReactNode;
  /** Right of the tabs. The period control on the reports that have one. It
   *  brings its own label, so none is passed here. */
  period?: React.ReactNode;
  /** Page context that belongs under the header rather than in it: the scope
   *  line, a caveat, a way out. The canvas does not draw these, but they carry
   *  real information, so they are placed rather than dropped. */
  sub?: React.ReactNode;
};

/** The one header the six report screens share, built to
 *  CHANGELOG-headers-spec.md. Five rows, in this order: Back, group chips,
 *  eyebrow with actions, title, tabs with the period.
 *
 *  Why the group chips are in here rather than left where they were. The
 *  design puts them above the eyebrow, which is a real change of meaning as
 *  well as position: the filter now reads as scoping the whole screen rather
 *  than the table it used to sit above. Every number below it already honoured
 *  the filter, so the position is now telling the truth.
 *
 *  A client component, because the chips write to the address bar and the tabs
 *  call back into whoever owns the view state. It renders no data of its own. */
export function ReportHeader({
  groups,
  groupIds,
  eyebrow,
  title,
  actions,
  tabs,
  tabsNode,
  period,
  sub,
}: ReportHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /* The same contract GroupFilter already had: the selection lives in the
     address, so a filtered report can be sent to a colleague and read the
     same. Nothing about that changes here, only where the control sits. */
  function setGroups(next: string[]) {
    const q = new URLSearchParams(params.toString());
    if (next.length === 0) q.delete('groups');
    else q.set('groups', next.join(','));
    router.push(`${pathname}${q.toString() ? `?${q}` : ''}`);
  }

  const whole = groupIds.length === 0;

  return (
    <header className="rhead">
      <div className="rhead-chips" role="group" aria-label="Filter by squad group">
        <button
          type="button"
          className="rhead-chip"
          aria-pressed={whole}
          onClick={() => setGroups([])}
        >
          {whole ? <span aria-hidden="true">✓</span> : null}
          Whole squad
        </button>
        {groups.map((g) => {
          const on = groupIds.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              className="rhead-chip"
              aria-pressed={on}
              onClick={() =>
                setGroups(on ? groupIds.filter((id) => id !== g.id) : [...groupIds, g.id])
              }
            >
              {on ? <span aria-hidden="true">✓</span> : null}
              {g.name}
            </button>
          );
        })}
      </div>

      <div className="rhead-eyerow">
        <p className="rhead-eyebrow">{eyebrow}</p>
        {actions ? <div className="rhead-actions">{actions}</div> : null}
      </div>

      <h1 className="rhead-title">{title}</h1>

      {tabs || tabsNode || period ? (
        <div className="rhead-tabrow">
          {tabsNode}
          {tabs && tabs.length > 0 ? (
            <div className="rhead-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  className="rhead-tab"
                  aria-selected={t.selected}
                  onClick={t.onSelect}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
          {period ? (
            <div className="rhead-period">{period}</div>
          ) : null}
        </div>
      ) : null}
      {sub}
    </header>
  );
}
