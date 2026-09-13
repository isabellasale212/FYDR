/* Children's Code default 2 (Isabella, 2026-09-13): reminders default off,
 * for everybody. Every disableable notification defaults off; the
 * undisableable P1 notices keep their channels on; stored rows are
 * untouched because null means inherit. */
import { readFileSync } from 'node:fs';
import { ATHLETE_CATALOGUE, STAFF_CATALOGUE } from '@/lib/notifications/catalogue';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the catalogue');
{
  const all = [...ATHLETE_CATALOGUE, ...STAFF_CATALOGUE];
  const disableableOn = all.filter((e) => e.canDisable && (e.defaultOn.push === true || e.defaultOn.email === true));
  assert(disableableOn.length === 0, `no disableable notification defaults on (${disableableOn.map((e) => e.id).join(', ') || 'none'})`);
  const undisableable = all.filter((e) => !e.canDisable);
  assert(undisableable.map((e) => e.id).sort().join(',') === 'athlete.availability.changed,athlete.consent.required,staff.consent.declined,staff.flag.escalation,staff.injury.reported', 'the five undisableable notices are exactly the P1 set');
  assert(undisableable.every((e) => e.channels.every((c) => e.defaultOn[c] === true)), 'and each keeps every channel on — notices, not reminders');
  const reminders = ['athlete.wellness.prompt', 'athlete.wellness.nudge', 'athlete.rpe.prompt', 'athlete.rpe.nudge', 'athlete.nutrition.checkin'];
  assert(reminders.every((id) => ATHLETE_CATALOGUE.find((e) => e.id === id)?.defaultOn.push === false), 'the five reminders are off');
  assert(ATHLETE_CATALOGUE.filter((e) => e.minorFloorOff).every((e) => e.defaultOn.push === false), 'the minor-floored rows stay off');
}

console.log('\n2. stored rows are untouched');
{
  const form = strip(read('src/components/NotificationPreferencesForm/NotificationPreferencesForm.tsx'));
  assert(/if \(stored !== null && stored !== undefined\) return stored;\s*return entry\.defaultOn\[channel\] \?\? false;/.test(form), 'an explicit stored choice wins; null inherits the catalogue default');
  const mig = read('supabase/migrations/0008_notification_preferences_and_push_tokens.sql');
  assert(/push_enabled\s+boolean/.test(mig) && !/push_enabled\s+boolean\s+not null default/.test(mig), 'push_enabled is nullable with no column default — no migration was needed');
  assert(/CHILDREN'S CODE DEFAULT 2/.test(read('src/lib/notifications/catalogue.ts')) && /default 2/.test(read('docs/08-notifications.md')), 'the catalogue and the doc record the rule');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
