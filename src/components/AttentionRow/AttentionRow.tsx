import Link from 'next/link';
import type { AttentionRow as Row } from '@/lib/queries/flags';
import { Pill } from '@/components/Pill/Pill';
import { SEVERITY_STATUS } from '@/lib/status';

type Props = { row: Row; rank: number };

/**
 * One ranked line on the attention list.
 *
 * A TABLE ROW, not a sentence. It used to read "Name position what value
 * against their own baseline, open N days." — which is fine once and unreadable
 * ten times: every row a different length, the numbers landing in a different
 * place on each line, and nothing to scan down. The facts are unchanged; they
 * are in columns now, so a coach can run an eye down "vs baseline" instead of
 * reading ten sentences to find the worst one.
 *
 * The columns are fixed rather than content-sized (see .attn in base.css):
 * severity is a stable width so the pills line up, and "open" is right-aligned
 * so the durations compare as numbers.
 */
export function AttentionRow({ row, rank }: Props) {
  return (
    <div className="attn">
      <div className="rank num">{rank}</div>

      <div className="attn-who">
        <Link href={`/squad/${row.athlete_id}`} className="attn-name">
          {row.name}
        </Link>
        {row.position ? <span className="attn-pos">{row.position}</span> : null}
      </div>

      <div className="attn-vs">
        <span className="attn-what">{row.what}</span>
        {row.value ? <span className="v num">{row.value}</span> : null}
        {/* The baseline stays on the row. A reading with nothing to read it
            against is the one number on this page nobody can act on. */}
        {row.baseline ? (
          <span className="base num" title={`${row.name}'s own baseline`}>
            vs {row.baseline}
          </span>
        ) : null}
      </div>

      {/* The compact age, not the sentence: ten rows of "open 21 days" is ten
          widths to read past where the column wants a number to scan down. */}
      <div className="attn-open num">{row.durationShort}</div>

      <div className="attn-sev">
        <Pill status={SEVERITY_STATUS[row.severity]} />
        {row.flag_count > 1 ? <span className="tiny num">{row.flag_count}</span> : null}
      </div>
    </div>
  );
}
