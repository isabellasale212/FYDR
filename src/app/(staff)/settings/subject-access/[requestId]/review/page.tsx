import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ClinicalReviewForm } from '@/components/ClinicalReviewForm/ClinicalReviewForm';
import { fetchInjuriesForReview, fetchSarRequest } from '@/lib/queries/sarPack';
import { requireStaff } from '@/lib/session';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Clinical review · Fydr' };

/** 09-security-and-compliance.md §6: "the SAR pack generation must route
 *  through the medical role" — this is that route. Medical only, not
 *  admin: the whole reason this step exists is that admin does not, and
 *  should not, read clinical detail directly (01-roles-and-permissions.md (superseded)
 *  §1). An admin who lands here via a stale link is turned away the same
 *  way requireReportAccess turns an admin away from a report, just the
 *  opposite role. */
export default async function ClinicalReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!hasAnyRole(claims.roles, CLINICAL_ONLY)) redirect('/settings/subject-access?e=no-sar-access');

  const request = await fetchSarRequest(db, orgId, requestId);
  if (!request) notFound();

  const injuries = await fetchInjuriesForReview(db, orgId, request.athlete_id, requestId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/subject-access">Subject access requests</Link> · Clinical review
          </p>
          <h1>
            {request.athlete_first_name} {request.athlete_last_name}
          </h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 14 }}>
        Every clinical record is included by default. Withholding one is the exception, requires a reason, and applies
        the Data Protection Act 2018 Schedule 3 Part 2 serious-harm test — disclosure would be likely to cause serious
        harm to this athlete or someone else&apos;s physical or mental health. The pack cannot be released until every
        record below has a decision.
      </p>

      {injuries.length === 0 ? (
        // Deadlock fix: this used to be the only thing rendered here, with
        // no way to actually reach 'reviewed' — release/route.ts refuses
        // to release until status is 'reviewed', and markRequestReviewed
        // was only ever called from the form below, which didn't render at
        // all when there was nothing to review. The form still renders now
        // (see its own header comment for the confirm button that unblocks
        // this).
        <p className="cap">This athlete has no clinical records — nothing to review. Confirm below to make the pack ready to release.</p>
      ) : null}
      <ClinicalReviewForm orgId={orgId} requestId={requestId} injuries={injuries} timezone={timezone} />
    </>
  );
}
