import { redirect } from 'next/navigation';

/** `roster` is a reserved static child of /squad, 20-route-map.md §2.1 rule 6.
 *  It exists as a file so the dynamic [athleteId] sibling can never match it.
 *  Phase 1a renders the roster on /squad itself. */
export default function RosterPage() {
  redirect('/squad');
}
