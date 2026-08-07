import { csvResponse, toCsv } from '@/lib/csv';
import { fetchMyDataExport } from '@/lib/queries/myDataExport';
import { recordReportView } from '@/lib/queries/reports';
import { requireAthlete } from '@/lib/session';

/** 09-security-and-compliance.md, Article 20. lib/queries/myDataExport.ts's
 *  header has the full scope reasoning: the portability set only (data the
 *  athlete provided), not the Article 15 "subject access request" pack an
 *  admin would generate — that needs the SAR pack's own withholding
 *  workflow (a physio marking specific clinical notes withheld with a
 *  recorded reason before release), which is a separate, real feature this
 *  pass does not build. This route is the smaller, athlete-initiated half
 *  of Article 20 only.
 *
 *  Six sections, one file — profile, wellness, training, gym sets,
 *  nutrition check-ins, nutrition targets — same multi-section CSV
 *  technique reports/athlete/[athleteId]/export/route.ts already uses.
 *  Logged to audit_log with reportType 'my_data', same as every other
 *  export this build makes: an athlete's own data leaving the system is
 *  still a disclosure worth a record, even when they're the one asking. */
export async function GET() {
  const { db, orgId, athleteId, claims } = await requireAthlete();

  const data = await fetchMyDataExport(db, orgId, athleteId);

  const profileCsv = data.profile
    ? toCsv(
        [
          {
            name: `${data.profile.first_name} ${data.profile.last_name}`,
            preferred_name: data.profile.preferred_name ?? '',
            date_of_birth: data.profile.date_of_birth ?? '',
            position: data.profile.position ?? '',
            squad_number: data.profile.squad_number ?? '',
            dominant_side: data.profile.dominant_side ?? '',
            height_cm: data.profile.height_cm ?? '',
          },
        ],
        [
          ['name', 'Name'],
          ['preferred_name', 'Preferred name'],
          ['date_of_birth', 'Date of birth'],
          ['position', 'Position'],
          ['squad_number', 'Squad number'],
          ['dominant_side', 'Dominant side'],
          ['height_cm', 'Height (cm)'],
        ],
      )
    : '';

  const wellnessCsv = toCsv(
    data.wellness.map((w) => ({
      date: w.entry_date,
      sleep_hours: w.sleep_hours ?? '',
      sleep_quality: w.sleep_quality ?? '',
      fatigue: w.fatigue ?? '',
      soreness: w.soreness ?? '',
      stress: w.stress ?? '',
      mood: w.mood ?? '',
      resting_hr: w.resting_hr ?? '',
      body_mass_kg: w.body_mass_kg ?? '',
      submitted_at: w.submitted_at ?? '',
    })),
    [
      ['date', 'Date'],
      ['sleep_hours', 'Sleep (hours)'],
      ['sleep_quality', 'Sleep quality (1-5)'],
      ['fatigue', 'Fatigue (1-5)'],
      ['soreness', 'Soreness (1-5)'],
      ['stress', 'Stress (1-5)'],
      ['mood', 'Mood (1-5)'],
      ['resting_hr', 'Resting HR'],
      ['body_mass_kg', 'Body mass (kg)'],
      ['submitted_at', 'Submitted at'],
    ],
  );

  const trainingCsv = toCsv(
    data.training.map((t) => ({
      date: t.entry_date,
      session: t.session_title ?? '',
      rpe: t.rpe,
      duration_min: t.duration_min,
      submitted_at: t.submitted_at ?? '',
    })),
    [
      ['date', 'Date'],
      ['session', 'Session'],
      ['rpe', 'RPE'],
      ['duration_min', 'Duration (min)'],
      ['submitted_at', 'Submitted at'],
    ],
  );

  const gymCsv = toCsv(
    data.gymSets.map((g) => ({
      date: g.entry_date,
      exercise: g.exercise_name,
      set_number: g.set_number,
      reps: g.reps_completed ?? '',
      load_kg: g.load_kg ?? '',
      rpe: g.rpe ?? '',
      side: g.side ?? '',
    })),
    [
      ['date', 'Date'],
      ['exercise', 'Exercise'],
      ['set_number', 'Set'],
      ['reps', 'Reps'],
      ['load_kg', 'Load (kg)'],
      ['rpe', 'RPE'],
      ['side', 'Side'],
    ],
  );

  const checkinCsv = toCsv(
    data.nutritionCheckins.map((c) => ({
      week_start: c.week_start,
      answer: c.answer,
      note: c.note ?? '',
      submitted_at: c.submitted_at ?? '',
    })),
    [
      ['week_start', 'Week starting'],
      ['answer', 'Fuelling the plan?'],
      ['note', 'Note'],
      ['submitted_at', 'Submitted at'],
    ],
  );

  const targetsCsv = toCsv(
    data.nutritionTargets.map((t) => ({
      from: t.effective_from,
      to: t.effective_to ?? 'current',
      energy_kcal: t.energy_kcal ?? '',
      protein_g: t.protein_g ?? '',
      carbs_g: t.carbs_g ?? '',
      fat_g: t.fat_g ?? '',
      fluid_ml: t.fluid_ml ?? '',
    })),
    [
      ['from', 'From'],
      ['to', 'To'],
      ['energy_kcal', 'Energy (kcal)'],
      ['protein_g', 'Protein (g)'],
      ['carbs_g', 'Carbs (g)'],
      ['fat_g', 'Fat (g)'],
      ['fluid_ml', 'Fluid (ml)'],
    ],
  );

  const caption =
    `# Your data, exported from Fydr. Everything you submitted yourself: profile, wellness ` +
    `check-ins, training ratings, gym sets, and nutrition check-ins and targets. This does not ` +
    `include flags, test results, or anything staff recorded about you — ask your club for ` +
    `that under a subject access request.\r\n\r\n`;

  const csv =
    caption +
    `# Profile\r\n${profileCsv}\r\n` +
    `# Wellness check-ins\r\n${wellnessCsv}\r\n` +
    `# Training ratings\r\n${trainingCsv}\r\n` +
    `# Gym sets\r\n${gymCsv}\r\n` +
    `# Nutrition check-ins\r\n${checkinCsv}\r\n` +
    `# Nutrition targets\r\n${targetsCsv}`;

  await recordReportView(db, orgId, claims.userId, 'athlete', 'my_data', { athlete_id: athleteId, format: 'csv' }, 'export');

  return csvResponse(csv, `my-fydr-data-${athleteId}.csv`);
}
