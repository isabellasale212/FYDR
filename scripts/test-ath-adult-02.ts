/* ATH-ADULT-02, Land on Today and read what is outstanding — built from the
 * approved V2 board (docs/designs/ath-adult-02-final/) on this system's
 * tokens, under the decisions Isabella gave on 2026-09-11.
 *
 * THE RULES THIS PINS, each with the decision it came from:
 *
 *   RPE 1. A rating is due at end + 30 minutes, from ONE rule (lib/rpeDue.ts)
 *          that Today's list and the RPE screen both read, so a row appears
 *          exactly when the screen will accept it. Before this, the row was
 *          listed from midnight and the screen said "Not quite yet".
 *   RPE 2. A session stays listed until the end of the FOLLOWING day, club
 *          time — the window the staff dashboard's "RPE, yesterday" track
 *          already uses. Oldest first.
 *   RPE 3. The row reads "Rate {session name}", and so does the RPE screen's
 *          heading — the exact-name guard (test-control-names-resolve.ts)
 *          now compares the two as templates.
 *   S1     The week strip and "Working towards" stay, below To do.
 *   S2     Availability sits below the day's sessions; when Modified or
 *          Unavailable a one-line banner above To do links down to it.
 *   S3     The diagnosis block stays a separate component, after the card.
 *   S4     The availability card is the tone-family card: fill, border and
 *          text from one family, no ring; every word on it at the
 *          *-pill-text token, measured here at 4.5:1 or better in both
 *          themes from tokens.css itself.
 *   S5     Nothing on a session row claims to know who is in it.
 *   B-f    "45 sec" and "about 10 sec" are in binding specs
 *          (00-product-overview §198, 08-notifications §… "under 10
 *          seconds"); "20 sec" is only in a legacy document, so it is NOT
 *          shipped — pinned as an absence until Isabella decides.
 */
import { readFileSync } from 'node:fs';
import { DUE_DELAY_MIN, rpeClosesAt, rpeDueAt, rpeIsClosed, rpeIsDue, sessionEndsAt } from '@/lib/rpeDue';
import { availabilityLine, outstandingRpe, rpeRowName, rpeWhen, sessionMeta } from '@/lib/todayRows';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const page = strip(read('src/app/(athlete)/today/page.tsx'));
const rpePage = strip(read('src/app/(athlete)/rpe/[sessionId]/page.tsx'));
const compliance = strip(read('src/lib/queries/compliance.ts'));
const banner = strip(read('src/components/AvailabilityBanner/AvailabilityBanner.tsx'));
const css = strip(read('src/styles/base.css'));
const TZ = 'Europe/London';
const t = (iso: string): number => new Date(iso).getTime();

