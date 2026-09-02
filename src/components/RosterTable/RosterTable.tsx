'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pill } from '@/components/Pill/Pill';
import { createClient } from '@/lib/supabase/client';
import { fetchSquadList, type SquadRow } from '@/lib/queries/squad';
import { qk } from '@/lib/queries/keys';
import { availabilityStatus } from '@/lib/status';
import { BLANK, enumLabel } from '@/lib/format';

type Props = {
  orgId: string;
  groupIds: readonly string[];
  initialRows: SquadRow[];
};

/**
 * The roster.
 *
 * The group filter lives in the URL and is applied in the query, so the server
 * render and this component agree on the same key. Search is local text
 * matching over the rows already fetched and deliberately does not go back to
 * the database: a 28 row squad does not need a round trip per keystroke.
 */
export function RosterTable({ orgId, groupIds, initialRows }: Props) {
  const [term, setTerm] = useState('');

  const { data = initialRows } = useQuery({
    queryKey: qk.squad.list(orgId, groupIds),
    queryFn: () => fetchSquadList(createClient(), orgId, groupIds),
    initialData: initialRows,
  });

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((row) =>
      `${row.first_name} ${row.last_name} ${row.position ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [data, term]);

  return (
    <>
      <div className="form-row">
        <label className="label" htmlFor="roster-search">
          Search the squad
        </label>
        <input
          id="roster-search"
          className="field"
          type="search"
          value={term}
          placeholder="Name or position"
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="cap">No athlete matches that filter.</p>
      ) : (
        <table className="tbl">
          <caption className="visually-hidden">
            Squad roster with current availability
          </caption>
          <thead>
            <tr>
              <th scope="col" className="r">
                No.
              </th>
              <th scope="col">Athlete</th>
              <th scope="col">Position</th>
              <th scope="col">Availability</th>
              <th scope="col">Restrictions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = availabilityStatus(
                row.availability === 'unknown' ? null : row.availability,
              );
              return (
                /* AVAILABILITY TINTS THE WHOLE ROW — the design's own caption for
                   this screen. The pill already says the status, but a pill is
                   read one row at a time; a row wash is what lets a coach see
                   how much of the squad is carrying something in a single
                   glance down the list, which is the question this page exists
                   to answer. Available stays untinted: it is the normal case,
                   and tinting the majority would make the exceptions harder to
                   see rather than easier. */
                <tr key={row.id} data-availability={row.availability}>
                  <td className="r num">{row.squad_number ?? BLANK}</td>
                  <td>
                    <Link href={`/squad/${row.id}`} className="nm">
                      {row.first_name} {row.last_name}
                    </Link>
                  </td>
                  <td className="sub">{row.position ?? BLANK}</td>
                  <td>
                    <Pill status={status} />
                  </td>
                  <td className="sub">
                    {row.restrictions.length > 0
                      ? row.restrictions.map(enumLabel).join(' · ')
                      : BLANK}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
