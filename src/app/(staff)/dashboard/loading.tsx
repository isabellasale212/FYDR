import { SkCard, SkChips, SkLine, SkPage, SkPageHead } from '@/components/Skeleton/Skeleton';

/* The dashboard while its tiles load — measured at 20 sequential rounds of
 * queries after the 16 Sept 2026 fixes, the most of any route
 * (docs/perf-measurements-2026-09-16.md). Shaped like the page: the head,
 * the group chips, the week strip, the five tiles, the attention panel, then
 * Today beside Outstanding entries, at the heights the real cards take. */
export default function DashboardLoading() {
  return (
    <SkPage label="the dashboard">
      <SkPageHead title="24%" />
      <SkChips n={5} />
      <SkCard h={150}>
        <div className="sk-row">
          <SkLine w="18%" size="label" />
          <SkLine w="26%" size="label" />
        </div>
        <div className="sk-row" style={{ marginTop: 'var(--sp-14)' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="sk" style={{ height: 64 }} />
          ))}
        </div>
      </SkCard>
      <div className="sk-row">
        {Array.from({ length: 5 }, (_, i) => (
          <SkCard key={i} h={170}>
            <SkLine w="52%" size="label" />
            <SkLine w="34%" size="num" />
            <SkLine w="70%" />
            <SkLine w="48%" size="label" />
          </SkCard>
        ))}
      </div>
      <SkCard h={150}>
        <div className="sk-row">
          <span className="sk" style={{ width: 38, height: 38, flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <SkLine w="24%" />
            <SkLine w="44%" size="label" />
            <SkLine w="60%" size="label" />
          </div>
        </div>
      </SkCard>
      <div className="sk-cols">
        <SkCard h={250} lines={5} />
        <SkCard h={300} lines={6} />
      </div>
    </SkPage>
  );
}
