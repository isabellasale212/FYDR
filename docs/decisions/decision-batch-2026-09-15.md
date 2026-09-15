# Decision batch, 15 September 2026 (morning)

Isabella's rulings on the six things the overnight report raised.

**1. The database rule stands: only medical staff set injury-linked
availability.** The PATTERN-S3 board draws a coach's pitch-side form carrying
availability and restrictions. It is wrong and gets corrected; the code does not.

Reasoning: the person standing over an injured player is the medic, not the
coach, and "unavailable because of an injury" is a medical judgement wearing an
availability label. If a coach can make it, the clinical boundary protected
everywhere else has a door in it at exactly the moment someone is hurt. The
coach keeps non-injury absences, unchanged. ⚠ permissions, resolved in favour of
the existing policy (`availability_medical_insert`; 0042 requires `injury_id`
null for the coach).

**2. Fix the nutritionist's false flag sentence.** They cannot read thresholds,
deliberately, and the code reads an empty result as deletion, so every flag on an
athlete's profile tells them "The threshold this flag was raised under is no
longer on record." The rule IS on record. Tell the two states apart: say nothing,
or say it is not visible to this role, and say it is gone only when it is gone.
Same class as the audit log claiming it was blind when it was not.

**3. Build a not-found screen for both shells.** Next's default is black text on
the athlete app's dark ground at 1.23:1, which is invisible. It needs readable
text in both themes and honest wording: it catches both a deleted thing and a
thing belonging to another athlete, and the second case stays deliberately vague,
following the rule already set for session-not-found.

**4. The access matrix is corrected to match the database, not the reverse.** A
medic has been able to define a test since `0024` while the matrix says view
only. Return-to-play testing is a medic's work, a test definition is not clinical
data, and forcing the physio to ask the sport scientist for a hop test is
friction with no safety benefit. Record why, so the divergence reads as a
decision rather than a drift.

**5. Fix the flaking pgTAP test** (`690_preview_threshold_rule_test.sql`). It
goes red between 23:00 and midnight UK time because the fixture is dated in UTC
while the code counts days in British local time. A test that fails for reasons
unrelated to the code is worse than no test: people learn to ignore it, and then
ignore it on the night it is right.

**6. The read-only rule for a rated session applies on the schedule grid too.**
B6 was built on the session screen and the grid still edits a rated session by
drag. A rule that holds on one screen and not the other is worse than no rule,
because a coach told they cannot edit will assume they cannot, and then will.
Same rule, same wording.
