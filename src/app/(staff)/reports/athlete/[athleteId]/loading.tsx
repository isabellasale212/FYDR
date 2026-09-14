import { SkCard, SkLine, SkPage, SkPageHead } from '@/components/Skeleton/Skeleton';

/* The athlete report while it loads — eleven sequential rounds after the
 * 16 Sept 2026 fixes (docs/perf-measurements-2026-09-16.md). Shaped like the
 * page: the athlete's head, the summary tiles, then the domain cards in two
 * columns at their heights. */
export default function AthleteReportLoading() {
  return (
    <SkPage label="the athlete report">
      <SkPageHead title="30%" />
      <div className="sk-row">
        {Array.from({ length: 4 }, (_, i) => (
          <SkCard key={i} h={120}>
            <SkLine w="50%" size="label" />
            <SkLine w="36%" size="num" />
            <SkLine w="64%" size="label" />
          </SkCard>
        ))}
      </div>
      <div className="sk-cols">
        <SkCard h={320} lines={7} />
        <SkCard h={320} lines={7} />
      </div>
      <div className="sk-cols">
        <SkCard h={260} lines={5} />
        <SkCard h={260} lines={5} />
      </div>
    </SkPage>
  );
}
