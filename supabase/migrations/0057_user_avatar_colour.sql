-- ---------------------------------------------------------------------------
-- 0057_user_avatar_colour
--
-- users.avatar_colour — the colour an athlete picks for their initials glyph
-- when they have not uploaded a photo.
--
-- The club asked to "allow them to edit their initials with different colours
-- and backgrounds" alongside photo upload. Stored rather than kept in the
-- browser because an avatar is identity, not a per-device display preference:
-- the same glyph renders on Me, on Today, and anywhere staff see the athlete,
-- and those should agree.
--
-- Stores the colour NAME, never a hex. Identical convention to groups.colour
-- (0002) — the name resolves to the light/dark --group-* token pair in
-- tokens.css at render time, so a value written today still themes correctly
-- if the palette is retuned later, and no component ever paints a raw hex
-- (CLAUDE.md's styling rule). Reuses the group palette deliberately rather
-- than introducing a second, parallel set of colour names.
--
-- No new policy or grant is needed and none is added: migration 0012 already
-- carries `grant select, insert, update on public.users to authenticated`
-- together with users_self_update (`using`/`with check` both pinned to
-- `id = auth_user_id()` and the caller's own org), which is exactly the
-- reach this column wants — an athlete sets their own, and nobody else's.
-- That is the same path users.avatar_url already travels (0030).
--
-- Nullable with no default: null means "no choice made", which is a real
-- answer and renders as the existing neutral glyph, not a colour picked on
-- the athlete's behalf.
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists avatar_colour text;

comment on column public.users.avatar_colour is
  'Colour NAME for the initials glyph when no avatar_url is set, e.g. ''Blue''. '
  'Resolved to the --group-* token pair at render time, never stored as a hex. '
  'Same convention as groups.colour. Null means the athlete has not chosen one. '
  'Written by the athlete themselves via users_self_update (0012); no separate '
  'policy is required.';
