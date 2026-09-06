/* Populate the areas supabase/seed.sql has never covered.
 *
 * seed.sql builds a realistic squad — athletes, wellness, sessions, injuries,
 * flags, availability — and stops there. Seven areas are left empty, so a
 * walkthrough of the app hits blank screens that look like bugs and are not:
 * gps_records, leaderboards, programmes, meal_library, nutrition_rules,
 * test_definitions and body_composition.
 *
 * GPS is handled by seed-gps-demo.mjs, which already existed. This covers the
 * other six.
 *
 * SCRATCH ONLY, asserted the same way reset-scratch.mjs asserts it: the URL must
 * name the scratch project and must not name production, and the database must
 * not contain o.hartnell. Populating production with invented meals and test
 * results would be a genuinely bad day.
 *
 * IDEMPOTENT. Every insert is `on conflict do nothing` against a deterministic
 * id, so running it twice changes nothing. That matters because a walkthrough
 * gets interrupted, and re-running should be safe rather than doubling
 * everything.
 *
 * The numbers are meant to be PLAUSIBLE rather than random: bench and squat
 * loads that suit a rugby forward pack, body mass that agrees with the weights
 * already in seed.sql's wellness rows, macro rules inside the check constraints
 * the schema actually enforces. Data that looks wrong is worse than no data,
 * because it makes every screen reading it look broken.
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { resolveDbUrl } from './lib/db-url.mjs';

const SCRATCH_REF = 'stfgzkuvczbpxyevxkak';
const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';
const ORG = 'a0000000-0000-4000-8000-000000000001';

const { url, via } = await resolveDbUrl({
  direct: process.env.SCRATCH_DB_URL,
  pooler: process.env.SCRATCH_DB_POOLER_URL,
  label: 'scratch',
});
if (!url.includes(SCRATCH_REF) || url.includes(PRODUCTION_REF)) {
  console.error('REFUSING: this is not the scratch project.');
  process.exit(1);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
await c.connect();
const { rows: [guard] } = await c.query(
  `select count(*)::int n from auth.users where email = 'o.hartnell@ashcomberfc.example'`);
if (guard.n > 0) {
  console.error('REFUSING: o.hartnell is present, which means this is production.');
  await c.end();
  process.exit(1);
}
console.log(`target: scratch, via ${via}\n`);

/* Deterministic ids so re-running is a no-op rather than a duplicate. */
const id = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return `${hex(h)}-0000-4000-8000-${hex(h).slice(0, 4)}${hex(h * 7)}`;
};

const one = async (q, p = []) => (await c.query(q, p)).rows[0];
const staff = await one(
  `select ur.user_id from public.user_roles ur where ur.role = 'sport_scientist'::app_role
     and ur.org_id = $1 limit 1`, [ORG]);
const coach = await one(
  `select ur.user_id from public.user_roles ur where ur.role = 'coach'::app_role and ur.org_id = $1 limit 1`, [ORG]);
const { rows: athletes } = await c.query(
  `select id, first_name, last_name, position, squad_number from athletes
    where org_id = $1 and deleted_at is null order by squad_number`, [ORG]);
const { rows: groups } = await c.query(
  `select id, name, group_type from groups where org_id = $1 and deleted_at is null order by name`, [ORG]);
console.log(`${athletes.length} athletes, ${groups.length} groups to work with`);

const counts = {};
const run = async (label, sql, params) => {
  const r = await c.query(sql, params);
  counts[label] = (counts[label] ?? 0) + (r.rowCount ?? 0);
};

/* ---------------------------------------------------------------- exercises */
const EXERCISES = [
  ['Back squat', 'squat'], ['Front squat', 'squat'], ['Romanian deadlift', 'hinge'],
  ['Trap bar deadlift', 'hinge'], ['Bench press', 'push'], ['Overhead press', 'push'],
  ['Weighted chin-up', 'pull'], ['Barbell row', 'pull'], ['Farmer carry', 'carry'],
  ['Power clean', 'olympic'], ['Box jump', 'plyo'], ['Pallof press', 'core'],
  ['Copenhagen plank', 'core'], ['Nordic curl', 'core'], ['Bike intervals', 'conditioning'],
];
for (const [name, category] of EXERCISES) {
  await run('exercises',
    `insert into exercises (id, org_id, name, category) values ($1,$2,$3,$4::exercise_category)
     on conflict (id) do nothing`, [id('ex-' + name), ORG, name, category]);
}