console.log('RPE 1. one due rule, end + 30, read by both screens');
{
  const s = { starts_at: '2026-09-10T09:00:00+01:00', duration_min: 45 };
  assert(DUE_DELAY_MIN === 30, 'the delay is thirty minutes, as the RPE screen has always had it');
  assert(sessionEndsAt(s) === t('2026-09-10T09:45:00+01:00'), 'a 10:00 session of 45 minutes ends 10:45');
  assert(rpeDueAt(s) === t('2026-09-10T10:15:00+01:00'), 'and its rating is due at 10:15');
  assert(!rpeIsDue(s, t('2026-09-10T10:14:59+01:00')) && rpeIsDue(s, t('2026-09-10T10:15:00+01:00')), 'not a second before');
  assert(!rpeIsDue(s, t('2026-09-10T08:00:00+01:00')), 'and certainly not before it starts — the state the brief called out');
  const noDuration = { starts_at: '2026-09-10T09:00:00+01:00', duration_min: null };
  assert(rpeDueAt(noDuration) === t('2026-09-10T09:30:00+01:00'), 'no duration: due thirty minutes after the start');
  assert(/from '@\/lib\/rpeDue'/.test(rpePage) && /rpeDueAt\(/.test(rpePage) && !/const DUE_DELAY_MIN = 30/.test(rpePage), 'the RPE screen reads the shared rule and no longer carries its own constant');
  assert(/from '@\/lib\/todayRows'/.test(compliance) && /outstandingRpe\(/.test(compliance), 'and Today\'s list is built through outstandingRpe');
}

console.log('\nRPE 2. carry-over until the end of the following day, oldest first');
{
  const now = t('2026-09-11T11:19:00+01:00');
  const yesterday = { id: 'y', title: 'Contact prep', starts_at: '2026-09-10T09:30:00+01:00', duration_min: 80, entry_date: '2026-09-10' };
  const morning = { id: 'm', title: "Captain's run", starts_at: '2026-09-11T10:00:00+01:00', duration_min: 45, entry_date: '2026-09-11' };
  const later = { id: 'l', title: 'Team run', starts_at: '2026-09-11T16:00:00+01:00', duration_min: 60, entry_date: '2026-09-11' };
  const exps = [
    { session_id: 'y', is_required: true, waived_reason: null },
    { session_id: 'm', is_required: true, waived_reason: null },
    { session_id: 'l', is_required: true, waived_reason: null },
  ];
  const rows = outstandingRpe(exps, [later, morning, yesterday], new Set(), now);
  assert(rows.map((r) => r.id).join(',') === 'y,m', 'yesterday\'s session and this morning\'s are listed; the 16:00 is not — it has not happened');
  assert(rows[0]!.id === 'y', 'oldest first — yesterday above this morning');
  assert(outstandingRpe(exps, [later, morning, yesterday], new Set(['y']), now).map((r) => r.id).join(',') === 'm', 'a rated session leaves the list');
  assert(outstandingRpe([{ session_id: 'm', is_required: true, waived_reason: 'illness' }], [morning], new Set(), now).length === 0, 'a waived expectation is not owed');
  assert(outstandingRpe([{ session_id: 'm', is_required: false, waived_reason: null }], [morning], new Set(), now).length === 0, 'nor an optional one');
  assert(outstandingRpe([{ session_id: 'ghost', is_required: true, waived_reason: null }], [morning], new Set(), now).length === 0, 'an expectation whose session is not in the fetch produces nothing rather than a nameless row');
  /* The window is the caller's: it passes yesterday and today. */
  assert(/addDays\(date, -1\)/.test(compliance) && /\.in\('expectation_date', \[yesterday, date\]\)/.test(compliance), 'fetchMyOutstanding reads yesterday and today — the following-day window');
  assert(/from\('sessions'\)/.test(compliance) && /'id, title, starts_at, duration_min'/.test(compliance), 'and fetches the sessions those expectations name, for the time rule and the name');
  assert(/\.eq\('entry_date', date\)[\s\S]*wellness_entries_current|wellness_entries_current[\s\S]*\.eq\('entry_date', date\)/.test(compliance), 'wellness stays today-only');
}

console.log('\nthe screen stops accepting a rating when the row disappears — end of the following day, club time');
{
  const s = { starts_at: '2026-09-10T09:30:00+01:00', duration_min: 80 };
  assert(rpeClosesAt(s, TZ) === t('2026-09-12T00:00:00+01:00'), 'a session on the 10th closes at midnight ending the 11th');
  assert(!rpeIsClosed(s, TZ, t('2026-09-11T23:59:59+01:00')) && rpeIsClosed(s, TZ, t('2026-09-12T00:00:00+01:00')), 'open at 23:59:59 on the 11th, closed a second later');
  const late = { starts_at: '2026-09-10T23:00:00+01:00', duration_min: 50 };
  assert(rpeClosesAt(late, TZ) === t('2026-09-12T00:00:00+01:00'), 'a session ending 23:50 still closes a full day later, not ten minutes later — the day is the session\'s own');
  /* The same instant as the row: yesterday-and-today is exactly "until the
     end of the following day", so the list and the screen agree by
     construction. Checked at the boundary rather than asserted. */
  const window = (now: number): boolean => outstandingRpe([{ session_id: 'x', is_required: true, waived_reason: null }], [{ ...s, id: 'x', title: 'T', entry_date: '2026-09-10' }], new Set(), now).length === 1;
  assert(window(t('2026-09-11T23:59:59+01:00')) && !rpeIsClosed(s, TZ, t('2026-09-11T23:59:59+01:00')), 'at 23:59:59 on the following day both the row and the screen are open');
  assert(/rpeIsClosed\(/.test(rpePage) && /This session can no longer be rated\./.test(rpePage), 'the RPE screen refuses after that instant, in plain words');
  const closedIdx = rpePage.indexOf('rpeIsClosed(');
  const formIdx = rpePage.indexOf('<RpeForm');
  assert(closedIdx > 0 && formIdx > 0 && rpePage.indexOf('This session can no longer be rated.') < formIdx, 'and the refusal is decided before the form is offered');
  assert(!/rpeClosesAt|rpeIsClosed/.test(strip(read('src/lib/queries/training.ts'))) && !/rpeIsClosed/.test(strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'))), 'the database and the offline outbox are untouched: a rating made in time and flushed late still lands, and staff corrections never create a row');
}

console.log('\nRPE 3. the name is the screen\'s heading');
{
  assert(rpeRowName('Team run') === 'Rate Team run', '"Rate {session name}"');
  assert(rpeRowName(null) === 'Rate Training' && rpeRowName('  ') === 'Rate Training', '"Training" when the session has no title, as before');
  assert(/<h1 className="t">\{rpeRowName\(session\.title\)\}<\/h1>/.test(rpePage), 'the RPE screen\'s h1 is the same function of the same title');
  assert(/title: 'Rate a session · Fydr'/.test(rpePage), 'and its tab title says what the screen is');
  assert(/label: rpeRowName\(/.test(compliance), 'the to-do label is built by it too');
  assert(!/How hard was it\?/.test(compliance), 'and "How hard was it?" is no longer a row name');
}

console.log('\nthe subtitles and the session line, in club time');
{
  const today = '2026-09-11';
  assert(rpeWhen({ starts_at: '2026-09-11T10:00:00+01:00', duration_min: 45 }, today, TZ) === 'Today 10:45', 'earlier today: "Today HH:MM", the END time');
  assert(rpeWhen({ starts_at: '2026-09-10T18:00:00+01:00', duration_min: 90 }, today, TZ) === 'Yesterday', 'carried over: "Yesterday"');
  assert(rpeWhen({ starts_at: '2026-09-09T18:00:00+01:00', duration_min: 90 }, today, TZ) === 'Wed 19:30', 'older (unreachable with the current window): "{Day} HH:MM"');
  const now = t('2026-09-11T15:20:00+01:00');
  assert(sessionMeta({ starts_at: '2026-09-11T10:00:00+01:00', duration_min: 75, location: 'Gym' }, now, TZ) === '10:00 · Gym · finished 11:15', 'finished: "finished HH:MM"');
  assert(sessionMeta({ starts_at: '2026-09-11T16:00:00+01:00', duration_min: 60, location: 'Pitch' }, now, TZ) === '16:00 · Pitch · starts in 40 min', 'upcoming: "starts in X min"');
  assert(sessionMeta({ starts_at: '2026-09-11T15:00:00+01:00', duration_min: 60, location: 'Pitch' }, now, TZ) === '15:00 · Pitch · in progress', 'underway: "in progress"');
  assert(sessionMeta({ starts_at: '2026-09-11T19:00:00+01:00', duration_min: 60, location: null }, now, TZ) === '19:00 · Location not set', 'more than two hours off: no countdown, no invented location');
  assert(availabilityLine('Modified', ['no_contact', 'running_only'], null, (v) => v.replace('_', ' ')) === 'Modified · no contact · running only', 'the banner line: status, then what they may do');
  assert(availabilityLine('Unavailable', [], 'Illness', (v) => v) === 'Unavailable · Illness', 'or the reason when there is no restriction');
}

console.log('\nB-f. the durations, and where each comes from');
{
  assert(/'45 sec'/.test(page), '"45 sec" — 00-product-overview §198 and 08-notifications name the 45-second wellness entry');
  assert(/'about 10 sec'/.test(page), '"about 10 sec" — 08-notifications: "three answers, under 10 seconds"');
  assert(!/20 sec/.test(page) && !/20 sec/.test(compliance) && !/20 sec/.test(strip(read('src/lib/todayRows.ts'))), '"20 sec" is NOT shipped: its only source is docs/screens/legacy/training-entry.md, which is not binding — Isabella decides');
  assert(!/45 seconds|20 seconds|10 seconds/.test(page), 'and no long-form duration claim remains');
  assert(!/Did you hit your protein target/.test(page), 'the nutrition row carries no question text');
  assert(/'Weekly nutrition check-in'/.test(page), 'it is "Weekly nutrition check-in"');
}

console.log('\nthe page: order (S1, S2, S3), the rows, the empty state');
{
  const at = (needle: string): number => page.indexOf(needle);
  const todo = at('id="todo-title"'), today = at('id="today-title"'), week = at('className="card wk-card"'), avail = at('<AvailabilityBanner'), diag = at('<InjuryClinical'), team = at('Team this week'), bannerLine = at('href="#availability"');
  assert(todo > 0 && today > todo, 'To do comes before Today');
  assert(week > today, 'S1: the week strip is kept, below Today');
  assert(/wk-towards/.test(page), 'with "Working towards"');
  assert(avail > week, 'S2: the availability card sits below the week');
  assert(bannerLine > 0 && bannerLine < todo, 'and the one-line banner sits above To do, linking down');
  assert(/availability\.current\.status !== 'available'[\s\S]*?availabilityLine\(/.test(page) && /\{availSummary \? \([\s\S]{0,200}href="#availability"/.test(page), 'the banner renders only when the athlete is not fully available');
  assert(diag > avail && /<InjuryClinical/.test(page), 'S3: the diagnosis is a separate component, after the card');
  assert(team > diag, 'team this week last');
  assert(!/'WEL'|'RPE'|'NUT'/.test(page), 'no glyph tiles');
  assert(!/className="gl"/.test(page), 'and no .gl spans');
  assert(/None left/.test(page) && /You&rsquo;re up to date|You're up to date/.test(page), '"None left" and a "You\'re up to date" row in the same slot');
  assert(!/done-card|done-check/.test(page), 'the old centred done card is gone');
  assert(!/you are not in this one|contact, not you/.test(page), 'S5: no row claims to know who is in a session');
  assert(/sessionMeta\(/.test(page) && /rpeWhen\(/.test(page), 'session lines and RPE subtitles come from the shared builders');
  assert(/className="eyebrow today-sect todo-head" id="todo-title"/.test(page) && /className="eyebrow today-sect" id="today-title"/.test(page), 'section titles are eyebrows, as drawn — scoped to Today, so My data\'s h2.eyebrow headings are untouched');
  assert(!/\.sect\.todo-head/.test(css) && !/^h2\.eyebrow/m.test(css), 'the old full-size heading rule is gone and no rule reaches every h2.eyebrow');
}

console.log('\nS4. the availability card, and the contrast measured from tokens.css');
{
  assert(!/avail-ring/.test(banner) && !/avail-ring/.test(page), 'no ring');
  assert(/id="availability"/.test(banner), 'the card is the banner\'s anchor');
  assert(/state\.label/.test(banner) && /restrictions/.test(banner) && /\{note\}/.test(banner) && /bodyAreaPhrase\(/.test(banner) && /Speak to medical staff\./.test(banner), 'every line the spec lists is still rendered');
  assert(/avail-chip/.test(banner) && /reasonCategory/.test(banner), 'the reason category is the white chip');
  const card = /\.avail-banner\[data-tone='warn'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const cardBad = /\.avail-banner\[data-tone='bad'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/color:\s*var\(--warn-pill-text\)/.test(card) && /color:\s*var\(--bad-pill-text\)/.test(cardBad), 'text on the tint is the *-pill-text token');
  assert(!/--warn-text|--bad-text/.test(card + cardBad), 'not --warn-text, which measures 3.29:1 on the light tint');

  /* The measurement, from the tokens themselves, so a token change that
     breaks 4.5:1 fails the build rather than a screenshot. */
  const tokens = read('src/styles/tokens.css');
  const block = (start: string, end: string): string => tokens.slice(tokens.indexOf(start), tokens.indexOf(end, tokens.indexOf(start)));
  const light = block(":root[data-theme='light'] {", ".dark-tokens,");
  const dark = block(":root[data-theme='dark'] {", '@media (prefers-color-scheme: dark)');
  const base = tokens.slice(0, tokens.indexOf(':root,'));
  const hex = (src: string, name: string): [number, number, number] => {
    const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(src) ?? new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(base);
    if (!m) throw new Error(`no ${name}`);
    const h = m[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const lum = (c: [number, number, number]): number => {
    const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  };
  const ratio = (a: [number, number, number], b: [number, number, number]): number => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const mix = (tone: [number, number, number], surf: [number, number, number], p: number): [number, number, number] =>
    [0, 1, 2].map((i) => Math.round((1 - p) * surf[i]! + p * tone[i]!)) as [number, number, number];
  const over = (tone: [number, number, number], bg: [number, number, number], a: number): [number, number, number] =>
    [0, 1, 2].map((i) => Math.round((1 - a) * bg[i]! + a * tone[i]!)) as [number, number, number];
  assert(/color-mix\(in srgb, rgb\(var\(--state-rgb\)\) 12%, var\(--surf\)\)/.test(/\.avail-banner\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''), 'the card fill is 12% of the tone mixed into --surf (the rule the banner already had)');
  const washAlpha = { light: { warn: 0.16, bad: 0.13 }, dark: { warn: 0.08, bad: 0.08 } };
  for (const [theme, src] of [['light', light], ['dark', dark]] as const) {
    for (const tone of ['warn', 'bad'] as const) {
      const fill = mix(hex(src, `--${tone}`), hex(src, '--surf'), 0.12);
      const text = hex(src, `--${tone}-pill-text`);
      const r = ratio(text, fill);
      assert(r >= 4.5, `${theme} ${tone} card: --${tone}-pill-text on the tint = ${r.toFixed(2)}:1`);
      const wash = over(hex(src, `--${tone}`), hex(src, '--bg'), washAlpha[theme][tone]);
      const rb = ratio(hex(src, '--text'), wash);
      assert(rb >= 4.5, `${theme} ${tone} banner: --text on --wash-${tone} over --bg = ${rb.toFixed(2)}:1`);
      const rc = ratio(text, hex(src, '--surf'));
      assert(rc >= 4.5, `${theme} ${tone} chip: --${tone}-pill-text on --surf = ${rc.toFixed(2)}:1`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
