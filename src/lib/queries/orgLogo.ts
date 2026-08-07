import type { Db } from './groups';

/* migration 0031's own header covers the schema and policy decisions. This
 * file is the thin query layer on top of the real Storage API, the same
 * shape as lib/queries/avatar.ts — validate, upload with upsert (one logo
 * per club, always at the same path, a re-upload replaces), cache-bust the
 * public URL, write the row. The one real difference from avatar.ts: there
 * is no per-user id in the path, because a logo belongs to the
 * organisation, not to whoever happens to be the admin uploading it. */

const MAX_BYTES = 2 * 1024 * 1024; // matches storage.buckets.file_size_limit for 'logos', migration 0031
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > MAX_BYTES) return `That file is too large — ${Math.round(MAX_BYTES / 1024 / 1024)}MB maximum.`;
  return null;
}

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadOrgLogo(db: Db, orgId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateLogoFile(file);
  if (invalid) return { url: null, error: invalid };

  const path = `${orgId}/logo.${extensionFor(file)}`;
  const { error: uploadErr } = await db.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { url: null, error: uploadErr.message };

  const {
    data: { publicUrl },
  } = db.storage.from('logos').getPublicUrl(path);
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await db.from('organisations').update({ logo_url: bustedUrl }).eq('id', orgId);
  if (dbErr) return { url: null, error: dbErr.message };

  return { url: bustedUrl, error: null };
}

export async function removeOrgLogo(db: Db, orgId: string, currentUrl: string): Promise<{ error: string | null }> {
  const match = currentUrl.match(/logo\.(jpg|png|webp)/);
  const ext = match?.[1] ?? 'jpg';
  const path = `${orgId}/logo.${ext}`;

  const { error: removeErr } = await db.storage.from('logos').remove([path]);
  if (removeErr) return { error: removeErr.message };

  const { error: dbErr } = await db.from('organisations').update({ logo_url: null }).eq('id', orgId);
  return { error: dbErr?.message ?? null };
}
