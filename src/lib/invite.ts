import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Issuing an invite, the one way this app creates a sign-in.
 *
 *  Build handoff step 2: "No password is ever generated, emailed, or shown on
 *  screen, on either path." Both creation paths, single and bulk, call this and
 *  nothing else, so there is one place where that promise is kept or broken.
 *
 *  WHAT REPLACED WHAT. Both routes used to call
 *  auth.admin.createUser({ password }) with twelve random bytes, return the
 *  password in the response, and print it on screen for the administrator to
 *  read out. Three things were wrong with that beyond the obvious. The password
 *  travelled through a JSON response and a React tree, so it existed in more
 *  places than the person who would use it. It confirmed the address without
 *  ever proving the recipient could read it, because `email_confirm: true` was
 *  passed by the same code that invented the credential. And the person's first
 *  act on the system was to type a secret somebody else chose.
 *
 *  generateLink({ type: 'invite' }) creates the auth user with NO password at
 *  all and returns a single-use token. Following it proves the recipient reads
 *  that inbox, signs them in, and lands them on a page where they choose their
 *  own password: the address is confirmed by the same act that sets the
 *  credential, which is the "in one step" the handoff asks for.
 *
 *  THE LINK IS NOT A PASSWORD, and the difference is why returning it is not a
 *  reintroduction of the thing being removed. It expires, it works once, it
 *  proves possession of the inbox, and it sets nothing by itself. It is
 *  returned to the administrator because the email cannot yet be relied on to
 *  arrive. That reason has changed since this was written and the conclusion has
 *  not: RESEND_API_KEY now exists in Vercel production and a real invite has
 *  gone through it (audit_log, provider: resend, delivered: true), and fydr.app
 *  was verified in Resend on 2026-09-09. The link is still returned because
 *  delivery is not guaranteed in every environment — local and preview hold no
 *  key at all and take the logged no-op — and because a recipient on a reserved
 *  domain is refused before any request is made, which covers all 46 seed
 *  accounts. Whether a given deployment can reach a real inbox depends on
 *  EMAIL_FROM_ADDRESS, which lives in Vercel and is not named here: pinning that
 *  value in a comment is exactly how the claim above it went stale.
 *
 *  ORDERING. The auth user is created first here, and the caller writes its own
 *  users row afterwards using the id this returns. That is the reverse of what
 *  the routes used to do, and it is deliberate: generateLink assigns the id, so
 *  a row cannot be written against an id that does not exist yet. Callers roll
 *  back by deleting the auth user, which is why deleteInvitedUser exists. */

export type IssuedInvite = {
  userId: string;
  inviteUrl: string;
};

/** Why an invite could not be issued.
 *
 *  'already_registered' is separated from everything else because it is not a
 *  fault: it is an athlete who already has a Fydr account, which today means one
 *  transferring from another club on the platform. Screen 63 has to say
 *  something quite different about that than about a genuine failure, and a
 *  caller matching on the wording of an error message would break the first time
 *  somebody improved the sentence. */
export type InviteFailureReason = 'already_registered' | 'failed';

export type InviteResult =
  | { ok: true; invite: IssuedInvite }
  | { ok: false; error: string; reason: InviteFailureReason };

/** Where the recipient is sent once the token is verified. A query flag rather
 *  than a separate screen: the page's own copy already reads "Choose a new
 *  password. You will be signed in as soon as it is set", which is true of an
 *  invite word for word, and the design is frozen. */
const LANDING = '/login/reset/confirm?invite=1';

export async function issueInvite(
  admin: SupabaseClient,
  email: string,
  fullName: string,
  origin: string,
): Promise<InviteResult> {
  const redirectTo = new URL(LANDING, origin).toString();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName }, redirectTo },
  });

  if (error) {
    const alreadyRegistered = /already been registered|already exists|User already/i.test(error.message);
    return alreadyRegistered
      ? { ok: false, reason: 'already_registered', error: 'That email already belongs to a Fydr account.' }
      : { ok: false, reason: 'failed', error: error.message };
  }

  const userId = data?.user?.id;
  const tokenHash = data?.properties?.hashed_token;
  if (!userId || !tokenHash) {
    /* Never seen, but the alternative is returning a link that verifies
       nothing and reads as a working invite. */
    return { ok: false, reason: 'failed', error: 'The invite link could not be issued. Nothing was created.' };
  }

  /* Built against this app's own /auth/confirm rather than using
     properties.action_link. The action_link points at Supabase's verify
     endpoint, which redirects with a PKCE code, and a code is only exchangeable
     in the browser that requested it — never true of an invite somebody else
     generated. /auth/confirm verifies the token_hash server side instead, which
     has no such constraint. See that route's header. */
  const url = new URL('/auth/confirm', origin);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'invite');
  url.searchParams.set('next', LANDING);

  return { ok: true, invite: { userId, inviteUrl: url.toString() } };
}

/** Undo an issued invite when a later step of the same request fails.
 *
 *  Only ever called against a user this same request created seconds earlier,
 *  which is cancelling a half-finished creation rather than deleting anybody's
 *  data. CLAUDE.md rule 4 is about athlete records and their history; this is an
 *  auth row with nothing attached to it yet. */
export async function deleteInvitedUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
