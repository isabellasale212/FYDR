'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { submitProblemReport } from '@/lib/queries/problemReports';
import { ProblemReportInput, type ProblemReportInput as ProblemReportInputType } from '@/lib/validation/problemReport';

const CATEGORIES = [
  { value: 'injury_or_pain', label: 'Injury or pain' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'other', label: 'Something else' },
] as const;

type Props = { orgId: string; athleteId: string; userId: string };

/** 03-flows.md §6 / roadmap screen 36. A category chip row (optional — see
 *  migration 0040's own reasoning: "didn't say" is a real answer, not
 *  defaulted to "other") plus free text, same mutation/error/router shape
 *  as NutritionCheckinForm. No colour cue on the category chips for the
 *  same reason that form gives for its own three answers: a category isn't
 *  a graded outcome, so nothing here should look like the "right" one to
 *  tap. */
export function ProblemReportForm({ orgId, athleteId, userId }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<ProblemReportInputType['category']>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: ProblemReportInputType) => {
      const result = await submitProblemReport(createClient(), input, { orgId, athleteId, userId });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => router.push('/report-problem?submitted=1'),
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = { id: crypto.randomUUID(), category, body };
    const parsed = ProblemReportInput.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Something on this didn’t check out. Try again.');
      return;
    }
    setError(null);
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card">
      <p className="banner" role="note" style={{ marginBottom: 14 }}>
        <span className="g g-faint" aria-hidden="true">
          ⓘ
        </span>
        {/* The button says "Send to staff" at the club's request, but who
         *  actually receives this has not changed and the athlete should not
         *  be misled about it: problem_reports is medical-only by design
         *  (migration 0040 — coach and admin cannot see that a report even
         *  exists). So the notice keeps naming medical explicitly. */}
        <span>
          Goes to your club&rsquo;s medical staff. Not a substitute for emergency care &mdash; if
          this is urgent, contact emergency services or your GP.
        </span>
      </p>

      <p className="label">What kind of thing is this? (optional)</p>
      <div className="chiprow" style={{ marginTop: 8 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className="squad-chip"
            aria-pressed={category === c.value}
            onClick={() => setCategory(category === c.value ? null : c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="label" htmlFor="report-body" style={{ marginTop: 14, display: 'block' }}>
        What&rsquo;s going on?
      </label>
      <textarea
        id="report-body"
        className="field"
        rows={5}
        maxLength={1000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Tell us what you're noticing and when it started."
      />
      <p className="tiny" style={{ marginTop: 4 }}>
        <span className="mono">{body.length}</span>/1000
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      <div className="subm">
        <button
          className="btn-primary"
          type="submit"
          disabled={mutation.isPending || body.trim().length === 0}
          style={{ width: '100%', minHeight: 56 }}
        >
          {mutation.isPending ? 'Sending…' : 'Send to staff'}
        </button>
      </div>
    </form>
  );
}
