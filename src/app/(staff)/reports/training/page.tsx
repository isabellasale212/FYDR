import { permanentRedirect } from 'next/navigation';

/** The training report was two reports (the catalogue addendum, 13 September
 *  2026): the per-session GPS board that lived here is the GPS report at
 *  /reports/gps, and the RPE × minutes report is the Training load report at
 *  /reports/training-load. Neither keeps the name "Training report", because
 *  that name was the ambiguity — so this address keeps nothing but a redirect
 *  for old links, carrying the query (mode, session, groups, range) across. */
export default async function TrainingReportMoved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) qs.set(k, v[0]);
  }
  const q = qs.toString();
  permanentRedirect(`/reports/gps${q ? `?${q}` : ''}`);
}
