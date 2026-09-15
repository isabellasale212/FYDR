'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createInjury, setAvailability, upsertClinical } from '@/lib/queries/injuries';
import { AvailabilityAudience } from '@/components/AvailabilityAudience/AvailabilityAudience';
import { todayIso } from '@/lib/format';
import type { BodySide, InjurySeverity, OccurrenceContext } from '@/lib/types/database';

/* PATTERN-S3 C9 (ruled unblocked, built 2026-09-14): the injury form is split
 * by permission, not by importance. Left column, what every injury role
 * writes and a coach reads: athlete, date, site, availability, restrictions,
 * expected return. Right column, medical staff and the athlete only:
 * diagnosis, mechanism, severity. Save works with the right column empty,
 * and the well says what that means. On a phone the columns stack and the
 * left column IS the pitch-side form: four fields at 44px, three full-width
 * status buttons, and a save button that says what saving does.
 *
 * Two of the board's fields are gated by rules that already stand, and the
 * form follows the rules rather than the drawing:
 *   - Injury-linked availability is medical staff's write
 *     (availability_medical_insert, 0012; the coach's own policy, 0042,
 *     requires injury_id null). So the status buttons and restrictions are
 *     the medic's; for every other role the well says who sets it and that
 *     the athlete's current status stands until then. On the sheet.
 *   - Body site and side are withheld from the coach while the club's
 *     setting is off (PATTERN-S3 C8, 0122): a coach who cannot read the site
 *     is not asked to write it either — the fields are absent, not locked.
 *
 * Saving is up to three writes in order — the injury, then its availability,
 * then its clinical row — and a failure after the first says which part did
 * not land and points at the record, where the rest can be done. */

const BODY_AREAS = [
  'head', 'neck', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
  'chest', 'upper_back', 'lower_back', 'abdomen', 'hip', 'groin',
  'quadriceps', 'hamstring', 'knee', 'calf', 'achilles', 'ankle', 'foot', 'other',
] as const;
const SIDES = ['left', 'right', 'bilateral'] as const;
const OCCURRED_IN = ['training', 'match', 'gym', 'other', 'unknown'] as const;
const STATUSES = ['available', 'modified', 'unavailable'] as const;
const SEVERITIES = ['minor', 'moderate', 'severe'] as const;
/* The same quick-pick set as SetAvailabilityForm; anything typed there still
   works and the schema is text[], so these are the common ones, not the list. */
const COMMON_RESTRICTIONS = ['no contact', 'no sprinting', 'no loading', 'upper body only', 'no pitch work', 'gym modification'];

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

type Athlete = { id: string; first_name: string; last_name: string };

type Props = {
  orgId: string;
  userId: string;
  timezone: string;
  athletes: readonly Athlete[];
  /** Pre-selected when this form is opened from one athlete's own context —
   *  their profile's "+ Log injury" — so their name does not have to be found
   *  again in a list of twenty-nine. Resolved and VALIDATED by the page against
   *  the athletes it already fetched, so an id that is missing, deleted, or from
   *  another organisation arrives here as undefined and the picker simply opens
   *  unset rather than pre-filling something wrong.
   *
   *  Still a select rather than a fixed label: the person may have clicked into
   *  the wrong profile, and taking the choice away to save a click is a bad
   *  trade on a medical record. */
  initialAthleteId?: string;
  /** Medical staff: the right column, and the availability block on the left.
   *  Data, not a predicate — resolved by the page from CLINICAL_ONLY. */
  clinical: boolean;
  /** Whether this viewer reads the body site (C8): every role but a coach,
   *  and a coach when the club's setting is on. Off, the fields are absent. */
  siteVisible: boolean;
};

