'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  updateInjuryFields,
  upsertClinical,
  type InjuryDetail,
  type InjuryClinical,
} from '@/lib/queries/injuries';
import type { BodyArea, BodySide, InjurySeverity, InjuryStatus, OccurrenceContext } from '@/lib/types/database';

const BODY_AREAS = [
  'head', 'neck', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
  'chest', 'upper_back', 'lower_back', 'abdomen', 'hip', 'groin',
  'quadriceps', 'hamstring', 'knee', 'calf', 'achilles', 'ankle', 'foot', 'other',
] as const;
const SIDES = ['left', 'right', 'bilateral'] as const;
const STATUSES = ['open', 'rehab', 'return_to_play', 'closed'] as const;
const OCCURRED_IN = ['training', 'match', 'gym', 'other', 'unknown'] as const;
const SEVERITIES = ['minor', 'moderate', 'severe'] as const;

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

type Props = { orgId: string; userId: string; injury: InjuryDetail; clinical: InjuryClinical | null };

/** screens/injury-record.md, medical-only for every field here, both the non-clinical
 *  facts (body area, side, status, dates) and the clinical detail below them — one form
 *  for both because both are written by the same role in the same visit, not because
 *  the boundary between them stops mattering. The visible divider between the two
 *  sections is the one layout detail the spec insists on keeping even without client
 *  design photographs: "a physio must be able to see at a glance which fields a coach
 *  can also see." */
export function InjuryMedicalForm({ orgId, userId, injury, clinical }: Props) {
  const router = useRouter();
  const [bodyArea, setBodyArea] = useState<string>(injury.body_area);
  const [side, setSide] = useState<string>(injury.side ?? '');
  const [status, setStatus] = useState<string>(injury.status);
  const [expectedReturn, setExpectedReturn] = useState(injury.expected_return ?? '');
  const [actualReturn, setActualReturn] = useState(injury.actual_return ?? '');
  const [occurredIn, setOccurredIn] = useState<string>(injury.occurred_in ?? '');

  const [diagnosis, setDiagnosis] = useState(clinical?.diagnosis ?? '');
  const [mechanism, setMechanism] = useState(clinical?.mechanism ?? '');
  const [severity, setSeverity] = useState<string>(clinical?.severity ?? '');
  const [tissueType, setTissueType] = useState(clinical?.tissue_type ?? '');
  const [imaging, setImaging] = useState(clinical?.imaging ?? '');
  const [referral, setReferral] = useState(clinical?.referral ?? '');
  const [clinicalNotes, setClinicalNotes] = useState(clinical?.clinical_notes ?? '');
  const [treatmentPlan, setTreatmentPlan] = useState(clinical?.treatment_plan ?? '');

  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const fieldsResult = await updateInjuryFields(createClient(), orgId, injury.id, {
        bodyArea: bodyArea as BodyArea,
        side: (side || null) as BodySide | null,
        status: status as InjuryStatus,
        expectedReturn: expectedReturn || null,
        actualReturn: actualReturn || null,
        occurredIn: (occurredIn || null) as OccurrenceContext | null,
      });
      if (fieldsResult.error) throw new Error(fieldsResult.error);

      const clinicalResult = await upsertClinical(createClient(), orgId, injury.id, userId, {
        diagnosis: diagnosis.trim() || null,
        mechanism: mechanism.trim() || null,
        severity: (severity || null) as InjurySeverity | null,
        tissueType: tissueType.trim() || null,
        imaging: imaging.trim() || null,
        referral: referral.trim() || null,
        clinicalNotes: clinicalNotes.trim() || null,
        treatmentPlan: treatmentPlan.trim() || null,
      });
      if (clinicalResult.error) throw new Error(clinicalResult.error);
    },
    onSuccess: () => router.refresh(),
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <p className="label">The facts &mdash; coach visible</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-area">
            Body area
          </label>
          <select id="inj-area" className="field" value={bodyArea} onChange={(e) => setBodyArea(e.target.value)}>
            {BODY_AREAS.map((a) => (
              <option key={a} value={a}>
                {label(a)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-side">
            Side
          </label>
          <select id="inj-side" className="field" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="">Not applicable</option>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-status">
            Status
          </label>
          <select id="inj-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-occurred">
            Occurred in
          </label>
          <select
            id="inj-occurred"
            className="field"
            value={occurredIn}
            onChange={(e) => setOccurredIn(e.target.value)}
          >
            <option value="">Not recorded</option>
            {OCCURRED_IN.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-expected">
            Expected return
          </label>
          <input
            id="inj-expected"
            className="field"
            type="date"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-actual">
            Actual return
          </label>
          <input
            id="inj-actual"
            className="field"
            type="date"
            value={actualReturn}
            onChange={(e) => setActualReturn(e.target.value)}
          />
        </div>
      </div>

      <div className="hair" style={{ margin: '18px 0' }} />

      <p className="label" style={{ color: 'var(--bad)' }}>
        Clinical detail &mdash; medical only, never shown to a coach
      </p>

      <label className="label" htmlFor="inj-diagnosis" style={{ marginTop: 10 }}>
        Diagnosis
      </label>
      <input id="inj-diagnosis" className="field" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />

      <label className="label" htmlFor="inj-mechanism" style={{ marginTop: 14 }}>
        Mechanism
      </label>
      <input id="inj-mechanism" className="field" value={mechanism} onChange={(e) => setMechanism(e.target.value)} />

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-severity">
            Severity
          </label>
          <select id="inj-severity" className="field" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Not set</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="inj-tissue">
            Tissue type
          </label>
          <input id="inj-tissue" className="field" value={tissueType} onChange={(e) => setTissueType(e.target.value)} />
        </div>
      </div>

      <label className="label" htmlFor="inj-imaging" style={{ marginTop: 14 }}>
        Imaging
      </label>
      <input id="inj-imaging" className="field" value={imaging} onChange={(e) => setImaging(e.target.value)} />

      <label className="label" htmlFor="inj-referral" style={{ marginTop: 14 }}>
        Referral
      </label>
      <input id="inj-referral" className="field" value={referral} onChange={(e) => setReferral(e.target.value)} />

      <label className="label" htmlFor="inj-treatment" style={{ marginTop: 14 }}>
        Treatment plan
      </label>
      <textarea
        id="inj-treatment"
        className="field"
        rows={3}
        value={treatmentPlan}
        onChange={(e) => setTreatmentPlan(e.target.value)}
      />

      <label className="label" htmlFor="inj-notes" style={{ marginTop: 14 }}>
        Clinical notes
      </label>
      <textarea
        id="inj-notes"
        className="field"
        rows={4}
        value={clinicalNotes}
        onChange={(e) => setClinicalNotes(e.target.value)}
      />
      <p className="tiny" style={{ marginTop: 4 }}>
        The one field no athlete ever sees, through any path.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
