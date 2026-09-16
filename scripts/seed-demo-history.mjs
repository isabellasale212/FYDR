/* Twelve weeks of coherent history for Glenbrae (the club seed.sql calls
 * Ashcombe, renamed here — Isabella, 15 Sept), plus this week's schedule.
 *
 * WHAT THIS IS. The demo data for Friday 18 September 2026 (Isabella, 15 Sept:
 * "the last work of the week and the biggest"). A performance scientist will
 * read it, so it is GENERATED FROM A MODEL, not drawn at random: the sessions
 * exist first; who attended follows availability; how hard each athlete rated
 * a session follows the session's plan and the athlete's own tendency; the
 * next morning's fatigue and soreness follow yesterday's load; a weigh-in is
 * one per athlete per day; a test improves slowly and unevenly; an injury
 * takes an athlete out, moves through rehab stages and brings them back on
 * modified availability. Flags are NOT inserted: after the entries are in,
 * the real nightly engine (evaluate_daily_thresholds_for_org, migrations
 * 0052/0053) is run over every day of the window and raises what the club's
 * own threshold rules raise. Compliance expectations the same way
 * (generate_compliance_expectations, 0044), then waived where an athlete was
 * unavailable, as the product does.
 *
 * DELIBERATELY INCOMPLETE. Wellness check-ins land at roughly 65–80% across
 * the squad, several athletes check in rarely, one athlete's check-ins fall
 * away in the last fortnight, one athlete rates only about half his sessions
 * (so his ACWR is withheld — "14 of 28 days" — rather than estimated), some
 * sessions are unrated, some weigh-ins are missed, one week's GPS units were
 * not charged. Missing is an absent row, never a zero. The product's
 * argument is that it shows denominators and withholds what it cannot
 * support; perfect data would hide that.
 *
 * THE PLANTED NARRATIVES (each named by the athlete's NAME, with a fallback
 * to squad order if a name is not in the club — the seed squad is the same
 * on scratch and production):
 *   load spike        Max Chapman      — a light three weeks, then the last
 *                                        seven days at RPE 9–10 with two
 *                                        individual extras: ACWR well above 1.3
 *   body mass drift   Rory Hastings    — weigh-ins slide, the last two drop
 *                                        sharply: MET-043 fires (nutritionist,
 *                                        S&C; never the coach)
 *   back from injury  Adam Selby       — left hamstring, out four weeks, five
 *                                        rehab stages, back this fortnight on
 *                                        modified availability
 *   compliance fall   Josh Ferris      — 90% check-ins until two weeks ago,
 *                                        one since
 *   also: Sione Aholelei injured in Saturday's match and out; Tomasi Koloofai
 *   an ankle in July, closed; Louis Fox three days ill; Nathan Bennett two
 *   short nights; Ollie Delaney the half-rating athlete; Harry Ainsley,
 *   George Palmer and Seb Ellery the rare check-ins. Dan Okonkwo — the
 *   athlete-app demo account — is complete.
 *
 * WHAT IT REPLACES. The organisation's EXISTING history in every table it
 * writes is removed first (sessions and everything hanging off them, entries,
 * weigh-ins, tests, injuries, availability, flags, expectations, match
 * sheets, fixtures, programme assignments, the Rehab group's memberships).
 * Twelve coherent weeks cannot coexist with the four incoherent ones
 * supabase/seed.sql wrote — a session on the same day twice, a wellness row
 * that ignores yesterday's load. Every row it removes is synthetic (the
 * runbook of 15 Sept: all production accounts are synthetic, no club is on
 * it). Kept: the organisation, users and roles, athletes, groups, teams, the
 * season, thresholds, week templates, programmes and exercises (it adds its
 * own if missing), test definitions (same), nutrition targets (same), meal
 * library, leaderboards, notification preferences, the audit log.
 *
 * HOW TO RUN.
 *   dry run, scratch:   node --env-file=.env.local scripts/seed-demo-history.mjs
 *   write, scratch:     node --env-file=.env.local scripts/seed-demo-history.mjs --write
 *   PRODUCTION (Isabella only, once):
 *     node --env-file=.env.production.explicit scripts/seed-demo-history.mjs --target production --write
 * It prints the database it is pointed at (host only, never the credentials),
 * refuses if the project ref does not match the target named, and without
 * --write changes nothing: it reports what it would remove and what it would
 * write. Everything is one transaction; a failure leaves the database as it
 * was. Re-running replaces the history again with the same values (every
 * number is derived from a hash of the athlete, the day and the purpose).
 *
 * Runs as the database owner (the direct URL), so RLS is bypassed and the
 * audit triggers can be stood down for the duration — a seed that wrote ten
 * thousand "row inserted by nobody" audit events would flood the Audit page.
 * Business triggers stay on: readiness is computed by the wellness trigger,
 * session load by the training trigger, best attempts by the test trigger,
 * injury timeline events by the injury triggers. The one exception is the
 * training_entries submitted_at clamp (it would stamp every historical
 * rating "now"), stood down so a rating keeps the time it was given.
 */
import pg from 'pg';
import { resolveDbUrl } from './lib/db-url.mjs';

/* ---------------------------------------------------------------------------
 * Target and safety
 * ------------------------------------------------------------------------- */
const SCRATCH_REF = 'stfgzkuvczbpxyevxkak';
const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';
const ORG = 'a0000000-0000-4000-8000-000000000001';
const CONSENT_VERSION = 'placeholder:LEGAL-3A+3B:2026-09-13'; // src/lib/legalPlaceholders.ts

const args = new Set(process.argv.slice(2));
const target = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : 'scratch';
const WRITE = args.has('--write');
if (!['scratch', 'production'].includes(target)) { console.error('--target must be scratch or production'); process.exit(1); }