export function NewInjuryForm({ orgId, userId, timezone, athletes, initialAthleteId, clinical, siteVisible }: Props) {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState(initialAthleteId ?? '');
  const [bodyArea, setBodyArea] = useState<(typeof BODY_AREAS)[number]>('hamstring');
  const [side, setSide] = useState('');
  const [onsetDate, setOnsetDate] = useState(todayIso(timezone));
  const [occurredIn, setOccurredIn] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number] | null>(null);
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());
  const [diagnosis, setDiagnosis] = useState('');
  const [mechanism, setMechanism] = useState('');
  const [severity, setSeverity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<{ id: string; what: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const athlete = athletes.find((a) => a.id === athleteId) ?? null;
  const athleteName = athlete ? `${athlete.first_name} ${athlete.last_name}` : 'this athlete';
  const setsAvailability = clinical && status !== null;
  const hasClinical = clinical && (diagnosis.trim() !== '' || mechanism.trim() !== '' || severity !== '');

  function toggleRestriction(r: string) {
    setRestrictions((current) => {
      const next = new Set(current);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const db = createClient();
      const created = await withWriteTimeout(
        createInjury(db, orgId, userId, {
          athleteId,
          /* A coach who cannot read the site does not set one: the medic
             records it on the record. 'other' is the schema's own "not
             said" value, and the card reads "Site withheld" / "Injury" for
             the coach either way (C8). */
          bodyArea: siteVisible ? bodyArea : 'other',
          side: siteVisible ? ((side || null) as BodySide | null) : null,
          onsetDate,
          occurredIn: (occurredIn || null) as OccurrenceContext | null,
          expectedReturn: expectedReturn || null,
        }),
      );
      if (created.error) throw new Error(created.error);
      if (!created.id) throw new Error('That didn’t save. Try again in a moment.');
      const id = created.id;

      if (setsAvailability && status) {
        const avail = await withWriteTimeout(
          setAvailability(db, orgId, athleteId, userId, {
            status,
            restrictions: status === 'available' ? [] : [...restrictions],
            reasonCategory: status === 'available' ? null : 'injury',
            note: null,
            injuryId: id,
          }),
        );
        if (avail.error) return { id, partial: `availability was not set (${avail.error})` };
      }

      if (hasClinical) {
        const clin = await withWriteTimeout(
          upsertClinical(db, orgId, id, userId, {
            diagnosis: diagnosis.trim() || null,
            mechanism: mechanism.trim() || null,
            severity: (severity || null) as InjurySeverity | null,
            tissueType: null,
            imaging: null,
            referral: null,
            clinicalNotes: null,
            treatmentPlan: null,
          }),
        );
        if (clin.error) return { id, partial: `the clinical detail was not saved (${clin.error})` };
      }

      return { id, partial: null };
    },
    onSuccess: (result) => {
      if (result.partial) {
        /* The record exists; part of it did not land. Say which, and where
           to finish — never navigate away from an error the person has not
           read. */
        setPartial({ id: result.id, what: result.partial });
        setConfirming(false);
        return;
      }
      router.push(`/injuries/${result.id}`);
    },
    onError: (err: Error) => {
      setConfirming(false);
      setError(toUserMessage(err, 'staff'));
    },
  });

  function validate(): boolean {
    if (!athleteId) {
      setError('Choose an athlete.');
      return false;
    }
    if (!onsetDate) {
      setError('Set an onset date.');
      return false;
    }
    setError(null);
    return true;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || partial) return;
    if (!validate()) return;
    /* A status change has an audience; name it before it lands (PATTERN-S3
       C4), the same step the availability form takes. Without a status the
       save is the injury record alone and needs no second step. */
    if (setsAvailability) {
      setConfirming(true);
      return;
    }
    mutation.mutate();
  }

  const saveLabel = mutation.isPending
    ? 'Saving…'
    : setsAvailability && status
      ? `Log the injury and set ${label(status)}`
      : 'Log the injury';

  return (
    <form onSubmit={onSubmit} className="card" noValidate data-injury-form>
      <div className="inj-cols">
        <div>
          <label className="label" htmlFor="new-inj-athlete">
            Athlete
          </label>
          <select id="new-inj-athlete" className="field" value={athleteId} onChange={(event) => setAthleteId(event.target.value)}>
            <option value="">Choose an athlete</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>

          <label className="label" htmlFor="new-inj-onset" style={{ marginTop: 'var(--sp-14)' }}>
            Onset date
          </label>
          <input id="new-inj-onset" className="field" type="date" value={onsetDate} onChange={(event) => setOnsetDate(event.target.value)} />

          {siteVisible ? (
            <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="label" htmlFor="new-inj-area">
                  Body area
                </label>
                <select
                  id="new-inj-area"
                  className="field"
                  value={bodyArea}
                  onChange={(event) => setBodyArea(event.target.value as (typeof BODY_AREAS)[number])}
                >
                  {BODY_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {label(a)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="label" htmlFor="new-inj-side">
                  Side
                </label>
                <select id="new-inj-side" className="field" value={side} onChange={(event) => setSide(event.target.value)}>
                  <option value="">Not applicable</option>
                  {SIDES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <label className="label" htmlFor="new-inj-occurred" style={{ marginTop: 'var(--sp-14)' }}>
            Occurred in
          </label>
          <select id="new-inj-occurred" className="field" value={occurredIn} onChange={(event) => setOccurredIn(event.target.value)}>
            <option value="">Not recorded</option>
            {OCCURRED_IN.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </select>

          {clinical ? (
            <>
              <p className="label" style={{ marginTop: 'var(--sp-14)' }}>
                Availability
              </p>
              <div className="inj-status" role="group" aria-label="Availability">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="squad-chip"
                    aria-pressed={status === s}
                    onClick={() => setStatus((current) => (current === s ? null : s))}
                  >
                    {label(s)}
                  </button>
                ))}
              </div>
              <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
                Leave it unset and {athleteName}&rsquo;s current status stands.
              </p>

              {status !== null && status !== 'available' ? (
                <>
                  <p className="label" style={{ marginTop: 'var(--sp-14)' }}>
                    Restrictions
                  </p>
                  <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
                    {COMMON_RESTRICTIONS.map((r) => (
                      <button key={r} type="button" className="squad-chip" aria-pressed={restrictions.has(r)} onClick={() => toggleRestriction(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
                    Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol.
                  </p>
                </>
              ) : null}
            </>
          ) : null}

          <label className="label" htmlFor="new-inj-expected" style={{ marginTop: 'var(--sp-14)' }}>
            Expected return (optional)
          </label>
          <input id="new-inj-expected" className="field" type="date" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} />
        </div>

        {clinical ? (
          <div className="inj-clinical" data-injury-clinical-column>
            <p className="eyebrow">Medical staff and the athlete only</p>
            <label className="label" htmlFor="new-inj-diagnosis" style={{ marginTop: 'var(--sp-8)' }}>
              Diagnosis
            </label>
            <input id="new-inj-diagnosis" className="field" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />

            <label className="label" htmlFor="new-inj-mechanism" style={{ marginTop: 'var(--sp-14)' }}>
              Mechanism
            </label>
            <input id="new-inj-mechanism" className="field" value={mechanism} onChange={(event) => setMechanism(event.target.value)} />

            <label className="label" htmlFor="new-inj-severity" style={{ marginTop: 'var(--sp-14)' }}>
              Severity
            </label>
            <select id="new-inj-severity" className="field" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">Not recorded</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>

            <div className="banner" style={{ marginTop: 'var(--sp-14)' }}>
              <span className="g" aria-hidden="true">
                i
              </span>
              <div>
                Saving works with this column empty: the record is created and the availability you set lands now. Add the
                diagnosis on the record when you have it. Nothing in this column is ever shown to coaching staff.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!clinical ? (
        <div className="banner" style={{ marginTop: 'var(--sp-14)' }} data-injury-availability-well>
          <span className="g" aria-hidden="true">
            i
          </span>
          <div>
            Availability for an injury is set by medical staff from this record. Until they do, {athleteName}&rsquo;s
            current status stands{siteVisible ? '' : ', and medical staff record where the injury is'}.
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      {partial ? (
        <div className="banner" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          <span className="g g-warn" aria-hidden="true">
            ⚠
          </span>
          <div>
            The injury was recorded, but {partial.what}. <Link href={`/injuries/${partial.id}`}>Open the record</Link> to
            finish it there.
          </div>
        </div>
      ) : null}

      {confirming && status ? (
        <div style={{ marginTop: 'var(--sp-14)' }}>
          <AvailabilityAudience
            athleteName={athleteName}
            status={status}
            injuryLinked
            hasNote={false}
            pending={mutation.isPending}
            onConfirm={() => mutation.mutate()}
            onBack={() => setConfirming(false)}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-18)', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" disabled={mutation.isPending || partial !== null}>
            {saveLabel}
          </button>
          <button type="button" className="btn-ghost" onClick={() => router.push('/injuries')}>
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
