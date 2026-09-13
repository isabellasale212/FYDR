# Why a destination is absent: three reasons, three appearances

**Decided 13 September 2026, extending D-20.** Raised by the design manager
while revising S10: the seventh report created a third reason a destination can
be missing, and if all three read the same way a coach concludes the product is
broken, while the one they could fix themselves is the one they never discover.

| Reason | What the user sees |
|---|---|
| **Premium, and the club is on free** | Gone entirely. Absent from the sidebar, refuses at the URL. A premium REGION inside an otherwise-free page still shows an upsell card and never vanishes silently. This is D-20, unchanged. |
| **A club setting is switched off** | The destination STAYS. It carries an off state naming the setting, what it would show, and who can change it. This is the only thing that tells an administrator a switch exists. |
| **It exists and nothing has been recorded yet** | Empty state as the constitution requires: the denominator, "nothing is missing", and where the data enters. |

**The immediate consequence:** the RPE-load report appears in the navigation for
a club with RPE switched off, carrying its off state. It is not hidden. Hiding
it would remove the only place an admin learns the setting exists.

**The general rule:** absence caused by what a club has BOUGHT is silent.
Absence caused by what a club has CHOSEN is visible and reversible from where it
is noticed. Absence caused by what a club has not yet DONE says so and points at
the door.
