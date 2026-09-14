'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { applyTemplate } from '@/lib/queries/weekTemplates';
import { formatDate } from '@/lib/format';
import { Dialog } from '@/components/Dialog/Dialog';
import { applyConsequence, applyKeeps, applySkipped } from '@/lib/applyTemplateWords';

type PreviewRow = { date: string; md: string | null; existingTitles: string[]; templateTitles: string[]; result: string };
type PlanSummary = { create: number; softDelete: number; keep: number; keepsMatch: boolean; unmapped: number[] } | null;

type Props = {
  orgId: string;
  userId: string;
  orgName: string;
  templates: { id: string; name: string }[];
  selectedTemplateId: string | null;
  weekStart: string;
  fixtureId: string | null;
  timezone: string;
  previewRows: PreviewRow[];
  planSummary: PlanSummary;
};

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export function ApplyControls({ orgId, userId, templates, selectedTemplateId, weekStart, fixtureId, timezone, previewRows, planSummary }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; softDeleted: number } | null>(null);
  /* PATTERN-S4 C7 (batch B7): applying replaces the week, and the consequence
     is named before the button in B11's dialog — the one confirmation on the
     planner that earns its keep, because the removal is a soft delete nobody
     can undo from a screen. */
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new HumanError('Choose a template first.');
      const res = await withWriteTimeout(
        applyTemplate(createClient(), orgId, userId, { templateId: selectedTemplateId, weekStart, strategy: 'replace', fixtureId }, timezone),
      );
      if (res.error) throw new HumanError(res.error);
      return res;
    },
    onSuccess: (res) => {
      setResult({ created: res.created, softDeleted: res.softDeleted });
      setError(null);
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--sp-14)' }}>
        <label className="tiny">
          Template
          <select
            className="field"
            value={selectedTemplateId ?? ''}
            onChange={(e) => router.push(`/schedule/planner/apply${qs({ week: weekStart, template: e.target.value || undefined })}`)}
          >
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {selectedTemplateId ? (
          <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
            Applying replaces the week: every session already in it is removed and the template&rsquo;s are
            added. A session with recorded attendance or ratings stays, and so does the match.
          </p>
        ) : null}
      </div>

      {selectedTemplateId && previewRows.length > 0 ? (
        <div className="card" style={{ overflowX: 'auto', marginBottom: 'var(--sp-14)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Day</th>
                <th>Existing</th>
                <th>Template</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r) => (
                <tr key={r.date}>
                  <td className="sub num">
                    {formatDate(r.date, timezone)}
                    {r.md ? ` · ${r.md}` : ''}
                  </td>
                  <td className="tiny">{r.existingTitles.join(', ') || '—'}</td>
                  <td className="tiny">{r.templateTitles.join(', ') || '—'}</td>
                  <td className="tiny num">{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {planSummary ? (
            <p className="cap" style={{ marginTop: 'var(--sp-10)' }}>
              {applyConsequence(planSummary)} {applyKeeps(planSummary)} {applySkipped(planSummary)} Compliance expectations are not
              regenerated automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedTemplateId ? (
        <div className="card">
          {error ? (
            <div className="banner" role="alert" style={{ marginBottom: 'var(--sp-10)' }}>
              <span className="g g-warn" aria-hidden="true">⚠</span>
              <div>{error}</div>
            </div>
          ) : null}
          {result ? (
            <div className="note" style={{ marginBottom: 'var(--sp-10)' }}>
              <div className="note-glyph" aria-hidden="true">✓</div>
              <p className="note-text">
                Created {result.created} session{result.created === 1 ? '' : 's'}
                {result.softDeleted > 0 ? `, removed ${result.softDeleted}` : ''}. <Link href="/schedule">Open the Schedule →</Link>
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => setConfirming(true)}
            aria-haspopup="dialog"
            disabled={mutation.isPending || result !== null || (planSummary?.create === 0 && planSummary?.softDelete === 0)}
          >
            {mutation.isPending ? 'Applying…' : 'Apply template'}
          </button>
          {planSummary ? (
            <Dialog
              open={confirming}
              onClose={() => setConfirming(false)}
              title="Replace this week with the template?"
              tone="warn"
              actions={
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setConfirming(false);
                      mutation.mutate();
                    }}
                  >
                    Replace the week
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                    Keep the week as it is
                  </button>
                </>
              }
            >
              <ul className="dlg-lines" data-apply-consequence>
                <li>{applyConsequence(planSummary)}</li>
                {applyKeeps(planSummary) ? <li>{applyKeeps(planSummary)}</li> : null}
                {applySkipped(planSummary) ? <li>{applySkipped(planSummary)}</li> : null}
                <li>Removed sessions come off the schedule and the athlete app. Nothing here restores them.</li>
              </ul>
            </Dialog>
          ) : null}
        </div>
      ) : null}

      <p className="cap" style={{ marginTop: 'var(--sp-14)' }}>
        Applying a template can&rsquo;t be undone, and there is no conflict check if someone
        else edits this week while you have this page open. Review the plan above before
        applying. The sessions it creates are in the athlete app straight away, for the
        groups each one names.
      </p>
    </>
  );
}
