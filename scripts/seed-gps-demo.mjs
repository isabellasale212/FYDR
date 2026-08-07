// seed-gps-demo.mjs
//
// Generates plausible gps_records for every real training session in the
// last 28 days, for every athlete currently in a positional group. Stands in
// for the GPS import pipeline (07-integrations.md) migration 0023 explicitly
// does not build — there is no CSV upload or vendor-column-mapping UI yet, so
// this is currently the only way data reaches gps_records at all. Hard-codes
// Ashcombe's org id; point it at another organisation's id to reuse.
//
// Run: set -a && source .env.local && set +a && node scripts/seed-gps-demo.mjs

import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await client.connect();

const orgId = 'a0000000-0000-4000-8000-000000000001';

const sessRes = await client.query(
  `select id, starts_at::date as d from sessions where org_id=$1 and session_type='training' and starts_at >= now() - interval '28 days' order by starts_at`,
  [orgId],
);
const sessions = sessRes.rows;

const athRes = await client.query(
  `select a.id, gm.group_id from athletes a
   join group_memberships gm on gm.athlete_id=a.id and gm.removed_at is null
   join groups g on g.id=gm.group_id
   where a.org_id=$1 and g.group_type='positional' and a.status<>'left_club'`,
  [orgId],
);
const athletes = athRes.rows;

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

let inserted = 0;
for (const sess of sessions) {
  // Most sessions get most of the squad; a couple get a smaller subset, to
  // exercise the "24 of 28 with GPS data" footnote case honestly.
  const attending = Math.random() < 0.2 ? athletes.slice(0, 18) : athletes;
  for (const ath of attending) {
    const isForward = ath.group_id === '9509000a-0000-4000-8000-000000000001';
    const td = isForward ? rnd(4200, 7500) : rnd(5200, 8800);
    const run = td * rnd(0.28, 0.42);
    const hsr = isForward ? rnd(80, 700) : rnd(300, 1100);
    const sprint = hsr * rnd(0.15, 0.35);
    const hie = isForward ? Math.round(rnd(50, 140)) : Math.round(rnd(70, 170));
    const maxSpeedMs = isForward ? rnd(6.8, 8.6) : rnd(7.8, 9.6);
    const duration = Math.round(rnd(3200, 5400));

    await client.query(
      `insert into gps_records
         (org_id, athlete_id, session_id, record_date, vendor, duration_s,
          total_distance_m, running_distance_m, high_speed_distance_m, sprint_distance_m,
          high_intensity_efforts, max_speed_ms, accelerations, decelerations, source)
       values ($1,$2,$3,$4,'catapult',$5,$6,$7,$8,$9,$10,$11,$12,$13,'file_import')`,
      [
        orgId, ath.id, sess.id, sess.d, duration,
        Math.round(td * 10) / 10, Math.round(run * 10) / 10, Math.round(hsr * 10) / 10, Math.round(sprint * 10) / 10,
        hie, Math.round(maxSpeedMs * 100) / 100,
        Math.round(rnd(20, 60)), Math.round(rnd(18, 55)),
      ],
    );
    inserted += 1;
  }
}

console.log(`Inserted ${inserted} gps_records across ${sessions.length} sessions for ${athletes.length} athletes.`);
await client.end();
