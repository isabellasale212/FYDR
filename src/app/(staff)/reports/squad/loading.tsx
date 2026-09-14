import { SkCard, SkChips, SkLine, SkPage, SkPageHead } from '@/components/Skeleton/Skeleton';

/* The squad weekly report while it loads — twelve sequential rounds after the
 * 16 Sept 2026 fixes (docs/perf-measurements-2026-09-16.md). Shaped like the
 * page: the chips, the title and its definition, the week's figure, the
 * three KPI tiles, then the roster table at its row height. */
export default function SquadReportLoading() {
  return (
    <SkPage label="the squad weekly report">
      <SkChips n={5} />
      <SkPageHead title="22%" />
      <SkCard h={64}>
        <SkLine w="88%" />
        <SkLine w="26%" />
      </SkCard>
      <SkCard h={150}>
        <SkLine w="30%" size="label" />
        <SkLine w="16%" size="num" />
        <SkLine w="60%" size="label" />
      </SkCard>
      <div className="sk-row">
        {Array.from({ length: 3 }, (_, i) => (
          <SkCard key={i} h={110}>
            <SkLine w="44%" size="label" />
            <SkLine w="30%" size="num" />
          </SkCard>
        ))}
      </div>
      <SkCard h={520}>
        <SkLine w="14%" />
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="sk sk-table-row" />
        ))}
      </SkCard>
    </SkPage>
  );
}
