import { redirect } from 'next/navigation';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';
import { sendGuardianLink } from '@/lib/guardianConsent';
import { mustAffect } from '@/lib/write';
import { CONSENT_VERSION } from '@/lib/legalPlaceholders';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** PATTERN-S9 artboard 4, the staff side (not drawn; needed): for an athlete
 *  under 18, the sport scientist records or corrects the guardian the club
 *  holds, sends the consent link, or records a decision the guardian gave
 *  offline — the other route Isabella kept, as one value of
 *  parental_consent_method (club_registration_form, written_confirmation,
 *  in_person) with recorded_by naming the staff member. Three actions, one
 *  form post each, every one audited. */
export async function POST(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) redirect(`/squad/${athleteId}?guardian=refused`);
  const form = await request.formData();
  const action = form.get('action');
  const back = (q: string) => redirect(`/squad/${athleteId}?guardian=${q}`);

  const { data: athlete } = await db.from('athletes').select('id, first_name, date_of_birth, guardian_name, guardian_email').eq('org_id', orgId).eq('id', athleteId).maybeSingle();
  if (!athlete) back('missing');

  if (action === 'save') {
    const name = String(form.get('guardianName') ?? '').trim();
    const email = String(form.get('guardianEmail') ?? '').trim().toLowerCase();
    if (!name || !EMAIL_RE.test(email)) back('invalid');
    const wrote = await mustAffect(db.from('athletes').update({ guardian_name: name, guardian_email: email }).eq('org_id', orgId).eq('id', athleteId).select('id'), {
      refusal: 'Not saved: the guardian belongs to the sport scientist.',
    });
    if (wrote.error) back('failed');
    await db.from('audit_log').insert({ org_id: orgId, actor_id: claims.userId, actor_role: 'sport_scientist', action: 'athlete.guardian_recorded', entity_type: 'athlete', entity_id: athleteId, athlete_id: athleteId, metadata: { guardian_name: name } });
    back('saved');
  }

  if (action === 'send') {
    const origin = new URL(request.url).origin;
    const result = await sendGuardianLink(db, { orgId, athleteId, athleteFirstName: athlete!.first_name, clubName: orgName, actorId: claims.userId, actorRole: 'sport_scientist', origin, timezone });
    back(result.ok ? 'sent' : result.reason);
  }

  if (action === 'record') {
    const method = String(form.get('method') ?? '');
    const decision = String(form.get('decision') ?? '');
    if (!['club_registration_form', 'written_confirmation', 'in_person'].includes(method) || !['agree', 'decline'].includes(decision)) back('invalid');
    const now = new Date().toISOString();
    const patch =
      decision === 'agree'
        ? { consent_given_at: now, consent_version: CONSENT_VERSION, consent_declined_at: null, consent_withdrawn_at: null, health_consent_given_at: now, health_consent_version: CONSENT_VERSION, health_consent_declined_at: null, health_consent_withdrawn_at: null }
        : { consent_declined_at: now, consent_version: CONSENT_VERSION, health_consent_declined_at: now, health_consent_version: CONSENT_VERSION };
    const wrote = await mustAffect(
      db
        .from('athletes')
        .update({ ...patch, parental_consent_recorded_at: now, parental_consent_recorded_by: claims.userId, parental_consent_method: method as 'club_registration_form' | 'written_confirmation' | 'in_person' })
        .eq('org_id', orgId)
        .eq('id', athleteId)
        .select('id'),
      { refusal: 'Not saved: recording a guardian’s decision belongs to the sport scientist.' },
    );
    if (wrote.error) back('failed');
    await db.from('audit_log').insert({
      org_id: orgId,
      actor_id: claims.userId,
      actor_role: 'sport_scientist',
      action: decision === 'agree' ? 'guardian_consent.recorded_offline_agreed' : 'guardian_consent.recorded_offline_declined',
      entity_type: 'athlete',
      entity_id: athleteId,
      athlete_id: athleteId,
      metadata: { method, version: CONSENT_VERSION, by: 'club', guardian_name: athlete!.guardian_name },
    });
    back('recorded');
  }

  back('invalid');
}