/* --------------------------------------------------------------- programmes */
const PROGRAMMES = [
  ['Pre-season strength', 'gym', 'active'],
  ['In-season maintenance', 'gym', 'active'],
  ['Hamstring return to play', 'rehab', 'active'],
  ['Aerobic base block', 'conditioning', 'draft'],
];
for (const [name, type, status] of PROGRAMMES) {
  const pid = id('prog-' + name);
  await run('programmes',
    `insert into programmes (id, org_id, name, programme_type, status, created_by)
     values ($1,$2,$3,$4::programme_type,$5::programme_status,$6) on conflict (id) do nothing`,
    [pid, ORG, name, type, status, staff.user_id]);

  for (let b = 1; b <= 2; b += 1) {
    const bid = id(`blk-${name}-${b}`);
    await run('programme_blocks',
      `insert into programme_blocks (id, org_id, programme_id, name, sequence)
       values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [bid, ORG, pid, b === 1 ? 'Accumulation' : 'Intensification', b]);

    for (let w = 1; w <= 2; w += 1) {
      const sid = id(`ps-${name}-${b}-${w}`);
      await run('programme_sessions',
        `insert into programme_sessions (id, org_id, block_id, name, week_number, sequence)
         values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
        [sid, ORG, bid, w === 1 ? 'Lower body' : 'Upper body', w, w]);

      const picks = w === 1 ? ['Back squat', 'Romanian deadlift', 'Nordic curl'] : ['Bench press', 'Barbell row', 'Pallof press'];
      let seq = 1;
      for (const ex of picks) {
        await run('programme_exercises',
          `insert into programme_exercises
             (id, org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max, load_basis, load_value)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::load_basis,$10) on conflict (id) do nothing`,
          [id(`pe-${name}-${b}-${w}-${ex}`), ORG, sid, id('ex-' + ex), seq, 4, 5, 8, 'percent_1rm', 75 + seq * 2]);
        seq += 1;
      }
    }
  }
}

/* ------------------------------------------------------------- meal library */
const MEALS = [
  ['Pre-match carb load', 'Lunch', [['White rice', 180, 'g'], ['Chicken breast', 200, 'g'], ['Olive oil', 10, 'ml']]],
  ['Recovery shake', 'Post-training', [['Whey protein', 40, 'g'], ['Semi-skimmed milk', 400, 'ml'], ['Banana', 1, 'ea']]],
  ['Match-day breakfast', 'Breakfast', [['Porridge oats', 100, 'g'], ['Honey', 20, 'g'], ['Greek yoghurt', 150, 'g']]],
  ['Travel snack', 'Snack', [['Malt loaf', 80, 'g'], ['Beef jerky', 50, 'g']]],
  ['Evening meal, heavy day', 'Dinner', [['Sweet potato', 300, 'g'], ['Salmon fillet', 220, 'g'], ['Broccoli', 150, 'g']]],
];
for (const [name, label, items] of MEALS) {
  const mid = id('meal-' + name);
  await run('meal_library',
    `insert into meal_library (id, org_id, name, time_label, created_by)
     values ($1,$2,$3,$4,$5) on conflict (id) do nothing`, [mid, ORG, name, label, staff.user_id]);
  for (const [item, qty, unit] of items) {
    await run('meal_library_items',
      `insert into meal_library_items (id, org_id, meal_id, name, qty, unit)
       values ($1,$2,$3,$4,$5,$6::meal_unit) on conflict (id) do nothing`,
      [id(`mli-${name}-${item}`), ORG, mid, item, qty, unit]);
  }
}

/* ----------------------------------------------------------- nutrition rules */
await run('nutrition_rules',
  `insert into nutrition_rules (id, org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg,
     fluid_ml_per_kg, energy_kcal_cap, effective_from, created_by)
   values ($1,$2,true,2.0,5.0,1.2,40,5200,current_date - 30,$3) on conflict (id) do nothing`,
  [id('rule-org-default'), ORG, staff.user_id]);
const forwards = groups.find((g) => /forward/i.test(g.name));
if (forwards) {
  await run('nutrition_rules',
    `insert into nutrition_rules (id, org_id, group_id, org_default, protein_g_per_kg, carb_g_per_kg,
       fat_g_per_kg, fluid_ml_per_kg, energy_kcal_cap, effective_from, created_by)
     values ($1,$2,$3,false,2.2,6.0,1.3,45,6000,current_date - 21,$4) on conflict (id) do nothing`,
    [id('rule-forwards'), ORG, forwards.id, staff.user_id]);
}

