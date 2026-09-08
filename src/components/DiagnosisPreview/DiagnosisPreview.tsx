/* TEMPORARY. Delete this file once the Tier 2 decision is made.
 *
 * A separate component rather than a line inside AvailabilityBanner, and that is
 * the point of it. The banner is asserted clinical-free — test-availability-
 * banner checks it never mentions diagnosis, mechanism, severity, imaging,
 * referral, treatment_plan or clinical_notes — and that assertion is the
 * boundary Tier 2 will deliberately move. Putting the preview inside the banner
 * would have meant weakening the assertion to build a thing that is explicitly
 * not yet approved, and then remembering to restore it. Here the boundary stays
 * where it is and this sits outside it, in one file that can be deleted whole.
 *
 * Marked as a preview on screen for the same reason: whoever is looking at it
 * should never be in doubt that they are looking at something switched on for
 * them, not at what a player sees.
 */

type Props = {
  /** Already fetched behind the gate. Null means no diagnosis, no injury, or —
   *  most often — that the preview is off, which is the normal state. */
  diagnosis: string | null;
};

export function DiagnosisPreview({ diagnosis }: Props) {
  if (!diagnosis) return null;

  return (
    <div className="banner" role="note">
      <span className="pill pill-neutral">Preview</span>{' '}
      <span className="nm">{diagnosis}</span>{' '}
      <span className="sub">
        Local only. Not visible to any athlete, and not part of the app until the Tier 2
        decision is made.
      </span>
    </div>
  );
}
