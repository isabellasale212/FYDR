import { BLANK, formatDate, formatNumber } from '@/lib/format';
import type { TestBestsForSide } from '@/lib/queries/testing';

/* The coach's request, verbatim: "add the best of all time and seasons best
 * to be visible which a trend percentage". Three tiles side by side on the
 * individual athlete's testing report, above the existing trend chart and
 * history list.
 *
 * ONE ROW OF TILES PER SIDE. A per_side test (grip strength, single-leg hop)
 * is two independent measurements, so it gets a labelled row each — the same
 * split TestTrendChart draws directly underneath. Without the label a coach
 * cannot tell which hand a 50 kg belongs to, and without the split the trend
 * compares one limb against the other. computeTestBestsBySide does the
 * partitioning; a bilateral test comes back as a single unlabelled row and
 * renders exactly as it did before.
 *
 * Server component on purpose — every number is computed by
 * computeTestBestsBySide() from history rows the page already has, so there is
 * nothing to hydrate and this costs no client JS. It also means the tiles
 * render into the printed page and into window.print()'s output, which is
 * the whole point of the Print button sitting next to them.
 *
 * The trend's meaning is printed on the tile itself, not just in a code
 * comment. A bare "+3.7%" on a coach's printout that nobody can interpret
 * six months later is the failure mode this caption exists to prevent;
 * computeTestBests()'s own header defines the number formally. */

type Props = {
  bestsBySide: readonly TestBestsForSide[];
  unit: string;
  decimalPlaces: number;
  higherIsBetter: boolean;
  seasonName: string | null;
  timezone: string;
};

function valueWithUnit(value: number | null, decimalPlaces: number, unit: string): string {
  if (value === null) return BLANK;
  return `${formatNumber(value, decimalPlaces)}${unit ? ` ${unit}` : ''}`;
}

export function TestBests({ bestsBySide, unit, decimalPlaces, higherIsBetter, seasonName, timezone }: Props) {
  return (
    <section className="card" aria-labelledby="bests-title">
      <h2 className="card-title" id="bests-title">
        Bests
      </h2>

      {bestsBySide.map((entry, index) => {
        const bests = entry.bests;

        // Positive is always an improvement — computeTestBests() already applied
        // higher_is_better when it signed the number, so a faster sprint arrives
        // here as a positive. This must not re-apply the direction.
        const tone =
          bests.trendPct === null ? 'pill-neutral' : bests.trendPct > 0 ? 'pill-good' : bests.trendPct < 0 ? 'pill-bad' : 'pill-neutral';

        const trendText = bests.trendPct === null ? BLANK : `${bests.trendPct > 0 ? '+' : ''}${bests.trendPct.toFixed(1)}%`;

        const trendCaption =
          bests.trendPct === null
            ? seasonName === null
              ? 'No current season set, so there is no season window to compare.'
              : bests.seasonValue === null
                ? 'No result inside this season yet.'
                : 'No result before this season to compare against — this is their first.'
            : `This season's best against their best before ${seasonName ?? 'this season'}. ` +
              `Positive is an improvement (${higherIsBetter ? 'higher' : 'lower'} is better on this test).`;

        // seasonIsNewAllTimeBest, not a value+date comparison done here. The
        // old inline check credited an athlete who merely EQUALLED an older
        // best with setting it this season — the exact case it claimed to
        // exclude — because it assumed allTimeDate held the earliest date the
        // mark was reached. computeTestBests now answers this directly, with a
        // strict, direction-aware comparison against everything outside the
        // season, so an equalled mark is not announced as a PB in either
        // direction.
        const isNewPb = bests.seasonIsNewAllTimeBest;

        // Keyed on 'none', not 'bilateral', for the null side: a per_side test
        // can hold BOTH a 'bilateral' row and a side-less row, and collapsing
        // them to one key would collide.
        return (
          <div key={entry.side ?? 'none'} style={{ marginTop: index === 0 ? 10 : 18 }}>
            {entry.label ? (
              <p className="label" style={{ marginBottom: 4 }}>
                {entry.label}
              </p>
            ) : null}

            <div className="grid3">
              <div>
                <p className="tiny">Season&rsquo;s best{seasonName ? ` · ${seasonName}` : ''}</p>
                <p className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                  {valueWithUnit(bests.seasonValue, decimalPlaces, unit)}
                </p>
                <p className="tiny" style={{ color: 'var(--muted)' }}>
                  {bests.seasonDate ? formatDate(bests.seasonDate, timezone) : seasonName === null ? 'No season set' : 'Not tested this season'}
                </p>
              </div>

              <div>
                <p className="tiny">All-time best</p>
                <p className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                  {valueWithUnit(bests.allTimeValue, decimalPlaces, unit)}
                </p>
                <p className="tiny" style={{ color: 'var(--muted)' }}>
                  {bests.allTimeDate ? formatDate(bests.allTimeDate, timezone) : 'No result yet'}
                </p>
              </div>

              <div>
                <p className="tiny">Season trend</p>
                <p style={{ marginTop: 2 }}>
                  <span className={`pill ${tone}`} style={{ fontSize: 15, fontWeight: 800 }}>
                    {trendText}
                  </span>
                  {isNewPb ? (
                    <span
                      className="pill pill-good"
                      style={{ marginLeft: 6 }}
                      title={`${entry.label ? `${entry.label}: t` : 'T'}his season's best beats every result from outside this season`}
                    >
                      New PB
                    </span>
                  ) : null}
                </p>
                <p className="tiny" style={{ color: 'var(--muted)' }}>
                  {trendCaption}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
