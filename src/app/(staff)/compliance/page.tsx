import { redirect } from 'next/navigation';

/** The compliance report has always lived at /reports/compliance, but the
 *  dashboard linked here for a while (a real, shipped 404 — audit finding
 *  B1). The dashboard's links now point at the real route; this redirect
 *  catches anything bookmarked or cached from the broken period. */
export default function ComplianceRedirect() {
  redirect('/reports/compliance');
}
