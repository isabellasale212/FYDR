import Link from 'next/link';
import type { AttentionRow as Row } from '@/lib/queries/flags';
import { Pill } from '@/components/Pill/Pill';
import { SEVERITY_STATUS } from '@/lib/status';

type Props = { row: Row; rank: number };

/**
 * One ranked line on the attention list.
 *
 * The sentence is the point: the value, the athlete's own baseline for that
 * metric, and how long it has been like that. A number with no baseline beside
 * it is a number nobody can act on.
 */
export function AttentionRow({ row, rank }: Props) {
  return (
    <div className="attn">
      <div className="rank mono">{rank}</div>
      <div>
        <p className="line">
          <Link href={`/squad/${row.athlete_id}`}>
            <b>{row.name}</b>
          </Link>{' '}
          {row.position ? <span className="tiny">{row.position}</span> : null}{' '}
          {row.what}
          {row.value ? (
            <>
              {' '}
              <span className="v mono">{row.value}</span>
            </>
          ) : null}
          {row.baseline ? (
            <>
              {' '}
              against his own <span className="base mono">{row.baseline}</span>
            </>
          ) : null}
          , <span className="dur">{row.duration}</span>.
        </p>
        <div className="chiprow" style={{ marginTop: 6 }}>
          <Pill status={SEVERITY_STATUS[row.severity]} />
          {row.flag_count > 1 ? (
            <span className="tiny mono">{row.flag_count} open flags</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
