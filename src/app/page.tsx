import { redirect } from 'next/navigation';

/** The middleware sends a signed-in user to their own shell before this runs.
 *  Anyone reaching here has no session. */
export default function RootPage() {
  redirect('/login');
}
