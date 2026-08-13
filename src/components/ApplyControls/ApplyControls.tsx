'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { applyTemplate, type ApplyStrategy } from '@/lib/queries/weekTemplates';
import { formatDate } from '@/lib/format';

type PreviewRow = { date: string; md: string | null; existingTitles: string[]; templateTitles: string[]; result: string };
type PlanSummary = { create: number; softDelete: number; keep: number; unmapped: number[] } | null;

type Props = {
  orgId: string;
  userId: string;
  orgName: string;
  templates: { id: string; name: string }[];
  selectedTemplateId: string | null;
  weekStart: string;
  strategy: ApplyStrategy;
  fixtureId: string | null;
  previewRows: PreviewRow[];
  planSummary: PlanSummary;
};

const STRATEGIES: { value: ApplyStrategy; label: string; blurb: string }[] = [
  { value: 'add', label: 'Add alongside', blurb: 'Nothing existing is touched. Template sessions are added.' },
  { value: 'replace_planned', label: 'Replace planned', blurb: 'Planned sessions with no recorded data are removed, then the template is added.' },
  { value: 'fill_gaps', label: 'Fill gaps only', blurb: 'Template sessions are created only on days with nothing scheduled at all.' },
];

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export function ApplyControls({ orgId, userId, templates, selectedTemplateId, weekStart, strategy, fixtureId, previewRows, planSummary }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; softDeleted: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new HumanError('Choose a template first.');
      const res = await withWriteTimeout(
        applyTemplate(createClient(), orgId, userId, { templateId: selectedTemplateId, weekStart, strategy, fixtureId }),
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
      <div className="card" style={{ marginBottom: 14 }}>
        <label className="tiny">
          Template
          <select
            className="field"
            value={selectedTemplateId ?? ''}
            onChange={(e) => router.push(`/schedule/planner/apply${qs({ week: weekStart, template: e.target.value || undefined, strategy })}`)}
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
          <div className="chiprow" style={{ marginTop: 14 }} role="radiogroup" aria-label="Apply strategy">
            {STRATEGIES.map((s) => (
              <Link
                key={s.value}
                href={`/schedule/planner/apply${qs({ week: weekStart, template: selectedTemplateId, strategy: s.value })}`}
                className="squad-chip"
                aria-pressed={strategy === s.value}
                title={s.blurb}
              >
                {s.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {selectedTemplateId && previewRows.length > 0 ? (
        <div className="card" style={{ overflowX: 'auto', marginBottom: 14 }}>
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
                  <td className="sub mono">
                    {formatDate(r.date)}
                    {r.md ? ` · ${r.md}` : ''}
                  </td>
                  <td className="tiny">{r.existingTitles.join(', ') || '—'}</td>
                  <td className="tiny">{r.templateTitles.join(', ') || '—'}</td>
                  <td className="tiny mono">{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {planSummary ? (
            <p className="cap" style={{ marginTop: 10 }}>
              {planSummary.create} session{planSummary.create === 1 ? '' : 's'} will be created.{' '}
              {planSummary.softDelete} existing session{planSummary.softDelete === 1 ? '' : 's'} removed. {planSummary.keep} kept.
              {planSummary.unmapped.length > 0
                ? ` ${planSummary.unmapped.length} template position${planSummary.unmapped.length === 1 ? '' : 's'} have no matching day this week and will be skipped.`
                : ''}{' '}
              Compliance expectations are not regenerated automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedTemplateId ? (
        <div className="card">
          {error ? (
            <div className="banner" style={{ marginBottom: 10 }}>
              <span className="g g-warn">⚠</span>
              <div>{error}</div>
            </div>
          ) : null}
          {result ? (
            <div className="note" style={{ marginBottom: 10 }}>
              <div className="note-glyph">✓</div>
              <p className="note-text">
                Created {result.created} session{result.created === 1 ? '' : 's'}
                {result.softDeleted > 0 ? `, removed ${result.softDeleted}` : ''}. <Link href="/schedule">Open the Schedule →</Link>
              </p>
            </div>
          ) : null}
          <button type="button" className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || (planSummary?.create === 0 && planSummary?.softDelete === 0)}>
            {mutation.isPending ? 'Applying…' : 'Apply template'}
          </button>
        </div>
      ) : null}

      <p className="cap" style={{ marginTop: 14 }}>
        Applying a template can&rsquo;t be undone, and there is no conflict check if someone
        else edits this week while you have this page open. Review the plan above before
        applying.
      </p>
    </>
  );
}
