# System A adoption — the finished build, after only

**Rendered 15 September 2026 at commit `5e75013` (layers one, two and three of
`docs/decisions/design-system-adoption.md`, the two contrast context inks, the
heat ramps' dark values, and the four rulings of the same evening — card padding
18px among them).** One
screenshot per screen, width and theme — after only; the before-and-after
pairs used for verification are not here. Full page, clipped at 2400px.
Nothing is deployed from this folder; it is the set to review before
anything is.

**Names sort in order:** `NN-app-screen-width-theme.png`. 01–31 are the
staff app as Jane Pemberton (sport scientist, Ashcombe, Performance plan —
the one staff role that reaches every surface here, including analytics and
the plan page); 41–50 the athlete app as Dan Okonkwo; 61 the sign-in page
with no account. Each screen is at 1440 and 390, light and dark: 42 screens,
168 files.

**The dark theme is frozen** with one deliberate exception: the GPS report's
two heat ramps took dark values on Isabella's ruling. Diffed against the same
screens rendered before layer one, dark differs only at the corners (layer
two) and on those heat cells.

| NN | Screen | Route |
|---|---|---|
| 01 | Dashboard | `/dashboard` |
| 02 | Squad overview | `/squad` |
| 03 | Player profile | `/squad/[athleteId]` |
| 04 | Player wellness | `/squad/[athleteId]/wellness` |
| 05 | Schedule | `/schedule` |
| 06 | Session detail | `/schedule/[sessionId]` |
| 07 | Fixture detail | `/schedule/fixtures/[fixtureId]` |
| 08 | Timetable | `/timetable` |
| 09 | Flags | `/flags` |
| 10 | Injuries | `/injuries` |
| 11 | Injury record | `/injuries/[injuryId]` |
| 12 | Leaderboard wall | `/leaderboards` |
| 13 | A leaderboard | `/leaderboards/[leaderboardId]` |
| 14 | Nutrition workspace | `/nutrition` |
| 15 | Gym programmes | `/programmes` |
| 16 | A programme | `/programmes/[programmeId]` |
| 17 | Reports hub | `/reports` |
| 18 | GPS report | `/reports/gps` |
| 19 | Athlete report | `/reports/athlete/[athleteId]` |
| 20 | Squad weekly report | `/reports/squad` |
| 21 | Training load report | `/reports/training-load` |
| 22 | Match report | `/reports/match?fixture=…` |
| 23 | Testing | `/testing` |
| 24 | A test | `/testing/[testDefId]` |
| 25 | Analytics | `/analytics` |
| 26 | Settings hub | `/settings` |
| 27 | Plan | `/settings/plan` |
| 28 | Users | `/settings/users` |
| 29 | Groups | `/settings/groups` |
| 30 | Thresholds | `/settings/thresholds` |
| 31 | Data retention | `/settings/retention` |
| 41 | Today | `/today` |
| 42 | Morning check-in | `/check-in` |
| 43 | Rate a session | `/rpe/[sessionId]` |
| 44 | My data | `/my-data` |
| 45 | A board | `/my-data/boards/[leaderboardId]` |
| 46 | Programme | `/programme` |
| 47 | Gym logger | `/gym/[sessionId]` |
| 48 | Me | `/me` |
| 49 | My status | `/me/status` |
| 50 | Notifications | `/me/notifications` |
| 61 | Sign in | `/login` |
