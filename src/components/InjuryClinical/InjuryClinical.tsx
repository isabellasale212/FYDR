/* The athlete's own diagnosis and mechanism, in one block under the banner.
 *
 * WHY IT IS NOT A LINE INSIDE AvailabilityBanner. The banner is asserted
 * clinical-free — test-availability-banner checks it never mentions diagnosis,
 * mechanism, severity, imaging, referral, treatment_plan or clinical_notes — and
 * that assertion is worth keeping now rather than spending. Availability is a
 * squad fact a coach also sees; a diagnosis is a clinical one that only this
 * athlete and the medical staff see. Two different disclosure rules reaching the
 * same screen is exactly when it is worth keeping them in two components, so
 * that widening one cannot silently widen the other.
 *
 * THE PLACEMENT IS THE ONE THAT WAS APPROVED. This sits where the temporary
 * preview sat, because that is the arrangement Isabella looked at on a real
 * record before confirming the scope. What is gone is the Preview pill and the
 * local-only caveat; the position and the single line of text are unchanged.
 *
 * TWO FIELDS, EACH CONFIRMED SEPARATELY, and each guarded separately here. A
 * record can carry a mechanism with no diagnosis or the reverse, and Viliami
 * Tameifuna has an open injury with no clinical row at all — so "both present"
 * is not the only real state and a single guard around the pair would hide a
 * field that exists. Severity, tissue type, imaging, referral and treatment plan
 * have no props: adding one is the change that should be reviewed, rather than a
 * conditional inside a component that already accepts it.
 */

type Props = {
  /** Both null when there is no clinical record, no injury, or the reader is
   *  under 18 — which are indistinguishable to this component, and should be: it
   *  renders nothing in every one of those cases rather than explaining which
   *  applies. An athlete told "this is withheld from you" learns the thing being
   *  withheld exists, which for a minor is the disclosure the gate prevents. */
  diagnosis: string | null;
  mechanism: string | null;
};

export function InjuryClinical({ diagnosis, mechanism }: Props) {
  if (!diagnosis && !mechanism) return null;

  /* Existing classes only, and the same ones the preview carried, because the
     design is frozen and this arrangement is the one that was approved on
     screen. `.banner` is a flex row with the card's own padding; `.label` is the
     muted 12.5px used for exactly this above a value; `.nm` the bold value;
     `.sub` the muted note. No new CSS, no new type scale. */
  return (
    <div className="banner" role="note">
      <div style={{ flex: 1, minWidth: 0 }}>
        {diagnosis ? (
          <>
            <span className="label">Diagnosis</span>
            <div className="nm">{diagnosis}</div>
          </>
        ) : null}
        {mechanism ? (
          <div style={{ marginTop: diagnosis ? 10 : 0 }}>
            <span className="label">How it happened</span>
            <div className="nm">{mechanism}</div>
          </div>
        ) : null}
        <div className="sub" style={{ marginTop: 6 }}>
          Recorded by your medical staff. Speak to them about anything here.
        </div>
      </div>
    </div>
  );
}
