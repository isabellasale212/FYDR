'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { acknowledgeProblemReport, closeProblemReport, type OpenProblemReport } from '@/lib/queries/problemReports';
import { formatDateTime } from '@/lib/format';

const CATEGORY_LABEL: Record<string, string> = {
  injury_or_pain: 'Injury or pain',
  wellbeing: 'Wellbeing',
  other: 'Other',
};

function ReportRow({ report, userId, timezone }: { report: OpenProblemReport; userId: string; timezone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeProblemReport(createClient(), report.id, userId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeProblemReport(createClient(), report.id, userId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const pending = acknowledgeMutation.isPending || closeMutation.isPending;

  return (
    <div className="load-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="nm">
            {report.first_name} {report.last_name}
          </span>
          <span className={`pill ${report.status === 'open' ? 'pill-warn' : 'pill-good'}`}>
            {report.status === 'open' ? 'Not yet seen' : 'Acknowledged'}
          </span>
        </div>
        <div className="tiny" style={{ marginTop: 3 }}>
          {formatDateTime(report.created_at, timezone)}
          {report.category ? ` · ${CATEGORY_LABEL[report.category] ?? report.category}` : ''}
        </div>
        <p style={{ fontSize: 14, marginTop: 6 }}>{report.body}</p>
        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 6 }}>
            {error}
          </p>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {report.status === 'open' ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => acknowledgeMutation.mutate()}
          >
            {acknowledgeMutation.isPending ? 'Saving…' : 'Acknowledge'}
          </button>
        ) : null}
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => closeMutation.mutate()}>
          {closeMutation.isPending ? 'Saving…' : 'Close'}
        </button>
      </div>
    </div>
  );
}

/** Medical-only, per migration 0040's own RLS: this component is never
 *  rendered for a coach at all (see (staff)/injuries/page.tsx's own
 *  `isMedical` gate), and even if it somehow were, fetchOpenProblemReports
 *  would hand a coach an empty array — the access control is the RLS
 *  policy, this is just where the UI hides the empty section. Acknowledge
 *  then Close, or Close directly for a duplicate/mis-tap; migration 0040's
 *  trigger is what actually enforces both the transition and the
 *  acting-user stamp, this only performs the update it expects. */
export function ProblemReportsTriage({ reports, userId, timezone }: { reports: OpenProblemReport[]; userId: string; timezone: string }) {
  if (reports.length === 0) {
    return <p className="cap">No open reports. Anything an athlete sends will show up here.</p>;
  }

  return (
    <div className="card flush">
      {reports.map((r, index) => (
        <div key={r.id}>
          {index > 0 ? <div className="hair" /> : null}
          <ReportRow report={r} userId={userId} timezone={timezone} />
        </div>
      ))}
    </div>
  );
}
