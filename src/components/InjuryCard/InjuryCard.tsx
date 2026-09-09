import Link from 'next/link';
import type { AthleteInjuryRow, InjuryClinical } from '@/lib/queries/injuries';
import type { InjuryProgrammeStatus } from '@/lib/queries/injuryTimeline';
import { bodyAreaPhrase, enumLabel, formatDate } from '@/lib/format';

/** The injury card on the player profile. One card, role-driven content.
 *
 *  THE MEDIC/EVERYONE-ELSE SPLIT IS NOT A UI PREFERENCE. Everything in the
 *  limited view comes from `injuries`, which every injury role reads. Everything
 *  in the medic block comes from `injury_clinical`, a separate table whose
 *  policy (clinical_medical_only, migration 0012) admits the medic and nobody
 *  else. So a non-medic is not being shown less of the same data — they are
 *  being shown a different table, and the one they cannot see is refused by the
 *  database whatever this component does. `clinical` arrives here as null for
 *  them, and is not fetched at all.
 *
 *  NO DISABLED FIELDS ANYWHERE, which the spec is explicit about and which is
 *  worth restating because it is easy to "improve" later: a greyed-out Diagnosis
 *  row implies there is a diagnosis and that this person might unlock it. That
 *  is itself a disclosure. The limited view stops after expected return and
 *  renders nothing further, in any state.
 *
 *  BADGE LANGUAGE: clinical stage names for EVERY role — Open, Rehab, Return to
 *  play, Closed. Decided 2026-09-06, against the alternative in the spec of
 *  remapping to availability wording (Unavailable / Modified / Available) for
 *  non-medics. These are process labels rather than diagnosis, a coach planning
 *  around a recovery phase is better served by the real stage, and one
 *  vocabulary means the "two status fields that could drift" the spec warns
 *  about cannot arise: there is one status column and one mapping. */

type Props = {
  injuries: readonly AthleteInjuryRow[];
  /** Non-null only for a medic. Fetched by the page, which does not ask for it
   *  at all for anyone else — so this is not a filter applied late, it is data
   *  that never leaves the database. */
  clinical: InjuryClinical | null;
  /** Plain-language restrictions from the current availability record, e.g.
   *  ["No contact", "Conditioning only"]. Never the clinical reason. */
  restrictions: readonly string[];
  canEditClinical: boolean;
  /** Rehab programme state for the active injury. Non-null only for a medic,
   *  fetched by the page on the same condition as `clinical`. */
  programmeStatus: InjuryProgrammeStatus | null;
  timezone: string;
};

const STATUS_TONE: Record<string, string> = {
  open: 'pill-bad',
  rehab: 'pill-warn',
  return_to_play: 'pill-warn',
  closed: 'pill-neutral',
};

/* Grey label above a bold dark value, per the reference card. `.label` is the
   muted 12.5px the design system already uses for exactly this, and `.nm` the
   bold value — no new classes, the type scale is frozen. */