/* --------------------------------------------------------- test definitions */
const TESTS = [
  ['Back squat 1RM', 'strength', 'kg', true, true],
  ['Bench press 1RM', 'strength', 'kg', true, true],
  ['Countermovement jump', 'power', 'cm', true, true],
  ['10m sprint', 'speed', 's', false, true],
  ['40m sprint', 'speed', 's', false, true],
  ['Yo-yo IR1', 'endurance', 'm', true, true],
  ['Sit and reach', 'mobility', 'cm', true, true],
  ['Skinfolds, sum of 8', 'body_comp', 'mm', false, false],
];
for (const [name, category, unit, higherBetter, eligible] of TESTS) {
  await run('test_definitions',
    `insert into test_definitions (id, org_id, name, test_category, unit, higher_is_better, leaderboard_eligible)
     values ($1,$2,$3,$4::test_category,$5,$6,$7) on conflict (id) do nothing`,
    [id('td-' + name), ORG, name, category, unit, higherBetter, eligible]);
}

/* Results, so the testing screens have something to rank and trend. */
const RESULT_SHAPE = {
  'Back squat 1RM': [110, 200], 'Bench press 1RM': [80, 145], 'Countermovement jump': [32, 52],
  '10m sprint': [1.62, 1.95], '40m sprint': [4.9, 6.1], 'Yo-yo IR1': [1200, 2400],
  'Sit and reach': [8, 34], 'Skinfolds, sum of 8': [42, 96],
};
let resultCount = 0;
for (const [testName, [lo, hi]] of Object.entries(RESULT_SHAPE)) {
  for (const [i, a] of athletes.entries()) {
    for (const daysAgo of [90, 30]) {
      const drift = daysAgo === 30 ? 1.03 : 1;
      const v = +(lo + ((hi - lo) * ((i * 37) % 100)) / 100).toFixed(2) * drift;
      await c.query(
        `insert into test_results (id, org_id, athlete_id, test_definition_id, test_date, value, recorded_by, source)
         values ($1,$2,$3,$4,current_date - $5::int,$6,$7,'staff_entered') on conflict (id) do nothing`,
        [id(`tr-${testName}-${a.id}-${daysAgo}`), ORG, a.id, id('td-' + testName), daysAgo, +v.toFixed(2), staff.user_id]);
      resultCount += 1;
    }
  }
}
counts.test_results = resultCount;

/* -------------------------------------------------------- body composition */
let bcCount = 0;
for (const [i, a] of athletes.entries()) {
  const base = 82 + ((i * 13) % 40);
  /* Seven points, five of them inside the profile's 28-day window, because a
     single reading renders "not enough for a trend line" and the trend is the
     part worth looking at. Drifting slightly downward across the block, which is
     what a pre-season would actually show. */
  for (const daysAgo of [70, 56, 42, 28, 21, 14, 3]) {
    const mass = +(base + (70 - daysAgo) * -0.012 + ((i % 3) - 1) * 0.2).toFixed(1);
    await c.query(
      `insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, body_fat_pct, method, recorded_by)
       values ($1,$2,$3,current_date - $4::int,$5,$6,'skinfold',$7) on conflict (id) do nothing`,
      [id(`bc-${a.id}-${daysAgo}`), ORG, a.id, daysAgo, mass, +(9 + ((i * 7) % 9)).toFixed(1), staff.user_id]);
    bcCount += 1;
  }
}
counts.body_composition = bcCount;

/* ------------------------------------------------- programme assignments */
/* Without these every programme reads "0 athletes", which makes the screen look
   broken rather than empty. Assigned by GROUP where a sensible group exists and
   by athlete otherwise — the check constraint allows exactly one of the two, so
   this also exercises both branches of that rule. */
const positional = groups.filter((g) => g.group_type === 'positional');
const rehabGroup = groups.find((g) => g.group_type === 'rehab');
const ASSIGN = [
  ['Pre-season strength', positional[0]?.id ?? null, null],
  ['In-season maintenance', positional[1]?.id ?? positional[0]?.id ?? null, null],
  ['Aerobic base block', positional[2]?.id ?? positional[0]?.id ?? null, null],
];
for (const [prog, groupId] of ASSIGN) {
  if (!groupId) continue;
  await run('programme_assignments',
    `insert into programme_assignments (id, org_id, programme_id, group_id, starts_on, status, assigned_by)
     values ($1,$2,$3,$4,current_date - 14,'active',$5) on conflict (id) do nothing`,
    [id('pa-g-' + prog), ORG, id('prog-' + prog), groupId, staff.user_id]);
}
/* The rehab programme goes to the individuals actually carrying an injury,
   which is what makes the screen read like a real club rather than a fixture. */
