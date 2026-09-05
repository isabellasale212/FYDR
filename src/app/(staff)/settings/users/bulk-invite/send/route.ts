import { randomBytes, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/session';
import { MAX_BULK_INVITE_ROWS, type BulkInviteResult, type BulkInviteSendRow } from '@/lib/queries/bulkInvite';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

/** docs/screens/user-management.md's "Bulk invite": up to 100 rows in one
 *  submission, each creating a real athlete account the same way a single
 *  invite does (settings/users/create/route.ts) — this route is that same
 *  logic run in a loop, not a second implementation of it, with one
 *  addition: a row with no matching unlinked athlete record creates one
 *  first (athletes_manage_insert already grants admin/coach insert on
 *  athletes, migration 0012 — no new RLS needed for that part).
 *
 *  Runs synchronously in one request, same reduced-scope reasoning as
 *  every other bulk/async-shaped feature in this build: no worker queue
 *  exists, and 100 rows of sequential auth.admin.createUser calls is a
 *  bounded, acceptable wait for the admin doing this rarely, not a page
 *  load. "Partial success is reported honestly" per the spec — a row that
 *  fails does not stop the rest, and the response is a full per-row
 *  result list, never a single pass/fail for the whole batch. */
export async function POST(request: Request) {
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ error: 'Admin access only.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const inputRows: unknown = body?.rows;
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return NextResponse.json({ error: 'No rows to send.' }, { status: 400 });
  }
  if (inputRows.length > MAX_BULK_INVITE_ROWS) {
    return NextResponse.json({ error: `Invite up to ${MAX_BULK_INVITE_ROWS} people at a time.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: BulkInviteResult[] = [];
  const createdUserIds: string[] = [];

  for (const raw of inputRows as BulkInviteSendRow[]) {
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
    const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
    const squadNumber = typeof raw.squadNumber === 'number' ? raw.squadNumber : null;
    const dateOfBirth = typeof raw.dateOfBirth === 'string' ? raw.dateOfBirth : null;
    const linkAthleteId = typeof raw.athleteId === 'string' ? raw.athleteId : null;

    if (!EMAIL_RE.test(email) || !firstName || !lastName || !dateOfBirth) {
      results.push({ email: email || '(no email)', ok: false, error: 'Invalid row.', temporaryPassword: null });
      continue;
    }

    // Resolve the athlete record first: an existing unlinked one to link,
    // or a brand new one — either way this must succeed before the auth
    // account is created, so a failure here never leaves an orphaned
    // sign-in with nothing behind it. date_of_birth is set on a new
    // record directly; an existing one only gets it if it doesn't already
    // have one — athletes_dob_required_when_linked (found live testing
    // this route, see bulkInvite.ts's own header) needs one or the other
    // either way, but a real existing value is never overwritten by a
    // bulk-invite row that was only ever meant to unblock activation.
    let athleteId = linkAthleteId;
    if (!athleteId) {
      const { data: newAthlete, error: athleteErr } = await db
        .from('athletes')
        .insert({ org_id: orgId, first_name: firstName, last_name: lastName, squad_number: squadNumber, date_of_birth: dateOfBirth, status: 'active' })
        .select('id')
        .single();
      if (athleteErr) {
        results.push({ email, ok: false, error: `Could not create an athlete record: ${athleteErr.message}`, temporaryPassword: null });
        continue;
      }
      athleteId = newAthlete.id;
    } else {
      const { data: existing, error: existingErr } = await db.from('athletes').select('date_of_birth').eq('org_id', orgId).eq('id', athleteId).single();
      if (existingErr) {
        results.push({ email, ok: false, error: `Could not read the matched athlete record: ${existingErr.message}`, temporaryPassword: null });
        continue;
      }
      if (!existing.date_of_birth) {
        const { error: dobErr } = await db.from('athletes').update({ date_of_birth: dateOfBirth }).eq('org_id', orgId).eq('id', athleteId);
        if (dobErr) {
          results.push({ email, ok: false, error: `Could not set date of birth on the matched record: ${dobErr.message}`, temporaryPassword: null });
          continue;
        }
      }
    }

    const newUserId = randomUUID();
    const { error: insertErr } = await db.from('users').insert({ id: newUserId, org_id: orgId, email, full_name: `${firstName} ${lastName}`, status: 'active' });
    if (insertErr) {
      const message = /duplicate key|already exists/i.test(insertErr.message) ? 'That email is already registered in this club.' : insertErr.message;
      results.push({ email, ok: false, error: message, temporaryPassword: null });
      continue;
    }

    const temporaryPassword = generateTemporaryPassword();
    const authResult = await admin.auth.admin.createUser({
      id: newUserId,
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName}` },
    });
    if (authResult.error) {
      await db.from('users').delete().eq('id', newUserId);
      const message = /already been registered|already exists/i.test(authResult.error.message) ? 'That email is already registered on this project.' : authResult.error.message;
      results.push({ email, ok: false, error: message, temporaryPassword: null });
      continue;
    }

    const { error: rolesErr } = await db.from('user_roles').insert({ org_id: orgId, user_id: newUserId, role: 'athlete', granted_by: claims.userId });
    if (rolesErr) {
      results.push({ email, ok: false, error: `Account created but the athlete role failed to save: ${rolesErr.message}. Fix roles from the user list.`, temporaryPassword });
      createdUserIds.push(newUserId);
      continue;
    }

    const { error: linkErr } = await db.from('athletes').update({ user_id: newUserId }).eq('org_id', orgId).eq('id', athleteId).is('user_id', null);
    if (linkErr) {
      results.push({ email, ok: false, error: `Account created but linking the athlete record failed: ${linkErr.message}.`, temporaryPassword });
      createdUserIds.push(newUserId);
      continue;
    }

    createdUserIds.push(newUserId);
    results.push({ email, ok: true, error: null, temporaryPassword });
  }

  const succeeded = results.filter((r) => r.ok).length;
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: 'sport_scientist',
    action: 'user.bulk_invite',
    entity_type: 'user',
    entity_id: null,
    metadata: { attempted: results.length, succeeded, failed: results.length - succeeded, user_ids: createdUserIds },
  });

  return NextResponse.json({ results });
}