function ClinicalField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="label">{label}</span>
      <span className="nm" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function InjuryCard({ injuries, clinical, restrictions, canEditClinical, programmeStatus, timezone }: Props) {
  const active = injuries.find((i) => i.status !== 'closed') ?? null;
  const past = injuries.filter((i) => i.status === 'closed');

  /* Deliberately NOT `pp-injuries-card`. That class is a two-column grid,
     `minmax(0, 1fr) auto`, written for the previous card's shape: one content
     block with the "+ Log injury" button beside it. This card is an ordinary
     vertical stack of eight or so children, and inheriting that grid dealt them
     alternately into two columns — overlapping headings, and text wrapping one
     word per line. Caught by looking at the rendered card: every element's own
     computed style was correct, which is exactly the failure a style-by-style
     check cannot see. */
  return (
    <section className="card pp-card" aria-labelledby="pp-injury-title">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-10)' }}>
        <h2 className="card-title" id="pp-injury-title">
          Injury
        </h2>
        {/* Medic only, and absent rather than disabled for everyone else. The
            label depends on whether any clinical field is filled: adding the
            detail is a separate act from creating the record, which a coach may
            have done when the player went down. */}
        {canEditClinical && active ? (
          <Link href={`/injuries/${active.id}`} className="btn-ghost-pill" style={{ padding: '8px 16px' }}>
            {clinical && Object.values(clinical).some((v) => v !== null && v !== '')
              ? 'Edit'
              : 'Add clinical detail'}
          </Link>
        ) : null}
      </div>

      {!active ? (
        /* One line, nothing else. No empty-state graphic and no disabled fields:
           both would imply there is something here to reveal. */
        <p className="import-sub" style={{ margin: '4px 0 0' }}>
          No current restrictions.
        </p>
      ) : (
        <>
          <div style={{ marginTop: 'var(--sp-8)' }}>
            <span className={`pill ${STATUS_TONE[active.status] ?? 'pill-neutral'}`}>
              {enumLabel(active.status)}
            </span>
          </div>

          <p className="nm" style={{ fontSize: 'var(--fs-15)', margin: '10px 0 0' }}>
            {bodyAreaPhrase(active)}
          </p>

          {clinical ? (
            <>
              <p className="sub" style={{ margin: '6px 0 0' }}>
                Onset {formatDate(active.onset_date, timezone)}
                {/* occurred_in is the occurrence_context enum (training, match,
                    gym, other, unknown), so it goes through enumLabel like every
                    other enum on this page — raw it rendered as "· match", which
                    reads like a truncated sentence rather than a label. */}
                {active.occurred_in ? ` · ${enumLabel(active.occurred_in)}` : ''}
              </p>

              <hr className="hr" />

              <div
                className="pp-clinical-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-14)', rowGap: 'var(--sp-14)' }}
              >
                <ClinicalField label="Diagnosis" value={clinical.diagnosis} />
                <ClinicalField label="Mechanism" value={clinical.mechanism} />
                <ClinicalField label="Severity" value={clinical.severity ? enumLabel(clinical.severity) : null} />
                <ClinicalField label="Tissue type" value={clinical.tissue_type} />
              </div>

              {/* Only when one of the two exists. Referral is rendered as plain
                  text and never as a link: injury_clinical.referral is free
                  text, there is no attachments table and no document to open, so
                  a link would promise something the data model cannot hold. */}
              {clinical.imaging || clinical.referral ? (
                <p className="sub" style={{ margin: '12px 0 0' }}>
                  {clinical.imaging ? <b className="nm">Imaging: </b> : null}
                  {[clinical.imaging, clinical.referral].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              {clinical.treatment_plan || clinical.clinical_notes ? <hr className="hr" /> : null}

              {clinical.treatment_plan ? (
                <>
                  <span className="nm" style={{ display: 'block' }}>
                    Treatment plan
                  </span>
                  <p className="sub" style={{ margin: '2px 0 0' }}>
                    {clinical.treatment_plan}
                  </p>
                </>
              ) : null}

              {clinical.clinical_notes ? (
                <>
                  <span className="nm" style={{ display: 'block', marginTop: 'var(--sp-12)' }}>
                    Notes
                  </span>
                  <p className="sub" style={{ margin: '2px 0 0' }}>
                    {clinical.clinical_notes}
                  </p>
                </>
              ) : null}

              {/* RETURN TO PLAY, and the route to where it is actually done.
                  The card told a medic somebody was injured and stopped. The
                  proposal, the sign-off and the timeline all live on
                  /injuries/[id], and nothing here said so — so a medic could not
                  tell from the profile whether a programme had been proposed,
                  was running, or did not exist.

                  Deliberately a SUMMARY plus a link. No stage control, no
                  timeline, no sign-off button: that work stays on the dedicated
                  screen. "No rehab programme yet" is a state a medic acts on,
                  not an absence to render as nothing. */}
              {canEditClinical && active ? (
                <>
                  <hr className="hr" />
                  <div style={{ marginTop: 'var(--sp-12)' }}>
                    <span className="label">Rehab programme</span>
                    <p className="import-sub" style={{ margin: '4px 0 0' }}>
                      {programmeStatus === null || programmeStatus.kind === 'none' ? (
                        'No rehab programme yet.'
                      ) : programmeStatus.kind === 'proposed' ? (
                        <>
                          S&amp;C proposed: <b>{programmeStatus.name}</b>, awaiting your sign-off.
                        </>
                      ) : (
                        <>
                          Active programme: <b>{programmeStatus.name}</b>
                          {programmeStatus.week !== null
                            ? programmeStatus.totalWeeks !== null
                              ? `, week ${programmeStatus.week} of ${programmeStatus.totalWeeks}`
                              : `, week ${programmeStatus.week}`
                            : ''}
                          .
                        </>
                      )}
                    </p>
                    <Link
                      href={`/injuries/${active.id}`}
                      className="pp-link"
                      style={{ display: 'inline-block', marginTop: 'var(--sp-8)' }}
                    >
                      Manage injury &amp; programme →
                    </Link>
                  </div>
                </>
              ) : null}

              {past.length > 0 ? (
                /* Collapsed by default and native rather than stateful: a medic
                   working the current injury does not need last season taking up
                   space, and <details> keeps this a server component. */
                <details className="disclose pp-past-injuries" style={{ marginTop: 'var(--sp-14)' }}>
                  {/* The app's own disclosure pattern rather than a bespoke one:
                      .disclose already hides the native marker, puts a caret
                      AFTER the label and rotates it on open, which is what the
                      reference card shows. Two overrides in pp-past-injuries:
                      the caret sits next to the label instead of being pushed to
                      the far edge, and the label is accent-coloured, both as in
                      the reference. */}
                  <summary>Past injuries ({past.length})</summary>
                  <div className="pp-injury-list" style={{ marginTop: 'var(--sp-8)' }}>
                    {past.map((p) => (
                      <p className="sub" key={p.id} style={{ margin: '0 0 6px' }}>
                        <span className="pill pill-neutral">Closed</span>{' '}
                        <b className="nm" style={{ fontSize: 'var(--fs-13)' }}>
                          {bodyAreaPhrase(p)}
                        </b>{' '}
                        {formatDate(p.onset_date, timezone)}
                        {p.actual_return ? ` – ${formatDate(p.actual_return, timezone)}` : ''}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <>
              <p className="sub" style={{ margin: '8px 0 0' }}>
                {restrictions.length > 0
                  ? restrictions.map((r) => enumLabel(r)).join(' · ')
                  : 'No restrictions recorded.'}
              </p>
              {active.expected_return ? (
                <p className="sub" style={{ margin: '6px 0 0' }}>
                  Expected return {formatDate(active.expected_return, timezone)}
                </p>
              ) : null}
              {/* Stop. Nothing below this line for a non-medic, in any state. */}
            </>
          )}
        </>
      )}
    </section>
  );
}