const { rows: injured } = await c.query(
  `select distinct athlete_id from injuries where org_id = $1 and deleted_at is null
     and (actual_return is null or actual_return >= current_date) limit 4`, [ORG]);
for (const inj of injured) {
  await run('programme_assignments',
    `insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status, assigned_by)
     values ($1,$2,$3,$4,current_date - 7,'active',$5) on conflict (id) do nothing`,
    [id('pa-a-' + inj.athlete_id), ORG, id('prog-Hamstring return to play'), inj.athlete_id, staff.user_id]);
}

/* --------------------------------------------------- body-mass target ranges */
/* Without one the profile reads "No staff target range set", which is a real
   state but not an interesting one to walk through. Set around each athlete's
   own current mass rather than a single club-wide band, so the screen shows
   some athletes inside their range and some outside — which is the whole point
   of the panel. */
let rangeCount = 0;
for (const [i, a] of athletes.entries()) {
  const base = 82 + ((i * 13) % 40);
  const low = +(base - 2.5).toFixed(2);
  const high = +(base + 2.5).toFixed(2);
  const r = await c.query(
    `insert into body_mass_target_ranges (id, org_id, athlete_id, target_low_kg, target_high_kg, rationale, set_by, effective_from)
     values ($1,$2,$3,$4,$5,$6,$7,current_date - 30) on conflict (id) do nothing`,
    [id(`bmr-${a.id}`), ORG, a.id, low, high,
     i % 3 === 0 ? 'Holding front-row mass through pre-season.' : 'Maintain through the block.', staff.user_id]);
  rangeCount += r.rowCount ?? 0;
}
counts.body_mass_target_ranges = rangeCount;

/* ---------------------------------------------------------- nutrition targets */
/* The plan panel on a player profile reads "— kcal — protein g" until a target
   exists, and a row of dashes is the least informative thing a walkthrough can
   look at. Computed from the org-default rule against each athlete's own latest
   body mass, which is how assignPlan does it — so the numbers agree with the
   weigh-ins seeded above rather than being invented separately.
   
   nutrition_targets_one_live_per_scope allows one live row per athlete, so this
   is one row each and no history. Assigning a new plan through the app during
   the walkthrough will expire these and write the next one, which is the
   behaviour worth seeing. */
let targetCount = 0;
for (const a of athletes) {
  const mass = await one(
    `select body_mass_kg from body_composition where athlete_id = $1 and body_mass_kg is not null
      order by measured_on desc limit 1`, [a.id]);
  if (!mass?.body_mass_kg) continue;
  const kg = Number(mass.body_mass_kg);
  const protein = Math.round(kg * 2.0);
  const carbs = Math.round(kg * 5.0);
  const fat = Math.round(kg * 1.2);
  const kcal = Math.min(protein * 4 + carbs * 4 + fat * 9, 5200);
  const r = await c.query(
    `insert into nutrition_targets (id, org_id, athlete_id, org_default, energy_kcal, protein_g, carbs_g,
       fat_g, fluid_ml, reason, effective_from, created_by)
     values ($1,$2,$3,false,$4,$5,$6,$7,$8,'Seeded from the club default rule against the latest weigh-in.',
       current_date - 14, $9)
     on conflict (id) do nothing`,
    [id('nt-' + a.id), ORG, a.id, kcal, protein, carbs, fat, Math.round(kg * 40), staff.user_id]);
  targetCount += r.rowCount ?? 0;
}
counts.nutrition_targets = targetCount;

/* ------------------------------------------------------------- leaderboards */
const BOARDS = [
  ['Top speed, last 28 days', 'gps.max_speed_ms', 'best', 'squad', 'days', 28, 'published'],
  ['Total distance, season', 'gps.total_distance_m', 'total', 'squad', 'season', null, 'published'],
  ['Player load, last 14 days', 'gps.player_load', 'total', 'squad', 'days', 14, 'staff'],
  ['Readiness, last 7 days', 'wellness.readiness_score', 'mean', 'squad', 'days', 7, 'staff'],
  ['Sessions attended', 'training.sessions_attended', 'count', 'squad', 'season', null, 'published'],
];
for (const [name, metric, agg, pop, win, days, vis] of BOARDS) {
  await run('leaderboards',
    `insert into leaderboards (id, org_id, name, metric_key, aggregation, population_type, window_type,
       window_days, visibility, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (id) do nothing`,
    [id('lb-' + name), ORG, name, metric, agg, pop, win, days, vis, coach?.user_id ?? staff.user_id]);
}

console.log('inserted:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(22)} ${v}`);
await c.end();
process.exit(0);
