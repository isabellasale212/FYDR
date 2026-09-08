/* Me, rebuilt from the redesign screenshots (11 and 12).
 *
 * WHAT THE REFERENCE ACTUALLY CHANGES is smaller than the changelog claims. The
 * changelog says the theme selector and the two stat cards are replaced by a
 * settings card; the screenshots KEEP the theme selector and KEEP both stat
 * cards, and those already exist in the build. So this is three removals, one
 * new card, and two controls becoming pills.
 *
 * TWO ITEMS IN THE REFERENCE COLLIDE WITH DECISIONS TAKEN THE SAME DAY, and
 * both are resolved conservatively here — do not add what a decision said to
 * hide, do not remove what a decision said an athlete may do. Each is one line
 * to flip if Isabella overrides.
 *
 *   APPLE HEALTH. Q-03 was confirmed on 2026-09-08: "hide it until ingestion
 *   exists. There is no native app to read HealthKit from at all today, so the
 *   toggle cannot mislead an athlete more cheaply than by removing it." That
 *   decision was never implemented — the marketing card is still on screen. The
 *   reference removes that card and then adds an "Apple Health / Not connected"
 *   row, which is Q-03's SECOND option rather than the confirmed one. So the
 *   card goes and the row is not added: this finally implements Q-03.
 *
 *   THE PASSWORD FORM. The changelog removes it. Q-02, decided the same day,
 *   says an athlete "can change their own password and use the email-linked
 *   reset flow, and nothing else affecting the account itself" — password change
 *   is one of exactly two things they may do. Removing the form leaves only the
 *   forgot-password email, so an athlete who simply wants to change a password
 *   they know would have to pretend to have forgotten it. Kept, and flagged.
 *
 * THE FIRST PILLS LAND HERE, and are the first entries in ATHLETE_PILL_EXEMPT.
 */
import { readFileSync } from 'node:fs';
import { ATHLETE_PILL_EXEMPT, INTERACTIVE } from './check-control-radius';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const page = strip(readFileSync('src/app/(athlete)/me/page.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

console.log('what the reference keeps, and already existed');
{
  assert(/ThemeToggle/.test(page), 'the theme selector stays — the screenshots keep it');
  assert(/me-stats/.test(page), 'and both stat cards');
  assert(/entriesThisWeek/.test(page), 'wellness entries this week');
  assert(/latestMass/.test(page), 'and body mass');
}

console.log('\nthree removals');
{
  assert(!/AvatarUploadForm/.test(page), 'the photo and avatar-colour picker is gone');
  assert(!/AthleteProfileEditForm/.test(page), 'the profile edit form is gone');
  assert(!/health-title/.test(page), 'the Apple Health marketing card is gone');
  assert(!/fetchHealthkitConsent/.test(page), 'and its query is not left running');
}

console.log('\nthe settings card: three rows, not four');
{
  assert(/me-set/.test(page), 'the settings card exists');
  for (const row of ['Notifications', 'Leaderboard', 'Units']) {
    assert(new RegExp(row).test(page), `${row} row`);
  }
  /* Q-03, FINALLY IMPLEMENTED. Asserted as an absence because the reference
     draws the row and anybody working from the screenshots would add it. */
  assert(
    !/Apple Health/.test(page),
    'and NO Apple Health row — Q-03 confirmed hiding it until ingestion exists',
  );
}

console.log('\nthe values are read, not written into the markup');
{
  assert(/fetchMyNotificationPreferences|notificationPref/.test(page),
    'the notification state comes from notification_preferences');
  /* Both halves, because the age rule splits them: opt-outs decide it for an
     adult, the consent row decides it for a minor, and a page that read only
     one would state the wrong regime for half the squad. */
  assert(/fetchMyOptOuts/.test(page) && /fetchLeaderboardConsent/.test(page),
    'the leaderboard state is read from opt-outs AND from consent');
  assert(/isMinor\s*\?/.test(page), 'and the two are chosen between by age, as /me/leaderboards does');
  /* Units is the one static value on the card, and that is the honest rendering:
     there is no units preference in the schema, the app is kg and metres
     everywhere, and inventing a column to display a constant would be worse
     than displaying the constant. */
  assert(/kg · m|kg &middot; m/.test(page), 'and Units states the app\'s actual units');
}

console.log('\nQ-02 survives: an athlete can still change their own password');
{
  assert(
    /ChangePasswordForm/.test(page),
    'the password form is kept — Q-02 makes it one of two things an athlete may do to their account',
  );
}

console.log('\nthe first two pills, exempted by name rather than by changing the rule');
{
  assert(ATHLETE_PILL_EXEMPT.length >= 2, 'the exemption list has entries now');
  for (const name of ['sign-out', 'theme-seg-btn']) {
    assert(ATHLETE_PILL_EXEMPT.includes(name), `${name} is exempt by name`);
  }
  assert(/--r-full: 999px/.test(tokens), 'a 999px token exists for them');
  assert(/--r-pill:\s*20px/.test(tokens), 'and the existing --r-pill is still 20px, since three bar rules read it');
  for (const sel of ['.sign-out', '.theme-seg-btn']) {
    const rule = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    assert(/var\(--r-full\)/.test(rule), `${sel} uses --r-full`);
  }
  /* THE RULE STILL HOLDS EVERYWHERE ELSE. If the exemption list ever grows to
     cover the guard's whole INTERACTIVE net, the guard has stopped guarding. */
  assert(ATHLETE_PILL_EXEMPT.length <= 8,
    'and the list is still short — a long one means the rule has been abandoned rather than excepted');
  assert(INTERACTIVE.test('btn-primary'), 'the guard still recognises ordinary controls');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