const { url, via } = await resolveDbUrl({ direct: process.env.SUPABASE_DB_URL, pooler: process.env.SUPABASE_DB_POOLER_URL, label: target });
const wantRef = target === 'production' ? PRODUCTION_REF : SCRATCH_REF;
const otherRef = target === 'production' ? SCRATCH_REF : PRODUCTION_REF;
if (!url.includes(wantRef) || url.includes(otherRef)) {
  console.error(`REFUSING: the connection string does not name the ${target} project.`);
  process.exit(1);
}
const host = (() => { try { const u = new URL(url); return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`; } catch { return '(unparseable)'; } })();
console.log(`target: ${target} (${host}, via ${via})  mode: ${WRITE ? 'WRITE' : 'dry run'}\n`);

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 600000 });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const one = async (sql, p = []) => (await c.query(sql, p)).rows[0];

/* ---------------------------------------------------------------------------
 * Deterministic randomness: every draw is a pure function of a key string, so
 * the same club on the same date gets the same history twice.
 * ------------------------------------------------------------------------- */
const hash32 = (s) => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i += 1) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
const rand = (key) => { let t = hash32(key) + 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const norm = (key, sd = 1) => { const u = Math.max(1e-9, rand(key + '#a')), v = rand(key + '#b'); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd; };
const pick = (key, arr) => arr[Math.floor(rand(key) * arr.length)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const r1 = (x) => Math.round(x * 10) / 10;
const uuid = (key) => { const a = hash32('u1' + key).toString(16).padStart(8, '0'), b = hash32('u2' + key).toString(16).padStart(8, '0'), d = hash32('u3' + key).toString(16).padStart(8, '0'), e = hash32('u4' + key).toString(16).padStart(8, '0'); return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-8${d.slice(1, 4)}-${d.slice(4)}${e}`; };

/* ---------------------------------------------------------------------------
 * Dates: the organisation's local calendar, as strings. Day arithmetic in UTC
 * on 'YYYY-MM-DD' so no machine timezone leaks in.
 * ------------------------------------------------------------------------- */
const dayMs = 86400000;
const toDate = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * dayMs));
const dow = (s) => ((toDate(s).getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / dayMs);
const ts = (date, hm) => `${date} ${hm}`; // local wall clock; cast in SQL with the org timezone

/* ---------------------------------------------------------------------------
 * Context from the database
 * ------------------------------------------------------------------------- */
const org = await one(`select id, name, timezone from public.organisations where id = $1 and deleted_at is null`, [ORG]);
if (!org || !/ashcombe|glenbrae/i.test(org.name)) { console.error(`REFUSING: organisation ${ORG} is not the demo club here (${org?.name ?? 'absent'}).`); await c.end(); process.exit(1); }
/* The club is Scottish for a Scottish audience (Isabella, 15 Sept): the
   organisation row is renamed in the same pass — the accounts' @ashcomberfc
   addresses are auth-level and stay. */
const CLUB = 'Glenbrae Rugby Club';
const TZ = org.timezone;
const { today, now } = await one(`select (now() at time zone $1)::date::text as today, now()::text as now`, [TZ]);
const nowLocalHm = (await one(`select to_char(now() at time zone $1, 'HH24:MI') as hm`, [TZ])).hm;
const season = await one(`select id from public.seasons where org_id = $1 and is_current order by starts_on desc limit 1`, [ORG]);
if (!season) { console.error('REFUSING: no current season.'); await c.end(); process.exit(1); }
/* The seed squad's own staff by name where they exist (a test on scratch had
   given an athlete a coach role, and "Set by Adam Selby, coach" is not a
   sentence the demo should say); otherwise any active holder of the role who
   is not also an athlete. */
const PREFERRED = { sport_scientist: 'j.pemberton@', coach: 'p.ackland@', medic: 'r.callaghan@', strength_conditioning: 'o.hartnell@', nutritionist: 's.mirza@' };
const staffFor = async (role) => (await one(`select ur.user_id from public.user_roles ur join public.users u on u.id = ur.user_id where ur.org_id = $1 and ur.role = $2::app_role and u.status = 'active' and u.deleted_at is null and not exists (select 1 from public.athletes a where a.user_id = u.id) order by (u.email like $3) desc, u.email limit 1`, [ORG, role, `${PREFERRED[role]}%`]))?.user_id ?? null;
const staff = { ss: await staffFor('sport_scientist'), coach: await staffFor('coach'), medic: await staffFor('medic'), sc: await staffFor('strength_conditioning'), nut: await staffFor('nutritionist') };
for (const [k, v] of Object.entries(staff)) if (!v) { console.error(`REFUSING: no active ${k} account in the organisation.`); await c.end(); process.exit(1); }
const athletes = await q(`select id, user_id, first_name, last_name, position, squad_number, date_of_birth::text as dob from public.athletes where org_id = $1 and deleted_at is null and status <> 'left_club' order by squad_number nulls last, last_name`, [ORG]);
const groups = Object.fromEntries((await q(`select id, name from public.groups where org_id = $1 and deleted_at is null`, [ORG])).map((g) => [g.name, g.id]));
for (const g of ['Forwards', 'Backs', 'Rehab']) if (!groups[g]) { console.error(`REFUSING: no "${g}" group.`); await c.end(); process.exit(1); }
const membership = await q(`select group_id, athlete_id from public.group_memberships where org_id = $1 and removed_at is null`, [ORG]);
const inGroup = (athleteId, name) => membership.some((m) => m.group_id === groups[name] && m.athlete_id === athleteId);

console.log(`${org.name} · ${TZ} · today ${today} ${nowLocalHm} · ${athletes.length} athletes · season ${season.id.slice(0, 8)}`);

/* ---------------------------------------------------------------------------
 * The calendar: twelve weeks ending with this week
 * ------------------------------------------------------------------------- */
const monday0 = addDays(today, 1 - dow(today)); // this week's Monday
const W0 = addDays(monday0, -77); // Monday, eleven weeks earlier
const weekOf = (d) => Math.floor(diffDays(d, W0) / 7); // 0..11 inside the window
const lastDay = addDays(monday0, 6 + 7); // through next Sunday, for the fixture after this one
const days = []; for (let d = W0; d <= lastDay; d = addDays(d, 1)) days.push(d);
const isPast = (date, hm) => date < today || (date === today && hm < nowLocalHm);

/* Fixtures: Saturdays of weeks 5, 7, 9, 10 played; 11 (this week) and 12 to come. */
/* Scottish opposition for a Scottish club: the Super Series clubs and their grounds. */
const FIXTURES = [
  { w: 5, opponent: 'Ayr', venue: 'Millbrae', homeAway: 'away', competition: 'Pre-season', importance: 'friendly', result: 'L 17-24' },
  { w: 7, opponent: 'Stirling Wolves', venue: 'Glenbrae Park', homeAway: 'home', competition: 'Pre-season', importance: 'friendly', result: 'W 31-20' },
  { w: 9, opponent: "Heriot's", venue: 'Glenbrae Park', homeAway: 'home', competition: 'Super Series', importance: 'key', result: 'W 24-19' },
  { w: 10, opponent: 'Watsonians', venue: 'Myreside', homeAway: 'away', competition: 'Super Series', importance: 'normal', result: 'L 20-27' },
  { w: 11, opponent: 'Boroughmuir Bears', venue: 'Glenbrae Park', homeAway: 'home', competition: 'Super Series', importance: 'key', result: null },
  { w: 12, opponent: 'Currie Chieftains', venue: 'Malleny Park', homeAway: 'away', competition: 'Super Series', importance: 'normal', result: null },
].map((f) => ({ ...f, date: addDays(W0, f.w * 7 + 5), kickoff: '15:00', id: uuid(`fixture:${f.w}`) }));
const fixtureOn = (date) => FIXTURES.find((f) => f.date === date);
const fixtureWeek = (w) => FIXTURES.some((f) => f.w === w);
const TESTING_WEEKS = { 0: 'full', 4: 'full', 8: 'full', 10: 'sprints' };

/* ---------------------------------------------------------------------------
 * Sessions. One list, from the weekly template, before anything else.
 * ------------------------------------------------------------------------- */
const sessions = [];
const addSession = (o) => { const s = { ...o, id: uuid(`session:${o.date}:${o.key}`), status: isPast(o.date, o.end) ? 'completed' : 'planned', participants: o.participants ?? 'squad' }; sessions.push(s); return s; };
const addHm = (hm, min) => { const [h, m] = hm.split(':').map(Number); const t = h * 60 + m + min; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const S = (date, key, type, title, start, min, location, rpe, gps, extra = {}) => addSession({ date, key, type, title, start, end: addHm(start, min), min, location, plannedRpe: rpe, gps, ...extra });
for (const date of days) {
  const w = weekOf(date), d = dow(date), preSeason = w <= 2, deload = w === 3, fx = fixtureWeek(w);
  if (w > 12) continue;
  if (d === 1) S(date, 'recovery', 'recovery', 'Recovery', '10:00', 45, 'Pool', 2, false);
  if (d === 2) { S(date, 'lower', 'gym', 'Lower body', '07:00', 60, 'Gym', deload ? 6 : 8, false); S(date, 'cond', 'training', 'Conditioning', '10:30', preSeason ? 100 : fx ? 75 : 90, 'Main pitch', deload ? 6 : 8, true); }
  if (d === 3) { if (TESTING_WEEKS[w]) S(date, 'testing', 'testing', TESTING_WEEKS[w] === 'full' ? 'Testing — full battery' : 'Testing — sprints and jumps', '10:00', 90, 'Main pitch', 6, false); else S(date, 'units', 'training', 'Unit skills', '10:30', 75, 'Main pitch', 6, !(w === 2 || w === 6)); }
  if (d === 4) { S(date, 'upper', 'gym', 'Upper B', '06:30', 55, 'Gym', deload ? 5 : 7, false); S(date, 'team', 'training', 'Team run', '10:30', 80, 'Main pitch', 7, true); }
  if (d === 5) { if (fx) S(date, 'captains', 'training', "Captain's run", '11:00', 45, 'Main pitch', 4, false); else S(date, 'speed', 'training', 'Speed and power', '10:30', 60, 'Main pitch', 6, true); }
  if (d === 6) { const f = fixtureOn(date); if (f) S(date, 'match', 'match', `v ${f.opponent}`, f.kickoff, 80, f.venue, 9, true, { fixtureId: f.id }); else if (preSeason) S(date, 'satcond', 'training', 'Conditioning', '09:00', 60, 'Main pitch', 8, true); else if (!deload) S(date, 'satcond', 'training', 'Skills and conditioning', '09:00', 60, 'Main pitch', 7, true); }
}
/* md_offset against the next fixture within the week, as the product stores it. */
for (const s of sessions) { const next = FIXTURES.find((f) => f.date >= s.date && diffDays(f.date, s.date) <= 6); s.mdOffset = next ? diffDays(s.date, next.date) : null; }

/* ---------------------------------------------------------------------------
 * The cast. Names first, squad order as the fallback so the script runs on
 * any Ashcombe.
 * ------------------------------------------------------------------------- */
const byName = (first, last, fallbackIndex) => athletes.find((a) => a.first_name === first && a.last_name === last) ?? athletes[fallbackIndex % athletes.length];
const cast = {
  spike: byName('Max', 'Chapman', 3),
  mass: byName('Rory', 'Hastings', 16),
  injuryBack: byName('Adam', 'Selby', 6),
  complianceFall: byName('Josh', 'Ferris', 21),
  injuryOut: byName('Sione', 'Aholelei', 15),
  injuryClosed: byName('Tomasi', 'Koloofai', 17),
  ill: byName('Louis', 'Fox', 7),
  shortSleep: byName('Nathan', 'Bennett', 14),
  halfRater: byName('Ollie', 'Delaney', 13),
  rare: [byName('Harry', 'Ainsley', 26), byName('George', 'Palmer', 27), byName('Seb', 'Ellery', 24)],
  demo: byName('Dan', 'Okonkwo', 0),
};
const is = (a, who) => a.id === cast[who].id;
const isRare = (a) => cast.rare.some((r) => r.id === a.id);

/* Positional unit, from the athlete's position text. */
const unitOf = (a) => { const p = (a.position ?? '').toLowerCase(); if (/prop|hooker/.test(p)) return 'front'; if (/lock|second/.test(p)) return 'second'; if (/flank|number 8|no\. ?8|back row/.test(p)) return 'backrow'; if (/scrum|fly|half/.test(p)) return 'halves'; if (/centre/.test(p)) return 'centres'; if (/wing|full/.test(p)) return 'backthree'; return inGroup(a.id, 'Forwards') ? 'backrow' : 'centres'; };
const UNIT = { front: { mass: 112, td: 0.82, hsr: 0.55, speed: 0.9, squat: 175, bench: 135, cmj: 33, s10: 1.95, s40: 5.85, bronco: 320, yoyo: 1240, imtp: 3100, broad: 225 }, second: { mass: 113, td: 0.88, hsr: 0.65, speed: 0.92, squat: 170, bench: 125, cmj: 36, s10: 1.9, s40: 5.7, bronco: 305, yoyo: 1400, imtp: 3000, broad: 235 }, backrow: { mass: 104, td: 0.95, hsr: 0.85, speed: 0.96, squat: 165, bench: 120, cmj: 40, s10: 1.82, s40: 5.45, bronco: 285, yoyo: 1680, imtp: 2900, broad: 250 }, halves: { mass: 86, td: 1.0, hsr: 1.0, speed: 1.0, squat: 140, bench: 100, cmj: 42, s10: 1.76, s40: 5.25, bronco: 270, yoyo: 1900, imtp: 2500, broad: 258 }, centres: { mass: 95, td: 1.02, hsr: 1.15, speed: 1.02, squat: 155, bench: 115, cmj: 44, s10: 1.74, s40: 5.15, bronco: 275, yoyo: 1840, imtp: 2750, broad: 265 }, backthree: { mass: 89, td: 1.05, hsr: 1.35, speed: 1.06, squat: 145, bench: 105, cmj: 46, s10: 1.7, s40: 5.02, bronco: 268, yoyo: 1960, imtp: 2550, broad: 272 } };

/* Per-athlete constants. */
const profile = new Map();
for (const a of athletes) {
  const k = `p:${a.id}`, u = UNIT[unitOf(a)];
  const rare = isRare(a);
  const wellnessRate = is(a, 'demo') ? 0.96 : rare ? 0.32 + rand(k + 'wr') * 0.13 : rand(k + 'wtier') < 0.45 ? 0.84 + rand(k + 'wr') * 0.09 : 0.64 + rand(k + 'wr') * 0.16;
  profile.set(a.id, {
    unit: unitOf(a), u,
    sleep: 7.0 + rand(k + 'sleep') * 1.3, hr: 46 + Math.round(rand(k + 'hr') * 12),
    fat: 3.5 + rand(k + 'fat') * 0.9, sore: 3.4 + rand(k + 'sore') * 0.9, qual: 3.4 + rand(k + 'qual') * 0.9, stress: 3.5 + rand(k + 'stress') * 0.9, mood: 3.6 + rand(k + 'mood') * 0.8,
    mass: u.mass + norm(k + 'mass', 3.5),
    rpe: norm(k + 'rpe', 0.55),
    wellnessRate,
    rateRpe: is(a, 'demo') ? 0.98 : is(a, 'halfRater') ? 0.5 : rare ? 0.72 : 0.92 + rand(k + 'rr') * 0.06,
    gymRate: is(a, 'demo') ? 1 : rare ? 0.5 : 0.7 + rand(k + 'gr') * 0.2,
    nutRate: is(a, 'demo') ? 0.9 : rare ? 0.3 : 0.5 + rand(k + 'nr') * 0.3,
    squat: u.squat * (1 + norm(k + 'sq', 0.07)), bench: u.bench * (1 + norm(k + 'bp', 0.07)),
    testGain: 0.012 + norm(k + 'gain', 0.012), // per block; some athletes go backwards
    device: `CAT-${String(a.squad_number ?? 90).padStart(2, '0')}`,
  });
}

/* ---------------------------------------------------------------------------
 * Availability and injuries: the timeline every other table respects.
 * ------------------------------------------------------------------------- */
const availability = []; // { athleteId, status, from (date), to (date|null), restrictions, reason, injuryId, setBy, note, fromHm }
const injuries = [];
const rehabMembers = []; // { athleteId, added, removed }
const stageEvents = [];
const onsetSessionFor = (date, key) => sessions.find((s) => s.date === date && s.key === key)?.id ?? null;

const spanAvail = (athleteId, status, from, to, o = {}) => availability.push({ athleteId, status, from, to, restrictions: o.restrictions ?? null, reason: o.reason ?? null, injuryId: o.injuryId ?? null, setBy: o.setBy ?? staff.coach, note: o.note ?? null });
for (const a of athletes) spanAvail(a.id, 'available', addDays(W0, -1), null);
const cut = (athleteId, at) => { const open = availability.find((r) => r.athleteId === athleteId && r.to === null); if (open) open.to = at; };

/* Adam Selby — left hamstring in Tuesday's conditioning of week 4; out four
   weeks; rehab from week 5; back on modified availability from the Monday of
   week 10; still modified this week, expected back next Monday. */
{
  const a = cast.injuryBack, onset = addDays(W0, 4 * 7 + 1), backMod = addDays(W0, 10 * 7), expected = addDays(monday0, 7);
  const injuryId = uuid(`injury:${a.id}:hamstring`);
  injuries.push({ id: injuryId, athleteId: a.id, bodyArea: 'hamstring', side: 'left', onset, status: 'return_to_play', expectedReturn: expected, actualReturn: null, sessionId: onsetSessionFor(onset, 'cond'), occurredIn: 'training', reportedBy: staff.medic,
    clinical: { diagnosis: 'Grade 2 left hamstring strain, biceps femoris long head', mechanism: 'Sprint acceleration during the conditioning block; felt a pull at 30 m', severity: 'moderate', tissue: 'Muscle', imaging: 'Ultrasound day 3: 4 cm intramuscular lesion, no tendon involvement', referral: null, notes: 'Pain-free walking day 4. Isometrics from day 5. Progressed to running week 2 of rehab.', plan: 'Six-stage return to play. Stage 5 (return to running at 90% top speed) reached; stage 6 is contact.' },
    protocol: { total: 6, current: 5 } });
  cut(a.id, onset); spanAvail(a.id, 'unavailable', onset, backMod, { restrictions: [], reason: 'injury', injuryId, setBy: staff.medic, note: 'Hamstring — off feet, medical review weekly' });
  spanAvail(a.id, 'modified', backMod, null, { restrictions: ['No contact', 'Straight-line running only'], reason: 'injury', injuryId, setBy: staff.medic, note: 'Return-to-play stage 5. Contact from next week if the sprint test clears.' });
  rehabMembers.push({ athleteId: a.id, added: addDays(onset, 1), removed: null });
  for (let s = 1; s <= 5; s += 1) stageEvents.push({ injuryId, from: s - 1, to: s, at: ts(addDays(W0, (4 + s) * 7), '09:30'), by: staff.medic, line: ['Off feet, isometrics', 'Gym-based loading, no running', 'Straight-line jogging', 'Running progression to 80%', 'Return to running at 90%, no contact'][s - 1], reason: null });
}
/* Sione Aholelei — right knee (MCL) in the Gloucester match, week 10. Out. */
{
  const a = cast.injuryOut, onset = addDays(W0, 10 * 7 + 5);
  const injuryId = uuid(`injury:${a.id}:knee`);
  injuries.push({ id: injuryId, athleteId: a.id, bodyArea: 'knee', side: 'right', onset, status: 'rehab', expectedReturn: addDays(onset, 35), actualReturn: null, sessionId: onsetSessionFor(onset, 'match'), occurredIn: 'match', reportedBy: staff.medic,
    clinical: { diagnosis: 'Grade 2 medial collateral ligament sprain, right knee', mechanism: 'Valgus force in a ruck clean-out, 63rd minute', severity: 'moderate', tissue: 'Ligament', imaging: 'MRI day 2: grade 2 MCL, menisci and ACL intact', referral: 'Orthopaedic review booked', notes: 'Hinged brace. Non-weight-bearing 48 h then progressive.', plan: 'Four to six weeks. Brace two weeks, then range and strength, then running.' },
    protocol: { total: 5, current: 1 } });
  cut(a.id, onset); spanAvail(a.id, 'unavailable', onset, null, { restrictions: [], reason: 'injury', injuryId, setBy: staff.medic, note: 'Knee — braced' });
  rehabMembers.push({ athleteId: a.id, added: addDays(onset, 1), removed: null });
  stageEvents.push({ injuryId, from: 0, to: 1, at: ts(addDays(onset, 2), '10:00'), by: staff.medic, line: 'Braced, non-weight-bearing', reason: null });
}
/* Tomasi Koloofai — left ankle in week 1's unit skills; two weeks out, one
   week modified, closed in week 4. The full arc, for the injury report. */
{
  const a = cast.injuryClosed, onset = addDays(W0, 7 + 2), mod = addDays(onset, 14), back = addDays(onset, 21);
  const injuryId = uuid(`injury:${a.id}:ankle`);
  injuries.push({ id: injuryId, athleteId: a.id, bodyArea: 'ankle', side: 'left', onset, status: 'closed', expectedReturn: back, actualReturn: back, sessionId: onsetSessionFor(onset, 'units'), occurredIn: 'training', reportedBy: staff.medic,
    clinical: { diagnosis: 'Lateral ankle sprain, left, ATFL', mechanism: 'Landed on a foot in the ruck', severity: 'minor', tissue: 'Ligament', imaging: null, referral: null, notes: 'Ottawa negative. Swelling settled by day 5.', plan: 'Three weeks. Cleared for full training.' },
    protocol: { total: 3, current: 3 } });
  cut(a.id, onset); spanAvail(a.id, 'unavailable', onset, mod, { restrictions: [], reason: 'injury', injuryId, setBy: staff.medic });
  spanAvail(a.id, 'modified', mod, back, { restrictions: ['No cutting or change of direction'], reason: 'injury', injuryId, setBy: staff.medic });
  spanAvail(a.id, 'available', back, null, { setBy: staff.medic });
  rehabMembers.push({ athleteId: a.id, added: addDays(onset, 1), removed: back });
  for (let s = 1; s <= 3; s += 1) stageEvents.push({ injuryId, from: s - 1, to: s, at: ts(addDays(onset, s * 7), '09:00'), by: staff.medic, line: ['Protect and unload', 'Range and strength', 'Return to running'][s - 1], reason: null });
}
/* Louis Fox — three days of illness in week 9. */
{ const a = cast.ill, from = addDays(W0, 9 * 7 + 1), to = addDays(from, 3); cut(a.id, from); spanAvail(a.id, 'unavailable', from, to, { restrictions: [], reason: 'illness', setBy: staff.medic, note: 'Chest infection' }); spanAvail(a.id, 'available', to, null, { setBy: staff.medic }); }
/* Max Chapman — three light weeks on a managed load before the spike. */
{ const a = cast.spike, from = addDays(W0, 8 * 7), to = addDays(W0, 10 * 7 + 4); cut(a.id, from); spanAvail(a.id, 'modified', from, to, { restrictions: ['Reduced running volume'], reason: 'load_management', setBy: staff.sc, note: 'Managing a calf niggle — volume down, no extras' }); spanAvail(a.id, 'available', to, null, { setBy: staff.sc }); }

const availAt = (athleteId, date) => availability.find((r) => r.athleteId === athleteId && r.from <= date && (r.to === null || date < r.to)) ?? { status: 'available' };

/* Max's two individual extras this week (athlete-level participants). */
for (const d of [monday0, addDays(monday0, 1)]) if (isPast(d, '17:00')) S(d, 'extras', 'training', 'Extras — conditioning', '16:00', 60, 'Main pitch', 8, false, { participants: [cast.spike.id] });

/* ---------------------------------------------------------------------------
 * Match sheets, attendance, ratings, GPS
 * ------------------------------------------------------------------------- */
const participation = []; // { fixtureId, athleteId, started, cameOn, minutes }
const attendance = []; // { sessionId, athleteId, status, reason }
const entries = []; // training entries { athleteId, sessionId, date, rpe, min, submittedAt, createdBy }
const gps = [];
const dailyWork = new Map(); // `${athleteId}:${date}` → load actually done (rated or not), drives the next morning

const eligibleFor = (a, date) => { const av = availAt(a.id, date); return av.status !== 'unavailable'; };
for (const f of FIXTURES.filter((x) => x.result)) {
  const fit = athletes.filter((a) => availAt(a.id, f.date).status === 'available');
  const fw = fit.filter((a) => inGroup(a.id, 'Forwards')).sort((x, y) => rand(`xi:${f.id}:${x.id}`) - rand(`xi:${f.id}:${y.id}`));
  const bk = fit.filter((a) => !inGroup(a.id, 'Forwards')).sort((x, y) => rand(`xi:${f.id}:${x.id}`) - rand(`xi:${f.id}:${y.id}`));
  const starters = [...fw.slice(0, 8), ...bk.slice(0, 7)], bench = [...fw.slice(8, 13), ...bk.slice(7, 10)];
  for (const a of starters) { const off = rand(`sub:${f.id}:${a.id}`) < 0.45 ? 50 + Math.round(rand(`subm:${f.id}:${a.id}`) * 22) : 80; participation.push({ fixtureId: f.id, athleteId: a.id, started: true, cameOn: false, minutes: is(a, 'injuryOut') && f.w === 10 ? 63 : off }); }
  bench.forEach((a, i) => { const used = i < 6 || rand(`used:${f.id}:${a.id}`) < 0.5; participation.push({ fixtureId: f.id, athleteId: a.id, started: false, cameOn: used, minutes: used ? 8 + Math.round(rand(`on:${f.id}:${a.id}`) * 24) : 0 }); });
}
const playedMinutes = (fixtureId, athleteId) => participation.find((p) => p.fixtureId === fixtureId && p.athleteId === athleteId);

for (const s of sessions.filter((x) => x.status === 'completed')) {
  const squad = s.participants === 'squad' ? athletes : athletes.filter((a) => s.participants.includes(a.id));
  for (const a of squad) {
    const p = profile.get(a.id), av = availAt(a.id, s.date), k = `att:${s.id}:${a.id}`;
    let status = 'full', reason = null;
    if (s.type === 'match') { const mp = playedMinutes(s.fixtureId, a.id); if (!mp) { status = 'excused'; reason = 'Not in the 23'; } else if (!mp.started && !mp.cameOn) { status = 'full'; reason = 'Unused replacement'; } }
    else if (av.status === 'unavailable') { status = 'excused'; reason = av.reason === 'illness' ? 'Ill' : 'Injured — with medical'; }
    else if (av.status === 'modified') { status = 'modified'; reason = (av.restrictions ?? []).join(', ') || 'Modified'; }
    else if (rand(k + 'abs') < 0.025) { status = 'absent'; reason = null; }
    else if (rand(k + 'exc') < 0.015) { status = 'excused'; reason = pick(k + 'why', ['Representative duty', 'Personal', 'University exam']); }
    attendance.push({ sessionId: s.id, athleteId: a.id, status, reason, recordedAt: ts(s.date, addHm(s.end, 30)) });
    if (status === 'absent' || status === 'excused') continue;
    /* What the body did, rated or not. */
    const mp = s.type === 'match' ? playedMinutes(s.fixtureId, a.id) : null;
    if (s.type === 'match' && mp && mp.minutes === 0) continue;
    let minutes = s.type === 'match' ? mp.minutes : status === 'modified' ? Math.round(s.min * 0.6) : s.min;
    let rpe = s.plannedRpe + p.rpe + norm(k + 'rpe', 0.7);
    if (s.type === 'recovery') rpe = clamp(1.5 + p.rpe * 0.5 + norm(k + 'rpe', 0.9), 0, 4);
    if (s.type === 'match') rpe = clamp(8.2 + norm(k + 'rpe', 0.8) + (mp.minutes < 30 ? -1.5 : 0), 5, 10);
    if (status === 'modified') rpe -= 1.5;
    const w = weekOf(s.date);
    if (is(a, 'spike')) { if (w >= 8 && s.date < addDays(today, -6)) rpe -= 2.2; else if (s.date >= addDays(today, -6)) { rpe = s.type === 'recovery' ? 5 : Math.max(rpe, 9) + rand(k + 'spk'); minutes = s.type === 'match' ? minutes : Math.round(s.min * 1.15); } }
    rpe = r1(clamp(rpe, 0, 10));
    dailyWork.set(`${a.id}:${s.date}`, (dailyWork.get(`${a.id}:${s.date}`) ?? 0) + rpe * minutes);
    /* Rated? */
    let rate = p.rateRpe;
    if (is(a, 'complianceFall') && s.date >= addDays(today, -14)) rate = 0.35;
    if (is(a, 'spike') && s.date >= addDays(today, -6)) rate = 1;
    if (rand(k + 'rated') < rate) entries.push({ athleteId: a.id, sessionId: s.id, date: s.date, rpe, min: minutes, submittedAt: ts(s.date, addHm(s.end, 25 + Math.round(rand(k + 'lag') * 150))), createdBy: a.user_id });
    /* GPS, where the session had units and the athlete wore one. */
    if (s.gps && rand(k + 'unit') < 0.95) {
      const u = p.u, base = { cond: [5200, 520, 90, 34, 8.4, 42, 38, 520], units: [3800, 260, 40, 22, 7.9, 30, 27, 390], team: [4600, 420, 70, 30, 8.3, 36, 33, 470], speed: [2600, 380, 160, 28, 8.9, 26, 22, 300], satcond: [4200, 380, 60, 26, 8.2, 34, 31, 430], match: [6500, 600, 130, 45, 8.6, 48, 44, 720] }[s.key] ?? [4000, 300, 50, 25, 8.0, 30, 28, 400];
      const frac = s.type === 'match' ? minutes / 80 : status === 'modified' ? 0.6 : 1;
      const lift = is(a, 'spike') && s.date >= addDays(today, -6) ? 1.25 : is(a, 'spike') && w >= 8 ? 0.8 : 1;
      const n = (i, sd) => 1 + norm(`${k}:g${i}`, sd);
      gps.push({ athleteId: a.id, sessionId: s.id, date: s.date, durationS: minutes * 60, td: Math.round(base[0] * u.td * frac * lift * n(0, 0.09)), hsr: Math.round(base[1] * u.hsr * frac * lift * n(1, 0.18)), sprint: Math.round(base[2] * u.hsr * frac * lift * n(2, 0.3)), hie: Math.max(1, Math.round(base[3] * u.hsr * frac * lift * n(3, 0.2))), maxSpeed: r1(base[4] * u.speed * n(4, 0.04)), acc: Math.round(base[5] * frac * n(5, 0.15)), dec: Math.round(base[6] * frac * n(6, 0.15)), load: Math.round(base[7] * frac * lift * n(7, 0.1)), device: p.device });
    }
  }
}

/* ---------------------------------------------------------------------------
 * Wellness: the morning after follows the day before.
 * ------------------------------------------------------------------------- */
const wellness = [];
const meanWork = new Map();
for (const a of athletes) { const v = []; for (const d of days) { const w = dailyWork.get(`${a.id}:${d}`); if (w) v.push(w); } meanWork.set(a.id, v.length ? v.reduce((x, y) => x + y, 0) / v.length : 400); }
for (const a of athletes) {
  const p = profile.get(a.id);
  for (const date of days) {
    if (date > today) break;
    if (date === today && nowLocalHm < '07:30') break;
    const k = `w:${a.id}:${date}`;
    let rate = p.wellnessRate;
    if (is(a, 'complianceFall')) rate = date >= addDays(today, -14) ? 0.07 : 0.9;
    if (rand(k + 'in') >= rate) continue; // a gap is a gap
    const yday = addDays(date, -1), load = dailyWork.get(`${a.id}:${yday}`) ?? 0, mu = meanWork.get(a.id);
    const e = clamp((load - mu) / mu, -1, 1.6), postMatch = sessions.some((s) => s.date === yday && s.type === 'match' && playedMinutes(s.fixtureId, a.id)?.minutes > 0);
    const av = availAt(a.id, date);
    let sleepH = p.sleep + norm(k + 'sh', 0.55) - (postMatch ? 0.9 : 0) + (dow(date) === 1 ? 0.3 : 0);
    let fat = p.fat - 1.1 * e - (postMatch ? 0.8 : 0) + norm(k + 'f', 0.55);
    let sore = p.sore - 1.3 * e - (postMatch ? 1.2 : 0) + norm(k + 's', 0.55);
    let qual = p.qual + (sleepH - p.sleep) * 0.6 + norm(k + 'q', 0.5);
    let stress = p.stress + norm(k + 'st', 0.65) - (dow(date) >= 6 ? -0.3 : 0);
    let mood = p.mood + 0.25 * (qual - p.qual) + norm(k + 'm', 0.5) - (av.status === 'unavailable' ? 0.7 : 0);
    if (av.status === 'unavailable' && av.reason === 'injury') { sore = Math.min(sore, 2.6 + norm(k + 'is', 0.4)); fat = fat + 0.4; }
    if (is(a, 'spike') && date >= addDays(today, -4)) { fat = 1.4 + rand(k + 'sf'); sore = date >= addDays(today, -2) ? 1 : 1.6 + rand(k + 'ss'); mood = 2.6; }
    if (is(a, 'shortSleep') && (date === monday0 || date === addDays(monday0, 1))) { sleepH = date === monday0 ? 5.0 : 4.8; qual = 1.8; fat = 2.2; }
    const hr = Math.round(p.hr + 3 * e + (postMatch ? 3 : 0) + norm(k + 'hr', 2));
    const row = { athleteId: a.id, date, sleepHours: r1(clamp(sleepH, 4.5, 9.8)), sleepQuality: Math.round(clamp(qual, 1, 5)), fatigue: Math.round(clamp(fat, 1, 5)), soreness: Math.round(clamp(sore, 1, 5)), stress: Math.round(clamp(stress, 1, 5)), mood: Math.round(clamp(mood, 1, 5)), restingHr: clamp(hr, 38, 80), areas: null, comment: null, submittedAt: ts(date, `0${6 + Math.floor(rand(k + 'hh') * 3)}:${String(Math.floor(rand(k + 'mm') * 60)).padStart(2, '0')}`), createdBy: a.user_id };
    if (row.soreness <= 2) row.areas = [pick(k + 'area', ['hamstrings', 'quads', 'calves', 'lower back', 'shoulders', 'glutes'])];
    if (rand(k + 'c') < 0.03) row.comment = pick(k + 'ct', ['Tight after yesterday', 'Slept badly, kids up', 'Feeling good', 'Heavy legs', 'Neck a bit stiff from the scrum']);
    wellness.push(row);
  }
}

/* ---------------------------------------------------------------------------
 * Weigh-ins: Monday and Thursday mornings, one per athlete per day.
 * ------------------------------------------------------------------------- */
const weighIns = [];
const testingDays = sessions.filter((s) => s.type === 'testing').map((s) => s.date);
for (const a of athletes) {
  const p = profile.get(a.id);
  for (const date of days) {
    if (date > today || !(dow(date) === 1 || dow(date) === 4)) continue;
    if (date === today && nowLocalHm < '07:30') continue;
    const k = `bc:${a.id}:${date}`, av = availAt(a.id, date);
    if (av.status === 'unavailable' && rand(k + 'skip') < 0.6) continue;
    if (rand(k + 'miss') < 0.1) continue;
    const w = weekOf(date), t = diffDays(date, W0) / 84;
    let mass = p.mass - 0.4 * t + norm(k + 'n', 0.35);
    if (is(a, 'mass')) { const drift = w >= 7 ? -0.45 * (w - 6) : 0; const late = date >= addDays(today, -4) ? -1.4 : date >= addDays(today, -8) ? -0.7 : 0; mass = p.mass + drift + late + norm(k + 'n', 0.2); }
    const row = { athleteId: a.id, date, mass: r1(mass), fat: null, skin: null, method: 'Scales', recordedBy: staff.sc };
    if (testingDays.includes(addDays(date, 2)) || testingDays.includes(addDays(date, -1))) { const sf = 55 + (p.unit === 'front' ? 30 : p.unit === 'second' ? 22 : 8) + norm(k + 'sf', 6); row.skin = Math.round(sf); row.fat = r1(6 + sf * 0.11); row.method = 'Skinfolds'; }
    weighIns.push(row);
  }
}

/* ---------------------------------------------------------------------------
 * Gym: the programme the squad is on, and the logs against it.
 * ------------------------------------------------------------------------- */
const PROGRAMME = { name: 'Glenbrae strength 2026/27', blocks: [['Foundation', 'General strength, 4–6 reps'], ['Strength', 'Heavy 3–5 reps'], ['Power', 'Speed-strength, 3 reps'], ['In-season', 'Maintain, 2 lifts a week']] };
const EXERCISES = { 'Back squat': ['squat', 2.5], 'Romanian deadlift': ['hinge', 2.5], 'Split squat': ['squat', 2.5], 'Nordic curl': ['hinge', 2.5], 'Bench press': ['push', 2.5], 'Seated row': ['pull', 2.5], 'Overhead press': ['push', 2.5], 'Pull-up': ['pull', 1.0] };
const PLAN = { lower: [['Back squat', 4, 5, 'percent_1rm', [72, 80, 85, 80]], ['Romanian deadlift', 3, 8, 'percent_1rm', [45, 50, 55, 50]], ['Split squat', 3, 8, 'absolute', [30, 34, 38, 36]], ['Nordic curl', 3, 6, 'none', [null, null, null, null]]], upper: [['Bench press', 4, 5, 'percent_1rm', [72, 80, 85, 80]], ['Seated row', 3, 8, 'absolute', [65, 72, 78, 75]], ['Overhead press', 3, 8, 'absolute', [40, 45, 50, 48]], ['Pull-up', 3, 8, 'percent_bw', [null, null, null, null]]] };
const gymLogs = []; // { id, athleteId, programmeSessionKey, sessionId, date, startedAt, completedAt, rpe, sets: [...] }
for (const s of sessions.filter((x) => x.status === 'completed' && x.type === 'gym')) {
  const w = weekOf(s.date), block = w >= 12 ? 3 : Math.floor(w / 4), weekIn = (w % 4) + 1, kind = s.key; // lower | upper
  for (const a of athletes) {
    const p = profile.get(a.id), k = `gym:${s.id}:${a.id}`;
    const att = attendance.find((x) => x.sessionId === s.id && x.athleteId === a.id);
    if (!att || att.status === 'absent' || att.status === 'excused') continue;
    if (rand(k + 'log') >= p.gymRate) continue;
    const gain = 1 + 0.006 * w + norm(k + 'gain', 0.01); // the estimate the loads are set from
    const sets = [];
    for (const [name, nSets, reps, basis, pct] of PLAN[kind]) {
      const oneRm = name === 'Back squat' ? p.squat * gain : name === 'Bench press' ? p.bench * gain : null;
      const step = EXERCISES[name][1];
      let prescribed = basis === 'percent_1rm' ? Math.round((oneRm * pct[block]) / 100 / step) * step : basis === 'absolute' ? pct[block] + (p.unit === 'front' || p.unit === 'second' ? 6 : 0) : null;
      for (let i = 1; i <= nSets; i += 1) {
        const load = prescribed === null ? null : Math.max(0, prescribed + (rand(`${k}:${name}:${i}`) < 0.2 ? step : 0) - (rand(`${k}:${name}:${i}d`) < 0.1 ? step : 0));
        const done = rand(`${k}:${name}:${i}r`) < 0.12 ? reps - 1 : reps;
        sets.push({ exercise: name, setNumber: i, prescribedReps: reps, prescribedLoad: prescribed, step, load, reps: done, rpe: r1(clamp(6 + i * 0.5 + norm(`${k}:${name}:${i}e`, 0.5), 5, 10)), volume: load === null ? null : load * done });
      }
    }
    gymLogs.push({ id: uuid(`gymlog:${s.id}:${a.id}`), athleteId: a.id, kind, block, weekIn, sessionId: s.id, date: s.date, startedAt: ts(s.date, s.start), completedAt: ts(s.date, addHm(s.start, 48 + Math.round(rand(k + 'dur') * 12))), rpe: r1(clamp(6.5 + norm(k + 'rpe', 0.7), 5, 9)), sets });
  }
}

/* ---------------------------------------------------------------------------
 * Testing: slow, uneven improvement across the blocks.
 * ------------------------------------------------------------------------- */
const TESTS = [
  ['CMJ height', 'power', 'cm', true, 3, 1, 'cmj', 1], ['10m sprint', 'speed', 's', false, 3, 2, 's10', 1], ['40m sprint', 'speed', 's', false, 3, 2, 's40', 1],
  ['Bronco test', 'endurance', 's', false, 1, 1, 'bronco', 0], ['IMTP peak force', 'strength', 'N', true, 1, 0, 'imtp', 0], ['Yo-Yo IR1', 'endurance', 'm', true, 1, 0, 'yoyo', 0], ['Broad jump', 'power', 'cm', true, 2, 0, 'broad', 1],
];
const testResults = [];
for (const s of sessions.filter((x) => x.status === 'completed' && x.type === 'testing')) {
  const battery = TESTING_WEEKS[weekOf(s.date)];
  for (const a of athletes) {
    const p = profile.get(a.id), att = attendance.find((x) => x.sessionId === s.id && x.athleteId === a.id);
    if (!att || att.status !== 'full') continue;
    const blocksIn = weekOf(s.date) / 4;
    for (const [name, , , higher, attempts, dp, key, sprintsOnly] of TESTS) {
      if (battery === 'sprints' && !sprintsOnly) continue;
      const k = `test:${s.id}:${a.id}:${name}`;
      let gain = p.testGain * blocksIn + norm(k + 'g', 0.015);
      if (is(a, 'mass') && key === 'imtp' && blocksIn >= 2) gain -= 0.05; // lost mass, lost force
      const base = p.u[key] * (1 + norm(`base:${a.id}:${key}`, 0.05));
      const best = higher ? base * (1 + gain) : base * (1 - gain);
      for (let i = 1; i <= attempts; i += 1) { const v = best * (1 + (higher ? -1 : 1) * Math.abs(norm(k + i, 0.018))); testResults.push({ athleteId: a.id, test: name, sessionId: s.id, date: s.date, value: Number(v.toFixed(dp)), attempt: i, recordedBy: staff.sc }); }
    }
  }
}

/* ---------------------------------------------------------------------------
 * Nutrition: the weekly check-in, roughly six in ten weeks answered.
 * ------------------------------------------------------------------------- */
const nutrition = [];
for (const a of athletes) {
  const p = profile.get(a.id);
  for (let w = 0; w < 11; w += 1) {
    const weekStart = addDays(W0, w * 7), k = `nut:${a.id}:${weekStart}`;
    if (addDays(weekStart, 6) >= today) continue;
    if (rand(k + 'in') >= p.nutRate) continue;
    const r = rand(k + 'a'), answer = r < 0.55 ? 'yes' : r < 0.9 ? 'roughly' : 'no';
    nutrition.push({ athleteId: a.id, weekStart, answer, note: rand(k + 'n') < 0.08 ? pick(k + 'nt', ['Away with work Thursday', 'Struggled on match day', 'Better this week']) : null, submittedAt: ts(addDays(weekStart, 6), `${18 + Math.floor(rand(k + 'h') * 4)}:${String(Math.floor(rand(k + 'm') * 60)).padStart(2, '0')}`), createdBy: a.user_id });
  }
}

/* ---------------------------------------------------------------------------
 * How each athlete's app is running (athlete_devices, 0121) — the squad
 * overview's "Has app on home screen · N of M" (16 Sept 2026, 3.4) and the
 * reachability caption. Isabella, 16 Sept 2026: "most of the squad installed,
 * a handful not, and the rare check-in athletes among those who have not."
 *
 * Reachable (lib/queries/reachability.ts) is a standalone row on a
 * push-capable browser. So: the roster installs — an iPhone for most, an
 * Android for some — with a standalone row (push true; iOS 16.4+ holds push
 * from a Home Screen) and, for about half of them, the browser row of the
 * first open before they installed (iPhone: push false; Android: push true
 * but not standalone, so not reachable on its own). The three rare
 * check-in athletes and two more by hash have NOT installed: a browser row
 * only, and mostly on iPhone, so the caption's "of whom N are on iPhone"
 * has something to say. An athlete with no group — the two scratch test
 * athletes, and anyone not on the roster — has never opened the app: no
 * row. first_seen is early in the window; last_seen is their last check-in
 * (or yesterday for an athlete who has none).
 * ------------------------------------------------------------------------- */
const devices = []; // { athleteId, platform, mode, push, first, last }
{
  const inRoster = (a) => inGroup(a.id, 'Forwards') || inGroup(a.id, 'Backs') || inGroup(a.id, 'Academy');
  const lastCheckin = new Map();
  for (const w of wellness) if (!lastCheckin.has(w.athleteId) || w.date > lastCheckin.get(w.athleteId)) lastCheckin.set(w.athleteId, w.date);
  let extraNotInstalled = 0;
  for (const a of athletes) {
    if (!inRoster(a)) continue; // never opened: no row
    const k = `dev:${a.id}`;
    const platform = is(a, 'demo') ? 'ios' : rand(k + 'os') < 0.72 ? 'ios' : 'android';
    const notInstalled = isRare(a) || (!is(a, 'demo') && extraNotInstalled < 2 && rand(k + 'ni') < 0.09 && (extraNotInstalled += 1));
    const first = addDays(W0, 1 + Math.floor(rand(k + 'first') * 9));
    const last = lastCheckin.get(a.id) ?? addDays(today, -1);
    if (notInstalled) {
      devices.push({ athleteId: a.id, platform, mode: 'browser', push: platform === 'android', first, last });
      continue;
    }
    devices.push({ athleteId: a.id, platform, mode: 'standalone', push: true, first: addDays(first, rand(k + 'lag') < 0.5 ? 0 : 2), last });
    if (rand(k + 'br') < 0.5) devices.push({ athleteId: a.id, platform, mode: 'browser', push: platform === 'android', first, last: addDays(first, 1 + Math.floor(rand(k + 'brl') * 5)) });
  }
}
const deviceSummary = () => {
  const by = new Map();
  for (const d of devices) { const cur = by.get(d.athleteId) ?? { reachable: false, ios: false }; if (d.mode === 'standalone' && d.push) cur.reachable = true; if (d.platform === 'ios') cur.ios = true; by.set(d.athleteId, cur); }
  let reachable = 0, notInstalled = 0, notInstalledIos = 0, never = 0;
  for (const a of athletes) { const x = by.get(a.id); if (!x) never += 1; else if (x.reachable) reachable += 1; else { notInstalled += 1; if (x.ios) notInstalledIos += 1; } }
  return { reachable, notInstalled, notInstalledIos, never };
};

/* ---------------------------------------------------------------------------
 * The dry-run summary
 * ------------------------------------------------------------------------- */
const totalSets = gymLogs.reduce((n, g) => n + g.sets.length, 0);
const checkinRate = () => { const past = days.filter((d) => d < today); const expected = athletes.length * past.length; return (wellness.filter((w) => w.date < today).length / expected); };
const ratedShare = () => { const eligible = attendance.filter((x) => x.status === 'full' || x.status === 'modified').length; return entries.length / eligible; };
const daysRated = (athleteId) => new Set(entries.filter((e) => e.athleteId === athleteId && e.date > addDays(today, -28) && e.date <= today).map((e) => e.date)).size;
const name = (a) => `${a.first_name} ${a.last_name}`;

console.log('\nWILL WRITE');
console.log(`  window ${W0} → ${lastDay} (this week from ${monday0}); ${sessions.length} sessions (${sessions.filter((s) => s.status === 'completed').length} completed), ${FIXTURES.length} fixtures (${FIXTURES.filter((f) => f.result).length} played)`);
console.log(`  attendance ${attendance.length} · ratings ${entries.length} (${Math.round(ratedShare() * 100)}% of attended sessions rated; ${entries.filter((e) => e.rpe === 0).length} rated 0) · GPS ${gps.length}`);
console.log(`  wellness ${wellness.length} (${Math.round(checkinRate() * 100)}% of athlete-days) · weigh-ins ${weighIns.length} · gym logs ${gymLogs.length} (${totalSets} sets) · test results ${testResults.length} · nutrition check-ins ${nutrition.length}`);
console.log(`  injuries ${injuries.length} · availability spans ${availability.length} · match sheet rows ${participation.length}`);
{ const d = deviceSummary(); console.log(`  athlete devices ${devices.length} rows → has app on home screen ${d.reachable} of ${athletes.length} · ${d.notInstalled} not installed (${d.notInstalledIos} on iPhone) · ${d.never} never opened`); }
console.log(`  then: compliance expectations for every day, waived where unavailable; the threshold engine over every day from ${addDays(W0, 14)}; older flags acknowledged by staff`);
console.log('\nTHE NARRATIVES');
console.log(`  load spike        ${name(cast.spike)} — rated ${daysRated(cast.spike.id)} of the last 28 days; open /reports/squad (the ACWR column), /squad/${cast.spike.id} (the ACWR dial), /flags`);
console.log(`  body mass drift   ${name(cast.mass)} — open /flags as the nutritionist or S&C, /squad/${cast.mass.id}/nutrition, /nutrition`);
console.log(`  back from injury  ${name(cast.injuryBack)} — modified availability; open /squad/${cast.injuryBack.id}, /squad/${cast.injuryBack.id}/availability, /injuries/${injuries[0].id} (medic)`);
console.log(`  compliance fall   ${name(cast.complianceFall)} — open /reports/compliance, /compliance, the dashboard's Wellness in`);
console.log(`  ACWR withheld     ${name(cast.halfRater)} — rated ${daysRated(cast.halfRater.id)} of the last 28 days (needs 21); /reports/squad and /squad/${cast.halfRater.id} show the denominator, not a ratio`);
console.log(`  also              ${name(cast.injuryOut)} out (knee, Saturday's match); ${name(cast.injuryClosed)} an ankle in July, closed; ${name(cast.ill)} ill three days; ${name(cast.shortSleep)} two short nights; rare check-ins ${cast.rare.map(name).join(', ')}`);
console.log(`  demo account      ${name(cast.demo)} — complete: every session rated, every weigh-in, every gym log`);

const existing = {};
for (const [label, sql] of Object.entries({
  sessions: `select count(*)::int n from public.sessions where org_id = $1`,
  fixtures: `select count(*)::int n from public.fixtures where org_id = $1`,
  'wellness entries': `select count(*)::int n from public.wellness_entries where org_id = $1`,
  'training entries': `select count(*)::int n from public.training_entries where org_id = $1`,
  attendance: `select count(*)::int n from public.session_attendance where org_id = $1`,
  'gps records': `select count(*)::int n from public.gps_records where org_id = $1`,
  'gym logs': `select count(*)::int n from public.gym_session_logs where org_id = $1`,
  'weigh-ins': `select count(*)::int n from public.body_composition where org_id = $1`,
  'test results': `select count(*)::int n from public.test_results where org_id = $1`,
  'nutrition check-ins': `select count(*)::int n from public.nutrition_checkins where org_id = $1`,
  injuries: `select count(*)::int n from public.injuries where org_id = $1 and deleted_at is null`,
  availability: `select count(*)::int n from public.availability where org_id = $1`,
  flags: `select count(*)::int n from public.flags where org_id = $1`,
  'compliance expectations': `select count(*)::int n from public.compliance_expectations where org_id = $1`,
  'programme assignments': `select count(*)::int n from public.programme_assignments where org_id = $1`,
  'match sheet rows': `select count(*)::int n from public.match_participation where org_id = $1`,
  'athlete devices': `select count(*)::int n from public.athlete_devices where org_id = $1`,
})) existing[label] = (await one(sql, [ORG])).n;
console.log('\nWILL REMOVE FIRST (the organisation\'s existing history, all synthetic)');
console.log('  ' + Object.entries(existing).map(([k, v]) => `${k} ${v}`).join(' · '));
const undecided = (await one(`select count(*)::int n from public.athletes where org_id = $1 and deleted_at is null and consent_given_at is null and consent_declined_at is null and consent_withdrawn_at is null`, [ORG])).n;
console.log(`  consent: ${undecided} athlete(s) with no decision will be recorded as consented (${CONSENT_VERSION}); decided ones are left alone`);

if (!WRITE) { console.log('\nDry run — nothing written. Add --write to apply.'); await c.end(); process.exit(0); }

/* ---------------------------------------------------------------------------
 * Write, in one transaction
 * ------------------------------------------------------------------------- */
const t0 = Date.now();
const pgArray = (v) => (v === null || v === undefined ? null : '{' + v.map((x) => '"' + String(x).replace(/(["\\])/g, '\\$1') + '"').join(',') + '}');
const bulk = async (table, cols, types, rows) => {
  if (rows.length === 0) return 0;
  /* An array-typed column travels as one text literal per row (unnest would flatten a nested array) and is cast back in the select. */
  const arrays = cols.map((_, i) => rows.map((r) => (types[i].endsWith('[]') ? pgArray(r[i]) : r[i])));
  const params = cols.map((_, i) => `$${i + 1}::${types[i].endsWith('[]') ? 'text' : types[i]}[]`).join(', ');
  const list = cols.map((col, i) => (types[i] === 'timestamp' ? `t.c${i}::timestamp at time zone '${TZ}'` : types[i].endsWith('[]') ? `t.c${i}::${types[i]}` : `t.c${i}`)).join(', ');
  const aliases = cols.map((_, i) => `c${i}`).join(', ');
  const r = await c.query(`insert into public.${table} (${cols.join(', ')}) select ${list} from unnest(${params}) as t(${aliases})`, arrays);
  return r.rowCount;
};
const written = {};
const note = (k, n) => { written[k] = (written[k] ?? 0) + n; };

/* The triggers stood down below are stood back up INSIDE the same transaction,
   before the commit. ALTER TABLE ... DISABLE TRIGGER is transactional in
   Postgres: if anything between the disable and the commit throws, the
   rollback in the catch reverts the disable along with every row; if the
   process dies or the connection drops mid-run, the server rolls the open
   transaction back and the disable with it. There is no path on which a
   commit lands with a trigger still off — and disabledTriggers() below is
   run after the commit (and after a rollback) to prove it from the catalogue
   rather than assume it. */
const disabledTriggers = async () => q(`select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal and c.relnamespace = 'public'::regnamespace and t.tgenabled = 'D' order by 1, 2`);
const before = await disabledTriggers();
if (before.length > 0) { console.error('REFUSING: triggers are already disabled on this database:', before.map((t) => `${t.relname}.${t.tgname}`).join(', ')); await c.end(); process.exit(1); }

await c.query('begin');
try {
  /* Stand down the audit triggers and the submitted_at clamp for the duration. */
  const trig = await q(`select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and c.relnamespace = 'public'::regnamespace and (p.proname like 'audit_%' or t.tgname = 'training_entries_clamp_submitted_at')`);
  for (const t of trig) await c.query(`alter table public.${t.relname} disable trigger ${t.tgname}`);

  /* Remove the existing history, dependents first. */
  const del = async (label, sql) => { const r = await c.query(sql, [ORG]); note(`removed ${label}`, r.rowCount); };
  await del('flag actions', `delete from public.flag_actions where org_id = $1`);
  await del('flags', `delete from public.flags where org_id = $1`);
  await del('rehab assignments', `delete from public.rehab_assignments where org_id = $1`);
  await del('programme assignments', `delete from public.programme_assignments where org_id = $1`);
  await del('availability', `delete from public.availability where org_id = $1`);
  /* Injuries are retired, not removed: a subject-access clinical review may
     reference one (it did on scratch), and the product's own rule is a soft
     delete. Their clinical rows, protocols and timelines stay attached to the
     retired record, out of every screen that reads deleted_at is null; the
     session link is dropped so the sessions can go. */
  await del('injuries retired', `update public.injuries set deleted_at = now(), session_id = null where org_id = $1 and deleted_at is null`);
  /* This script's own injuries from an earlier run are removed outright (their
     ids are deterministic), so a re-run writes them afresh. */
  const mine = injuries.map((i) => i.id);
  for (const t of ['injury_stage_events', 'injury_protocols', 'injury_timeline_event', 'injury_clinical']) await c.query(`delete from public.${t} where injury_id = any($1::uuid[])`, [mine]);
  await c.query(`delete from public.injuries where id = any($1::uuid[])`, [mine]);
  await del('gym sets', `delete from public.gym_set_logs where org_id = $1`);
  await del('gym logs', `delete from public.gym_session_logs where org_id = $1`);
  await del('training entries', `delete from public.training_entries where org_id = $1`);
  await del('attendance', `delete from public.session_attendance where org_id = $1`);
  await del('gps', `delete from public.gps_records where org_id = $1`);
  await del('test results', `delete from public.test_results where org_id = $1`);
  await del('compliance expectations', `delete from public.compliance_expectations where org_id = $1`);
  await del('match sheets', `delete from public.match_participation where org_id = $1`);
  await del('wellness', `delete from public.wellness_entries where org_id = $1`);
  await del('nutrition check-ins', `delete from public.nutrition_checkins where org_id = $1`);
  await del('weigh-ins', `delete from public.body_composition where org_id = $1`);
  /* Every device row, real or synthetic: on scratch the probes' desktop rows,
     on the demo org anything a walkthrough phone recorded. The roster's rows
     below replace them; a phone that opens the app again writes its own row
     back the next time (record_athlete_device upserts). */
  await del('athlete devices', `delete from public.athlete_devices where org_id = $1`);
  await del('session participants', `delete from public.session_participants where org_id = $1`);
  await del('sessions', `delete from public.sessions where org_id = $1`);
  await del('team allocations', `delete from public.team_allocations where org_id = $1`);
  await del('fixtures', `delete from public.fixtures where org_id = $1`);
  await c.query(`delete from public.group_memberships where org_id = $1 and group_id = $2`, [ORG, groups.Rehab]);

  /* Reference data the history hangs off, created only if absent. */
  const exerciseId = {};
  for (const [nm, [cat, step]] of Object.entries(EXERCISES)) {
    const row = await one(`select id from public.exercises where (org_id = $1 or org_id is null) and name = $2 and deleted_at is null order by org_id nulls last limit 1`, [ORG, nm]);
    exerciseId[nm] = row?.id ?? (await one(`insert into public.exercises (id, org_id, name, category, weight_step_kg) values ($1, $2, $3, $4::exercise_category, $5) returning id`, [uuid(`exercise:${nm}`), ORG, nm, cat, step])).id;
  }
  let programmeId = (await one(`select id from public.programmes where org_id = $1 and (id = $3 or name = $2) and deleted_at is null order by (id = $3) desc limit 1`, [ORG, PROGRAMME.name, uuid('programme:main')]))?.id;
  if (programmeId) await c.query(`update public.programmes set name = $2 where id = $1 and name <> $2`, [programmeId, PROGRAMME.name]);
  const programmeSession = {}; // `${block}:${weekIn}:${kind}` → { id, exercises: { name → id } }
  if (!programmeId) {
    programmeId = uuid('programme:main');
    await c.query(`insert into public.programmes (id, org_id, name, programme_type, description, goal, duration_weeks, status, created_by) values ($1, $2, $3, 'gym', $4, $5, 16, 'active', $6)`, [programmeId, ORG, PROGRAMME.name, 'Four blocks: foundation, strength, power, in-season. Two lifts a week, Tuesday lower and Thursday upper.', 'Carry pre-season strength into the league', staff.sc]);
    for (let b = 0; b < 4; b += 1) {
      const blockId = uuid(`block:${b}`);
      await c.query(`insert into public.programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks, focus) values ($1, $2, $3, $4, $5, 4, $6)`, [blockId, ORG, programmeId, PROGRAMME.blocks[b][0], b + 1, PROGRAMME.blocks[b][1]]);
      for (let wk = 1; wk <= 4; wk += 1) for (const [seq, kind, nm, day] of [[1, 'lower', 'Lower A', 2], [2, 'upper', 'Upper B', 4]]) {
        const psId = uuid(`psession:${b}:${wk}:${kind}`);
        await c.query(`insert into public.programme_sessions (id, org_id, block_id, name, week_number, day_number, sequence) values ($1, $2, $3, $4, $5, $6, $7)`, [psId, ORG, blockId, nm, wk, day, seq]);
        const ex = {};
        let i = 0;
        for (const [ename, sets, reps, basis, pct] of PLAN[kind]) { i += 1; const peId = uuid(`pexercise:${b}:${wk}:${kind}:${ename}`); await c.query(`insert into public.programme_exercises (id, org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max, load_basis, load_value, rest_seconds) values ($1, $2, $3, $4, $5, $6, $7, $7, $8::load_basis, $9, $10)`, [peId, ORG, psId, exerciseId[ename], i, sets, reps, basis, pct[b], basis === 'none' ? 90 : 150]); ex[ename] = peId; }
        programmeSession[`${b}:${wk}:${kind}`] = { id: psId, exercises: ex };
      }
    }
    note('programme created', 1);
  } else {
    const rows = await q(`select ps.id, b.sequence - 1 as block, ps.week_number, ps.day_number, pe.id as pe_id, e.name from public.programme_sessions ps join public.programme_blocks b on b.id = ps.block_id join public.programme_exercises pe on pe.programme_session_id = ps.id join public.exercises e on e.id = pe.exercise_id where b.programme_id = $1`, [programmeId]);
    for (const r of rows) { const kind = r.day_number === 2 ? 'lower' : 'upper'; const key = `${r.block}:${r.week_number}:${kind}`; programmeSession[key] ??= { id: r.id, exercises: {} }; programmeSession[key].exercises[r.name] = r.pe_id; }
  }
  let rehabProgrammeId = (await one(`select id from public.programmes where org_id = $1 and programme_type = 'rehab' and deleted_at is null order by created_at limit 1`, [ORG]))?.id;
  if (!rehabProgrammeId) { rehabProgrammeId = uuid('programme:rehab'); await c.query(`insert into public.programmes (id, org_id, name, programme_type, description, duration_weeks, status, created_by) values ($1, $2, 'Return to running', 'rehab', 'Hamstring return-to-run progression', 6, 'active', $3)`, [rehabProgrammeId, ORG, staff.medic]); await c.query(`insert into public.programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks, focus) values ($1, $2, $3, 'Return to running', 1, 6, 'Progressive running load')`, [uuid('block:rehab'), ORG, rehabProgrammeId]); note('rehab programme created', 1); }
  const testId = {};
  let sort = 0;
  for (const [nm, cat, unit, higher, attempts, dp] of TESTS) {
    sort += 1;
    const row = await one(`select id from public.test_definitions where org_id = $1 and name = $2 and deleted_at is null`, [ORG, nm]);
    testId[nm] = row?.id ?? (await one(`insert into public.test_definitions (id, org_id, name, test_category, unit, higher_is_better, default_attempts, decimal_places, sort_order) values ($1, $2, $3, $4::test_category, $5, $6, $7, $8, $9) returning id`, [uuid(`test:${nm}`), ORG, nm, cat, unit, higher, attempts, dp, sort])).id;
  }
  if (!(await one(`select 1 from public.nutrition_targets where org_id = $1 and org_default and deleted_at is null and effective_to is null and md_offset is null`, [ORG]))) { await c.query(`insert into public.nutrition_targets (id, org_id, org_default, energy_kcal, protein_g, carbs_g, fat_g, fluid_ml, effective_from, created_by) values ($1, $2, true, 3200, 160, 400, 90, 3000, $3, $4)`, [uuid('nt:default'), ORG, W0, staff.nut]); note('nutrition default created', 1); }

  /* The club's name. */
  await c.query(`update public.organisations set name = $2 where id = $1 and name <> $2`, [ORG, CLUB]);
  note('club named', 1);

  /* Consent: the demo athletes are through the flow. */
  const cr = await c.query(`update public.athletes set consent_given_at = ($2::timestamp at time zone $3), consent_version = $4, health_consent_given_at = ($2::timestamp at time zone $3), health_consent_version = $4 where org_id = $1 and deleted_at is null and consent_given_at is null and consent_declined_at is null and consent_withdrawn_at is null`, [ORG, ts(addDays(W0, -3), '18:40'), TZ, CONSENT_VERSION]);
  note('consents recorded', cr.rowCount);

  /* Fixtures and sessions. */
  note('fixtures', await bulk('fixtures', ['id', 'org_id', 'season_id', 'opponent', 'kickoff_at', 'venue', 'home_away', 'competition', 'importance', 'status', 'result', 'created_by'], ['uuid', 'uuid', 'uuid', 'text', 'timestamp', 'text', 'home_away', 'text', 'fixture_importance', 'fixture_status', 'text', 'uuid'],
    FIXTURES.map((f) => [f.id, ORG, season.id, f.opponent, ts(f.date, f.kickoff), f.venue, f.homeAway, f.competition, f.importance, f.result ? 'played' : 'scheduled', f.result, staff.coach])));
  note('sessions', await bulk('sessions', ['id', 'org_id', 'season_id', 'fixture_id', 'session_type', 'title', 'starts_at', 'duration_min', 'location', 'md_offset', 'planned_rpe', 'planned_load', 'requires_wellness', 'requires_rpe', 'status', 'created_by'], ['uuid', 'uuid', 'uuid', 'uuid', 'session_type', 'text', 'timestamp', 'int', 'text', 'int', 'numeric', 'numeric', 'bool', 'bool', 'session_status', 'uuid'],
    sessions.map((s) => [s.id, ORG, season.id, s.fixtureId ?? null, s.type, s.title, ts(s.date, s.start), s.min, s.location, s.mdOffset, s.plannedRpe, s.plannedRpe * s.min, true, true, s.status, staff.ss])));
  const parts = [];
  for (const s of sessions) { if (s.participants === 'squad') { parts.push([uuid(`sp:${s.id}:F`), ORG, s.id, null, groups.Forwards]); parts.push([uuid(`sp:${s.id}:B`), ORG, s.id, null, groups.Backs]); } else for (const aid of s.participants) parts.push([uuid(`sp:${s.id}:${aid}`), ORG, s.id, aid, null]); }
  note('session participants', await bulk('session_participants', ['id', 'org_id', 'session_id', 'athlete_id', 'group_id'], ['uuid', 'uuid', 'uuid', 'uuid', 'uuid'], parts));

  /* Injuries, availability, rehab. */
  for (const inj of injuries) {
    await c.query(`insert into public.injuries (id, org_id, athlete_id, body_area, side, onset_date, status, expected_return, actual_return, session_id, occurred_in, reported_by, created_at) values ($1, $2, $3, $4::body_area, $5::body_side, $6, 'open', $7, $8, $9, $10::occurrence_context, $11, ($6::date::timestamp + interval '12 hours') at time zone $12)`, [inj.id, ORG, inj.athleteId, inj.bodyArea, inj.side, inj.onset, inj.expectedReturn, inj.actualReturn, inj.sessionId, inj.occurredIn, inj.reportedBy, TZ]);
    if (inj.status !== 'open') await c.query(`update public.injuries set status = $2::injury_status where id = $1`, [inj.id, inj.status]);
    const cl = inj.clinical;
    await c.query(`insert into public.injury_clinical (injury_id, org_id, diagnosis, mechanism, severity, tissue_type, imaging, referral, clinical_notes, treatment_plan, updated_by) values ($1, $2, $3, $4, $5::injury_severity, $6, $7, $8, $9, $10, $11)`, [inj.id, ORG, cl.diagnosis, cl.mechanism, cl.severity, cl.tissue, cl.imaging, cl.referral, cl.notes, cl.plan, staff.medic]);
    await c.query(`insert into public.injury_protocols (injury_id, org_id, total_stages, opened_by, opened_at, current_stage) values ($1, $2, $3, $4, ($5::timestamp at time zone $6), $7)`, [inj.id, ORG, inj.protocol.total, staff.medic, ts(addDays(inj.onset, 1), '09:00'), TZ, inj.protocol.current]);
  }
  note('injuries', injuries.length);
  for (const ev of stageEvents) await c.query(`insert into public.injury_stage_events (id, org_id, injury_id, from_stage, to_stage, moved_by, moved_at, restriction_line, criteria_reviewed, reason) values ($1, $2, $3, $4, $5, $6, ($7::timestamp at time zone $8), $9, true, $10)`, [uuid(`stage:${ev.injuryId}:${ev.to}`), ORG, ev.injuryId, ev.from, ev.to, ev.by, ev.at, TZ, ev.line, ev.reason]);
  note('stage events', stageEvents.length);
  /* athlete_seen_at: a status that has stood for more than two days has been
     seen — the "your status changed" card on Today is for this week's change,
     not the window's first Monday. */
  note('availability', await bulk('availability', ['id', 'org_id', 'athlete_id', 'status', 'restrictions', 'reason_category', 'injury_id', 'effective_from', 'effective_to', 'set_by', 'note', 'athlete_seen_at'], ['uuid', 'uuid', 'uuid', 'availability_status', 'text[]', 'availability_reason', 'uuid', 'timestamp', 'timestamp', 'uuid', 'text', 'timestamp'],
    availability.map((r, i) => [uuid(`avail:${r.athleteId}:${i}`), ORG, r.athleteId, r.status, r.restrictions, r.reason, r.injuryId, ts(r.from, '08:00'), r.to ? ts(r.to, '08:00') : null, r.setBy, r.note, r.from < addDays(today, -2) ? ts(addDays(r.from, 1), '07:45') : null])));
  note('rehab memberships', await bulk('group_memberships', ['id', 'org_id', 'group_id', 'athlete_id', 'added_at', 'removed_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'timestamp', 'timestamp'], rehabMembers.map((m) => [uuid(`rehabm:${m.athleteId}:${m.added}`), ORG, groups.Rehab, m.athleteId, ts(m.added, '09:00'), m.removed ? ts(m.removed, '09:00') : null])));
  note('rehab assignments', await bulk('rehab_assignments', ['id', 'org_id', 'athlete_id', 'rehab_group_id', 'phase', 'effective_from', 'effective_to', 'set_by'], ['uuid', 'uuid', 'uuid', 'uuid', 'text', 'timestamp', 'timestamp', 'uuid'], rehabMembers.map((m) => [uuid(`rehaba:${m.athleteId}:${m.added}`), ORG, m.athleteId, groups.Rehab, m.athleteId === cast.injuryBack.id ? 'Return to running' : m.athleteId === cast.injuryOut.id ? 'Protect and unload' : 'Cleared', ts(m.added, '09:00'), m.removed ? ts(m.removed, '09:00') : null, staff.medic])));
  /* Programme assignments with real start dates: the squad on the strength
     programme from the window's first Monday (both positional groups), the
     returning athlete on the rehab programme from his second week out. */
  await c.query(`insert into public.programme_assignments (id, org_id, programme_id, group_id, starts_on, status, assigned_by, created_at) values ($1, $2, $3, $4, $5, 'active', $6, ($7::timestamp at time zone $8)), ($9, $2, $3, $10, $5, 'active', $6, ($7::timestamp at time zone $8))`, [uuid('pa:forwards'), ORG, programmeId, groups.Forwards, W0, staff.sc, ts(addDays(W0, -3), '12:00'), TZ, uuid('pa:backs'), groups.Backs]);
  await c.query(`insert into public.programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status, assigned_by, injury_id, created_at) values ($1, $2, $3, $4, $5, 'active', $6, $7, ($8::timestamp at time zone $9))`, [uuid('pa:rehab'), ORG, rehabProgrammeId, cast.injuryBack.id, addDays(W0, 5 * 7), staff.medic, injuries[0].id, ts(addDays(W0, 5 * 7 - 2), '10:00'), TZ]);
  note('programme assignments', 3);

  /* Team allocation: the 23 of each of the last two matches (published), and
     this week's wider squad for Saturday — the available 23 published to the
     1st XV, the returning athlete named in the wider squad with the reason,
     the rest a 2nd XV draft the athletes cannot read. */
  const teams = await q(`select id, rank from public.teams where org_id = $1 and status = 'active' order by rank`, [ORG]);
  const firstXV = teams[0]?.id, secondXV = teams[1]?.id ?? teams[0]?.id;
  const alloc = [];
  if (firstXV) {
    for (const f of FIXTURES.filter((x) => x.result && x.w >= 9)) { const wk = addDays(f.date, -5); for (const p of participation.filter((x) => x.fixtureId === f.id)) alloc.push([uuid(`ta:${wk}:${p.athleteId}`), ORG, firstXV, p.athleteId, season.id, wk, f.id, 'published', 'manual', 'available', null, ts(addDays(wk, 3), '17:00'), staff.coach, staff.coach]); }
    const thisFx = FIXTURES.find((x) => x.w === 11);
    const fit = athletes.filter((a) => availAt(a.id, monday0).status === 'available');
    const fw = fit.filter((a) => inGroup(a.id, 'Forwards')), bk = fit.filter((a) => !inGroup(a.id, 'Forwards'));
    const squad23 = new Set([...fw.slice(0, 13), ...bk.slice(0, 10)].map((a) => a.id));
    for (const a of athletes) {
      const av = availAt(a.id, monday0);
      if (av.status === 'unavailable') continue;
      if (squad23.has(a.id)) alloc.push([uuid(`ta:${monday0}:${a.id}`), ORG, firstXV, a.id, season.id, monday0, thisFx.id, 'published', 'manual', 'available', null, ts(monday0, '17:30'), staff.coach, staff.coach]);
      else if (av.status === 'modified') alloc.push([uuid(`ta:${monday0}:${a.id}`), ORG, firstXV, a.id, season.id, monday0, thisFx.id, 'published', 'manual', 'modified', 'Named in the wider squad, availability reviewed Thursday', ts(monday0, '17:30'), staff.coach, staff.coach]);
      else alloc.push([uuid(`ta:${monday0}:${a.id}`), ORG, secondXV, a.id, season.id, monday0, null, 'draft', 'manual', 'available', null, null, null, staff.coach]);
    }
  }
  note('team allocations', await bulk('team_allocations', ['id', 'org_id', 'team_id', 'athlete_id', 'season_id', 'week_start', 'fixture_id', 'status', 'source', 'availability_at_allocation', 'override_reason', 'published_at', 'published_by', 'created_by'], ['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'date', 'uuid', 'team_allocation_status', 'team_allocation_source', 'availability_status', 'text', 'timestamp', 'uuid', 'uuid'], alloc));

  /* Match sheets, attendance, ratings, GPS. */
  note('match sheet rows', await bulk('match_participation', ['id', 'org_id', 'fixture_id', 'athlete_id', 'started', 'came_on', 'minutes', 'recorded_by', 'recorded_at', 'updated_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'bool', 'bool', 'int', 'uuid', 'timestamp', 'timestamp'], participation.map((p) => { const at = ts(FIXTURES.find((f) => f.id === p.fixtureId).date, '18:30'); return [uuid(`mp:${p.fixtureId}:${p.athleteId}`), ORG, p.fixtureId, p.athleteId, p.started, p.cameOn, p.minutes, staff.coach, at, at]; })));
  note('attendance', await bulk('session_attendance', ['id', 'org_id', 'session_id', 'athlete_id', 'attendance', 'modified_reason', 'recorded_by', 'recorded_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'attendance_status', 'text', 'uuid', 'timestamp'], attendance.map((x) => [uuid(`att:${x.sessionId}:${x.athleteId}`), ORG, x.sessionId, x.athleteId, x.status, x.reason, staff.coach, x.recordedAt])));
  note('training entries', await bulk('training_entries', ['id', 'org_id', 'athlete_id', 'session_id', 'entry_date', 'rpe', 'duration_min', 'submitted_at', 'created_by', 'created_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'date', 'numeric', 'int', 'timestamp', 'uuid', 'timestamp'], entries.map((e) => [uuid(`te:${e.sessionId}:${e.athleteId}`), ORG, e.athleteId, e.sessionId, e.date, e.rpe, e.min, e.submittedAt, e.createdBy, e.submittedAt])));
  note('gps records', await bulk('gps_records', ['id', 'org_id', 'athlete_id', 'session_id', 'record_date', 'vendor', 'device_id', 'duration_s', 'total_distance_m', 'high_speed_distance_m', 'sprint_distance_m', 'high_intensity_efforts', 'max_speed_ms', 'accelerations', 'decelerations', 'player_load', 'source'], ['uuid', 'uuid', 'uuid', 'uuid', 'date', 'text', 'text', 'int', 'numeric', 'numeric', 'numeric', 'int', 'numeric', 'int', 'int', 'numeric', 'data_source'], gps.map((g) => [uuid(`gps:${g.sessionId}:${g.athleteId}`), ORG, g.athleteId, g.sessionId, g.date, 'Catapult', g.device, g.durationS, g.td, g.hsr, g.sprint, g.hie, g.maxSpeed, g.acc, g.dec, g.load, 'file_import'])));

  /* Wellness, weigh-ins, nutrition, tests. */
  note('wellness entries', await bulk('wellness_entries', ['id', 'org_id', 'athlete_id', 'entry_date', 'sleep_hours', 'sleep_quality', 'fatigue', 'soreness', 'soreness_areas', 'stress', 'mood', 'resting_hr', 'comment', 'submitted_at', 'created_by', 'created_at'], ['uuid', 'uuid', 'uuid', 'date', 'numeric', 'int', 'int', 'int', 'text[]', 'int', 'int', 'int', 'text', 'timestamp', 'uuid', 'timestamp'], wellness.map((w) => [uuid(`we:${w.athleteId}:${w.date}`), ORG, w.athleteId, w.date, w.sleepHours, w.sleepQuality, w.fatigue, w.soreness, w.areas, w.stress, w.mood, w.restingHr, w.comment, w.submittedAt, w.createdBy, w.submittedAt])));
  note('weigh-ins', await bulk('body_composition', ['id', 'org_id', 'athlete_id', 'measured_on', 'body_mass_kg', 'body_fat_pct', 'sum_skinfolds_mm', 'method', 'recorded_by', 'created_at'], ['uuid', 'uuid', 'uuid', 'date', 'numeric', 'numeric', 'numeric', 'text', 'uuid', 'timestamp'], weighIns.map((b) => [uuid(`bc:${b.athleteId}:${b.date}`), ORG, b.athleteId, b.date, b.mass, b.fat, b.skin, b.method, b.recordedBy, ts(b.date, '07:20')])));
  note('athlete devices', await bulk('athlete_devices', ['id', 'org_id', 'athlete_id', 'platform', 'display_mode', 'push_supported', 'first_seen_at', 'last_seen_at'], ['uuid', 'uuid', 'uuid', 'text', 'text', 'boolean', 'timestamp', 'timestamp'],
    devices.map((d) => [uuid(`dev:${d.athleteId}:${d.platform}:${d.mode}`), ORG, d.athleteId, d.platform, d.mode, d.push, ts(d.first, '07:40'), ts(d.last, '07:55')])));
  note('nutrition check-ins', await bulk('nutrition_checkins', ['id', 'org_id', 'athlete_id', 'week_start', 'iso_year', 'iso_week', 'answer', 'note', 'submitted_at', 'created_by', 'created_at'], ['uuid', 'uuid', 'uuid', 'date', 'int', 'int', 'nutrition_checkin_answer', 'text', 'timestamp', 'uuid', 'timestamp'], nutrition.map((n) => { const d = toDate(n.weekStart); const thu = new Date(d.getTime() + 3 * dayMs); const y = thu.getUTCFullYear(); const wk = Math.ceil(((thu - Date.UTC(y, 0, 1)) / dayMs + 1) / 7); return [uuid(`nc:${n.athleteId}:${n.weekStart}`), ORG, n.athleteId, n.weekStart, y, wk, n.answer, n.note, n.submittedAt, n.createdBy, n.submittedAt]; })));
  note('test results', await bulk('test_results', ['id', 'org_id', 'athlete_id', 'test_definition_id', 'session_id', 'test_date', 'value', 'attempt_number', 'recorded_by', 'created_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'date', 'numeric', 'int', 'uuid', 'timestamp'], testResults.map((t) => [uuid(`tr:${t.sessionId}:${t.athleteId}:${t.test}:${t.attempt}`), ORG, t.athleteId, testId[t.test], t.sessionId, t.date, t.value, t.attempt, t.recordedBy, ts(t.date, '11:30')])));

  /* Gym logs: the log open, its sets, then closed — the guard refuses a set on a closed log. */
  note('gym logs', await bulk('gym_session_logs', ['id', 'org_id', 'athlete_id', 'programme_session_id', 'session_id', 'entry_date', 'started_at', 'completed_at', 'session_rpe', 'total_volume_kg', 'status', 'created_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'date', 'timestamp', 'timestamp', 'numeric', 'numeric', 'gym_log_status', 'timestamp'], gymLogs.map((g) => [g.id, ORG, g.athleteId, programmeSession[`${g.block}:${g.weekIn}:${g.kind}`]?.id ?? null, g.sessionId, g.date, g.startedAt, g.completedAt, g.rpe, g.sets.reduce((n, s) => n + (s.volume ?? 0), 0), 'in_progress', g.startedAt])));
  const setRows = [];
  for (const g of gymLogs) for (const s of g.sets) setRows.push([uuid(`set:${g.id}:${s.exercise}:${s.setNumber}`), ORG, g.id, programmeSession[`${g.block}:${g.weekIn}:${g.kind}`]?.exercises[s.exercise] ?? null, exerciseId[s.exercise], s.setNumber, s.reps, s.load, s.rpe, s.prescribedReps, s.prescribedLoad, s.step, ts(g.date, addHm(g.startedAt.slice(11), 4 * s.setNumber + (PLAN[g.kind].findIndex((p) => p[0] === s.exercise) * 12)))]);
  note('gym sets', await bulk('gym_set_logs', ['id', 'org_id', 'gym_session_log_id', 'programme_exercise_id', 'exercise_id', 'set_number', 'reps_completed', 'load_kg', 'rpe', 'prescribed_reps', 'prescribed_load_kg', 'prescribed_step_kg', 'logged_at'], ['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'int', 'int', 'numeric', 'numeric', 'int', 'numeric', 'numeric', 'timestamp'], setRows));
  await c.query(`update public.gym_session_logs set status = 'complete' where org_id = $1 and status = 'in_progress'`, [ORG]);

  /* Expectations from the schedule, then waived where the athlete was unavailable. */
  let exp = 0;
  for (const d of days) { if (d > addDays(today, 1)) break; exp += (await one(`select public.generate_compliance_expectations($1, $2::date) as n`, [ORG, d])).n; }
  note('compliance expectations', exp);
  const waived = [];
  for (const r of availability.filter((x) => x.status === 'unavailable')) waived.push(r);
  let nw = 0;
  for (const r of waived) { const res = await c.query(`update public.compliance_expectations set is_required = false, waived_reason = $4 where org_id = $1 and athlete_id = $2 and expectation_date >= $3::date and expectation_date < coalesce($5::date, expectation_date + 1) and is_required`, [ORG, r.athleteId, r.from, r.reason === 'illness' ? 'Unavailable — ill' : 'Unavailable — injured', r.to]); nw += res.rowCount; }
  note('expectations waived', nw);

  /* The engine, day by day, and each day's flags dated to the morning they
     would have been raised (04:30 local the next day), so cooldowns and the
     "unreviewed for N days" lines read as history rather than as tonight. */
  let flagsRaised = 0;
  for (const d of days) {
    if (d < addDays(W0, 14) || d >= today) continue;
    const n = (await one(`select public.evaluate_daily_thresholds_for_org($1, $2::date) as n`, [ORG, d])).n;
    if (n > 0) await c.query(`update public.flags set raised_at = ($3::timestamp at time zone $4), created_at = ($3::timestamp at time zone $4) where org_id = $1 and flag_date = $2::date and raised_at > ($5::timestamptz)`, [ORG, d, ts(addDays(d, 1), '04:30'), TZ, now]);
    flagsRaised += n;
  }
  note('flags raised by the engine', flagsRaised);
  /* Staff have been reading the flags: everything older than ten days is
     acknowledged, most of it with an action; the last ten days are as the
     nightly left them. */
  const old = await q(`select id, domain, metric, raised_at, athlete_id from public.flags where org_id = $1 and flag_date < $2::date`, [ORG, addDays(today, -10)]);
  for (const f of old) {
    const by = f.domain === 'nutrition' ? staff.nut : f.domain === 'gps' || f.metric === 'load.acwr' ? staff.sc : staff.ss;
    await c.query(`update public.flags set status = 'acknowledged', acknowledged_at = raised_at + interval '9 hours', acknowledged_by = $2, athlete_visible_at = raised_at + interval '9 hours' where id = $1`, [f.id, by]);
    if (rand(`fa:${f.id}`) < 0.7) await c.query(`insert into public.flag_actions (id, org_id, flag_id, action_type, note, taken_by, taken_at) values ($1, $2, $3, $4::flag_action_type, $5, $6, $7::timestamptz + interval '10 hours')`, [uuid(`fa:${f.id}`), ORG, f.id, f.metric === 'load.acwr' ? 'load_adjusted' : f.metric === 'compliance.wellness_7d' ? 'athlete_spoken_to' : pick(`fat:${f.id}`, ['athlete_spoken_to', 'note', 'note']), f.metric === 'load.acwr' ? 'Volume trimmed for the rest of the week' : f.metric === 'compliance.wellness_7d' ? 'Reminded after training' : pick(`fan:${f.id}`, ['Spoke after the session — fine', 'Watching this week', 'Recovery day added']), by, f.raised_at]);
  }
  note('older flags acknowledged', old.length);
  /* And what was acted on three weeks ago is closed: resolved, with the date. */
  const res = await c.query(`update public.flags set status = 'resolved', resolved_at = acknowledged_at + interval '3 days' where org_id = $1 and status = 'acknowledged' and flag_date < $2::date`, [ORG, addDays(today, -21)]);
  note('flags resolved', res.rowCount);

  /* Flush the deferred constraint checks (the revision chains' FKs) so the
     triggers can be stood back up inside the same transaction. */
  await c.query('set constraints all immediate');
  for (const t of trig) await c.query(`alter table public.${t.relname} enable trigger ${t.tgname}`);
  const still = await disabledTriggers();
  if (still.length > 0) throw new Error(`a trigger is still disabled before commit: ${still.map((t) => `${t.relname}.${t.tgname}`).join(', ')}`);
  await c.query('commit');
} catch (err) {
  await c.query('rollback');
  console.error('\nFAILED — rolled back, nothing changed:', err.message, err.detail ?? '');
  const after = await disabledTriggers();
  console.error(after.length === 0 ? 'triggers: all enabled (the rollback restored them)' : `TRIGGERS STILL DISABLED — investigate: ${after.map((t) => `${t.relname}.${t.tgname}`).join(', ')}`);
  await c.end();
  process.exit(1);
}
{
  const after = await disabledTriggers();
  if (after.length > 0) { console.error(`TRIGGERS STILL DISABLED AFTER COMMIT — investigate before doing anything else: ${after.map((t) => `${t.relname}.${t.tgname}`).join(', ')}`); await c.end(); process.exit(2); }
  console.log('\ntriggers: every trigger on public tables is enabled (checked in the catalogue after the commit)');
}

console.log(`\nWRITTEN in ${Math.round((Date.now() - t0) / 1000)}s`);
for (const [k, v] of Object.entries(written)) console.log(`  ${k}: ${v}`);
const flagSummary = await q(`select metric, status, count(*)::int n from public.flags where org_id = $1 group by 1, 2 order by 1, 2`, [ORG]);
console.log('\nFLAGS NOW');
for (const f of flagSummary) console.log(`  ${f.metric} ${f.status} ${f.n}`);
const narrativeFlags = await q(`select a.first_name || ' ' || a.last_name as who, f.metric, f.flag_date::text, f.status from public.flags f join public.athletes a on a.id = f.athlete_id where f.org_id = $1 and f.athlete_id = any($2::uuid[]) and f.flag_date >= $3::date order by f.flag_date desc`, [ORG, [cast.spike.id, cast.mass.id, cast.complianceFall.id, cast.shortSleep.id], addDays(today, -14)]);
console.log('\nTHE NARRATIVES\' OWN FLAGS (last 14 days)');
for (const f of narrativeFlags) console.log(`  ${f.who} · ${f.metric} · ${f.flag_date} · ${f.status}`);
await c.end();
