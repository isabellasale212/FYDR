import Link from 'next/link';

/* THE DASHBOARD'S TWO TABS (Isabella, 16 September 2026, the overnight queue,
 * 3.4): Overview — the dashboard itself — and Match, the week's team
 * selection, drawn for the coach only (`show`). Two routes, so a link and a
 * current-page marker, the schedule's own view-tab idiom (.sg-viewtabs).
 * Hidden for every other role, not withheld: /dashboard/match answers
 * read-only for them, and the enforcement follows after Friday. */
type Props = { current: 'overview' | 'match'; show: boolean; groupIds: readonly string[] };

export function DashboardTabs({ current, show, groupIds }: Props) {
  if (!show) return null;
  const q = groupIds.length > 0 ? `?groups=${groupIds.join(',')}` : '';
  const tab = (key: Props['current'], label: string, href: string) =>
    current === key ? (
      <span className="sg-viewtab" role="tab" aria-selected="true" aria-current="page">
        {label}
      </span>
    ) : (
      <Link href={href} className="sg-viewtab" role="tab" aria-selected="false">
        {label}
      </Link>
    );
  return (
    <div className="sg-viewtabs dash-tabs" role="tablist" aria-label="Dashboard views">
      {tab('overview', 'Overview', `/dashboard${q}`)}
      {tab('match', 'Match', `/dashboard/match${q}`)}
    </div>
  );
}
