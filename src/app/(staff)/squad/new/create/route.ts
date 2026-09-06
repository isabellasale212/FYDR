import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { createAthlete } from '@/lib/queries/squad';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueInvite, deleteInvitedUser } from '@/lib/invite';

/** Screen 63's write. The only place this app creates an athlete.
 *
 *  ORDERING, and it is the reverse of the staff-invite route's on purpose. There,
 *  generateLink assigns the id, so the auth user must exist before the users row
 *  can reference it. Here the ATHLETE is the record that must exist first: it is
 *  the thing the club actually asked for, it stands on its own with no account
 *  behind it (the spec's "no email given, saves normally"), and an invite that
 *  fails must not take the roster entry down with it.
 *
 *  So a failed invite leaves an athlete with no app access and says so, which is
 *  a state the product already has a name for and a way out of: invite them
 *  later from their profile. The alternative -- rolling the athlete back because
 *  an email bounced -- would throw away the part that worked.
 *
 *  TRANSFERS, screen 63's open issue, DECIDED 2026-09-06: a fresh record, no
 *  link. An athlete arriving from another club on the platform gets this club's
 *  own squad record, and their existing Fydr account is not attached to it.
 *
 *  This is reported as its own OUTCOME rather than as a failed invite, because
 *  it is neither a failure nor something the person can fix by retrying. The
 *  record they asked for exists; what did not happen is an account, and the
 *  reason is a rule rather than a fault. Saying "the invite could not be sent"
 *  would send somebody to check a mail provider that is working perfectly.
 *
 *  Why not link the two: athletes.user_id is UNIQUE, so one account cannot
 *  belong to two athlete records. Changing that is schema work with a design
 *  pass of its own -- every query that assumes one athlete per account has to be
 *  revisited -- and it is not a decision that should ride on a form. Deferred
 *  deliberately, not overlooked. */
export async function POST(request: Request): Promise<NextResponse> {
  const { db, orgId, claims } = await requireStaff();

  /* The same set that gates Club details and Users. Screen 63 §2: an
     administration action, not a coaching one. The database agrees since 0077,
     so this is the tidiness and athletes_manage_insert is the authorisation. */
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json(
      { ok: false, error: 'Adding an athlete belongs to the sport scientist.', athleteId: null, inviteUrl: null },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '';
  const position = typeof body.position === 'string' && body.position ? body.position : null;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const squadNumberRaw = body.squadNumber;
  const squadNumber =
    squadNumberRaw === null || squadNumberRaw === undefined || squadNumberRaw === ''
      ? null
      : Number(squadNumberRaw);

  const bad = (error: string) =>
    NextResponse.json({ ok: false, error, athleteId: null, inviteUrl: null }, { status: 400 });

  if (!firstName || !lastName) return bad('Enter the athlete’s full name.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return bad('Enter a date of birth.');
  if (squadNumber !== null && (!Number.isInteger(squadNumber) || squadNumber < 0 || squadNumber > 999)) {
    return bad('A squad number is a whole number between 0 and 999.');
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('Enter a valid email address, or leave it blank.');

  const created = await createAthlete(db, orgId, {
    firstName,
    lastName,
    dateOfBirth,
    position,
    squadNumber,
  });
  if (!created.ok) return bad(created.error);

  if (!email) {
    return NextResponse.json({ ok: true, athleteId: created.athleteId, inviteUrl: null, outcome: 'created', error: null });
  }

  const admin = createAdminClient();
  const invited = await issueInvite(admin, email, `${firstName} ${lastName}`, new URL(request.url).origin);
  if (!invited.ok) {
    if (invited.reason === 'already_registered') {
      return NextResponse.json(
        {
          ok: true,
          athleteId: created.athleteId,
          inviteUrl: null,
          outcome: 'squad_record_only',
          existingAccountEmail: email,
          error: null,
        },
        { status: 200 },
      );
    }
    /* A real failure, and distinct from the above on purpose: this one somebody
       can act on. The athlete still stands. */
    return NextResponse.json(
      {
        ok: true,
        athleteId: created.athleteId,
        inviteUrl: null,
        outcome: 'invite_failed',
        error: `${firstName} was added to the squad, but the invite could not be sent: ${invited.error} Invite them from their profile once that is sorted.`,
      },
      { status: 200 },
    );
  }

  const { userId, inviteUrl } = invited.invite;

  const { error: userErr } = await db
    .from('users')
    .insert({ id: userId, org_id: orgId, email, full_name: `${firstName} ${lastName}`, status: 'active' });
  if (userErr) {
    await deleteInvitedUser(admin, userId);
    return NextResponse.json(
      {
        ok: true,
        athleteId: created.athleteId,
        inviteUrl: null,
        error: `${firstName} was added to the squad, but the app account could not be created: ${userErr.message} Invite them from their profile.`,
      },
      { status: 200 },
    );
  }

  const { error: roleErr } = await db
    .from('user_roles')
    .insert({ org_id: orgId, user_id: userId, role: 'athlete', granted_by: claims.userId });
  if (roleErr) {
    return NextResponse.json(
      {
        ok: true,
        athleteId: created.athleteId,
        inviteUrl,
        error: `${firstName} was added and invited, but the athlete role failed to save: ${roleErr.message} Set it from the user list.`,
      },
      { status: 200 },
    );
  }

  /* The link. `.is('user_id', null)` matches only an unlinked record and this
     record was created seconds ago by this same request, so zero rows here is a
     refusal rather than the ambiguity linkAthleteToUser has to disentangle. */
  const { data: linked } = await db
    .from('athletes')
    .update({ user_id: userId })
    .eq('org_id', orgId)
    .eq('id', created.athleteId)
    .is('user_id', null)
    .select('id');
  if (!linked || linked.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        athleteId: created.athleteId,
        inviteUrl,
        error: `${firstName} was added and invited, but the account could not be linked to the squad record. Link it from their profile.`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, athleteId: created.athleteId, inviteUrl, outcome: 'invited', error: null });
}
