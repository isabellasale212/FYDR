import { SkCard, SkChips, SkLine, SkPage, SkPageHead } from '@/components/Skeleton/Skeleton';

/* The GPS report while its board loads — eight sequential rounds after the
 * 16 Sept 2026 fixes, the heaviest report (docs/perf-measurements-2026-09-16.md).
 * Shaped like the page: the chips, the title and its definition card, the
 * session overview with its three dials, the on-the-board figure beside the
 * individual-player card, then the board at its row height. */
export default function GpsReportLoading() {
  return (
    <SkPage label="the GPS report">
      <SkChips n={5} />
      <SkPageHead title="18%" />
      <SkCard h={64}>
        <SkLine w="92%" />
        <SkLine w="30%" />
      </SkCard>
      <div className="sk-row" style={{ justifyContent: 'space-between' }}>
        <span className="sk sk-chip" style={{ flex: '0 0 120px' }} />
        <span className="sk sk-chip" style={{ flex: '0 0 220px' }} />
      </div>
      <SkCard h={170}>
        <div className="sk-cols">
          <div>
            <SkLine w="30%" size="h1" />
            <SkLine w="60%" size="label" />
            <SkLine w="44%" />
          </div>
          <div className="sk-row">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className="sk" style={{ width: 84, height: 84, borderRadius: 'var(--r-round)', flex: 'none' }} />
            ))}
          </div>
        </div>
      </SkCard>
      <div className="sk-cols">
        <SkCard h={150}>
          <SkLine w="30%" size="label" />
          <SkLine w="20%" size="num" />
          <SkLine w="70%" size="label" />
        </SkCard>
        <SkCard h={150} lines={3} />
      </div>
      <SkCard h={560}>
        <SkLine w="12%" />
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="sk sk-table-row" />
        ))}
      </SkCard>
    </SkPage>
  );
}
