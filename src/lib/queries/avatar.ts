import type { Db } from './groups';

/* screens/settings.md's Profile section names "avatar" alongside display
 * name and phone as something a user edits themselves. Every earlier
 * profile-editing file this build shipped (profile.ts, both edit forms)
 * named avatar upload as the one field left out, for the same real reason:
 * no Storage bucket existed. Migration 0030 is that bucket, plus the RLS
 * that lets a user write only their own path; this file is the thin query
 * layer on top of the real Storage API, not a second write path — there
 * is no server-role client here, deliberately, because there doesn't need
 * to be one: unlike account creation (which needs auth.admin, a
 * service-role-only surface), an authenticated user uploading their own
 * file is exactly what Storage's own RLS is for.
 *
 * One file per user, always at the same path — {org_id}/{user_id}/avatar.*
 * — uploaded with upsert: true, so a re-upload replaces rather than
 * accumulates. A user with more than one photo in Storage was never a
 * real requirement; "their current avatar" is a single, replaceable
 * value, matching the single avatar_url column it's stored against. */

const MAX_BYTES = 2 * 1024 * 1024; // matches storage.buckets.file_size_limit for 'avatars', migration 0030
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > MAX_BYTES) return `That file is too large — ${Math.round(MAX_BYTES / 1024 / 1024)}MB maximum.`;
  return null;
}

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadMyAvatar(db: Db, orgId: string, userId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateAvatarFile(file);
  if (invalid) return { url: null, error: invalid };

  const path = `${orgId}/${userId}/avatar.${extensionFor(file)}`;
  const { error: uploadErr } = await db.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { url: null, error: uploadErr.message };

  const {
    data: { publicUrl },
  } = db.storage.from('avatars').getPublicUrl(path);
  // A cache-busting query param — the path never changes on a re-upload
  // (upsert, by design), so without this the browser and any CDN in front
  // of Storage would keep serving the old image under the same URL.
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await db.from('users').update({ avatar_url: bustedUrl }).eq('id', userId);
  if (dbErr) return { url: null, error: dbErr.message };

  return { url: bustedUrl, error: null };
}

export async function removeMyAvatar(db: Db, orgId: string, userId: string, currentUrl: string): Promise<{ error: string | null }> {
  // The extension is whatever's in the stored URL's path, not guessed —
  // upload always uses one of exactly three, so this recovers the same one.
  const match = currentUrl.match(/avatar\.(jpg|png|webp)/);
  const ext = match?.[1] ?? 'jpg';
  const path = `${orgId}/${userId}/avatar.${ext}`;

  const { error: removeErr } = await db.storage.from('avatars').remove([path]);
  if (removeErr) return { error: removeErr.message };

  const { error: dbErr } = await db.from('users').update({ avatar_url: null }).eq('id', userId);
  return { error: dbErr?.message ?? null };
}
