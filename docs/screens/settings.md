# Screen: Settings

> **Layout status**: provisional. Awaiting client design photographs.

Screen 29 in the inventory (`02-information-architecture.md` §5). Reached from
`More → Settings` for staff and from the `Me` tab for athletes. The whiteboard drew
`Settings ─┬─► Thresholds ├─► Passwords ├─► Log out └─► Exports`, and all four have a home
here.

---

## Purpose

The container for everything configurable, and the exit door.

It is a router, not a screen with its own content. Its job is to present a role-appropriate
list of destinations, hold the small settings that do not deserve their own screen, and get out
of the way. Three principles:

1. **Role-dependent content, not role-dependent enabling.** An athlete does not see a greyed
   out "Organisation settings" row. They see a list with four items on it. A settings screen
   that is mostly locked doors is how a product tells its largest user group that it was not
   built for them.
2. **Destructive and security actions are separated from preferences.** Log out, password
   change, and data deletion do not sit in the same visual group as "notification sound".
3. **Nothing here changes athlete data.** Settings changes configuration. The one exception is
   the Article 21 processing objection, which lives under privacy and is specified in
   `09-security-and-compliance.md` §6.

**What this screen is not.** It is not `user-management.md` (screen 32), which is where an
admin invites and deactivates people. It is not `thresholds.md` or `exports.md`, which are
their own screens reached from here.

---

## Roles and access

Every role reaches Settings. What they find differs.

| Section | Athlete | Coach / S&C | Medical | Admin |
|---|:--:|:--:|:--:|:--:|
| Profile | Yes | Yes | Yes | Yes |
| Account security | Yes | Yes | Yes | Yes |
| Notification preferences | Yes | Yes | Yes | Yes |
| Appearance and accessibility | Yes | Yes | Yes | Yes |
| Privacy and my data | Yes | Yes | Yes | Yes |
| Thresholds | no | Yes | no | no |
| Exports | Own data | Yes | Yes | Yes |
| Organisation settings | no | View | View | Edit |
| Groups | no | Yes | Yes | Yes |
| Users and roles | no | no | no | Yes |
| Billing and subscription | no | no | no | Yes |
| Data retention and erasure | no | no | no | Yes |
| Audit log | no | no | no | Yes |
| Integrations | no | Yes | no | Edit |
| About, legal, support | Yes | Yes | Yes | Yes |
| Log out | Yes | Yes | Yes | Yes |

Thresholds are coach-only, per the permission matrix in `01-roles-and-permissions.md` §2, where
"Set thresholds" is `Y` for coach and blank for medical. That is worth flagging, because a physio
plausibly wants a soreness threshold and cannot set one. It is `08-notifications.md` open
question O-53 from the other direction, and it is restated here as O-366.

---

## Entry points

| From | Lands on | Context carried |
|---|---|---|
| Staff: `More → Settings` | Settings root | None |
| Athlete: `Me` tab | Settings root, athlete variant. The `Me` tab **is** this screen for athletes | None |
| A notification's "Manage notifications" action | Notification preferences | Deep-linked section |
| `flags.md`, "Adjust this threshold" | `thresholds.md`, that threshold | `threshold_id` |
| An expired session or forced sign-out | Account security, after re-authentication | None |
| `09-security-and-compliance.md` consent flows | Privacy and my data | None |
| Deep link `fydr://settings/<section>` | That section | Section key |

Per `02-information-architecture.md` §7 rule 1, maximum depth is three levels from a tab root.
Settings is level 2 from `More`, a section is level 3, and nothing sits below a section. Where a
section needs more, it is a screen of its own with its own inventory entry, which is why
Thresholds and Exports are separate files.

---

## Layout

### Athlete, mobile, 390 pt

This is the `Me` tab, per `02-information-architecture.md` §3.

```
┌─────────────────────────────┐
│ Me                          │
├─────────────────────────────┤
│  ┌───┐                      │
│  │ SA│  Sione Adeyemi        │
│  └───┘  Prop · #1            │
│         Forwards, Squad      │
│         [ Edit profile ]     │
├─────────────────────────────┤
│  Notifications          ›   │
│  Appearance             ›   │
├─────────────────────────────┤
│  PRIVACY AND MY DATA        │
│  Export my data         ›   │
│  What is collected      ›   │
│  Leaderboards           ›   │
│  Health app sync        ›   │
│  Delete my account      ›   │
├─────────────────────────────┤
│  ACCOUNT                    │
│  Password and sign-in   ›   │
├─────────────────────────────┤
│  Help and support       ›   │
│  Terms and privacy      ›   │
│  About Fydr             ›   │
├─────────────────────────────┤
│  [       Log out        ]   │
├─────────────────────────────┤
│  Fydr 1.4.2 (build 218)     │
│  Signed in as               │
│  s.adeyemi@example.com      │
│  Barnsford RFC              │
│  Last synced 14:02          │
└─────────────────────────────┘
```

Five destinations, one action, and the diagnostic footer. Nothing else. The athlete's settings
screen is short because the athlete's job is to submit an entry in under 45 seconds and go, and
every row here is a row they will never open.

The diagnostic footer is not decoration. Version, build, organisation and last sync are the
four things a support conversation always needs, and asking a semi-professional rugby player to
find a build number in a submenu does not work.

### Staff, mobile, 390 pt

```
┌─────────────────────────────┐
│ ← Settings                  │
├─────────────────────────────┤
│  ┌───┐                      │
│  │ AR│  Alex Rowe            │
│  └───┘  Coach / S&C          │
│         Barnsford RFC        │
│         [ Edit profile ]     │
├─────────────────────────────┤
│  MONITORING                 │
│  Thresholds          12  ›  │
│  Notification prefs      ›  │
├─────────────────────────────┤
│  ORGANISATION               │
│  Club details            ›  │
│  Groups              7   ›  │
│  Season and fixtures     ›  │
│  Integrations            ›  │
├─────────────────────────────┤
│  DATA                       │
│  Exports                 ›  │
│  My data                 ›  │
├─────────────────────────────┤
│  ACCOUNT                    │
│  Password and sign-in    ›  │
│  Appearance              ›  │
├─────────────────────────────┤
│  Help and support        ›  │
│  Terms and privacy       ›  │
├─────────────────────────────┤
│  [       Log out        ]   │
├─────────────────────────────┤
│  Fydr 1.4.2 (build 218)     │
│  Barnsford RFC · Performance│
│  Last synced 14:02          │
└─────────────────────────────┘
```

### Staff, web, 1280 pt

Two-column: section list left, section content right. The section list is a persistent rail, so
moving between Thresholds and Notification preferences is one click, not a back-and-forward.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Fydr  [Group filter: All squad ▾]                                           Alex R  ▾    │
├────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard  │  Settings                                                                   │
│ ...        │ ┌────────────────────┬──────────────────────────────────────────────────┐  │
│ More       │ │ ACCOUNT            │  Notification preferences                         │  │
│  ▸ Analyt  │ │  Profile           │  ────────────────────────────────────────────────│  │
│  ▸ Reports │ │  Security          │                                                   │  │
│  ▸ Leader  │ │  Notifications   ● │  Push notifications           [ On  ●───]        │  │
│  ▸ Testing │ │  Appearance        │  Email                        [ On  ●───]        │  │
│  ▸ Setting │ │                    │                                                   │  │
│            │ │ MONITORING         │  What you are notified about                      │  │
│            │ │  Thresholds     12 │  ┌──────────────────────────┬──────┬──────┐      │  │
│            │ │                    │  │                          │ Push │ Email│      │  │
│            │ │ ORGANISATION       │  ├──────────────────────────┼──────┼──────┤      │  │
│            │ │  Club details      │  │ High severity flags      │ [x]  │ [x]  │  🔒  │  │
│            │ │  Groups          7 │  │ Medium severity flags    │ [x]  │ [ ]  │      │  │
│            │ │  Season            │  │ Unacknowledged escalation│ [x]  │ [x]  │  🔒  │  │
│            │ │  Integrations      │  │ Availability changes     │ [x]  │ [ ]  │      │  │
│            │ │                    │  │ New injury reported      │ [x]  │ [x]  │      │  │
│            │ │ DATA               │  │ Weekly compliance digest │ [ ]  │ [x]  │      │  │
│            │ │  Exports           │  │ Import completed         │ [ ]  │ [x]  │      │  │
│            │ │  My data           │  │ Programme divergence     │ [x]  │ [ ]  │      │  │
│            │ │  Retention      🔒 │  │ Report ready             │ [x]  │ [x]  │      │  │
│            │ │  Audit log      🔒 │  └──────────────────────────┴──────┴──────┘      │  │
│            │ │                    │  🔒 Locked by your organisation                   │  │
│            │ │ ABOUT              │                                                   │  │
│            │ │  Help              │  Quiet hours    [ 22:00 ] to [ 06:30 ]           │  │
│            │ │  Legal             │  ⓘ High severity flags and escalations are        │  │
│            │ │  Log out           │    delivered during quiet hours. Everything else  │  │
│            │ └────────────────────┴──────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

### Organisation settings, admin, web

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Club details                                                        [Cancel]  [Save]    │
│  ────────────────────────────────────────────────────────────────────────────────────    │
│  Name           [ Barnsford RFC                                    ]                     │
│  Sport          [ Rugby union ▾ ]                                                        │
│  Country        [ United Kingdom ▾ ]                                                     │
│  Timezone       [ Europe/London ▾ ]                                                      │
│                 ⓘ All times in the app display in this timezone. Data is stored in UTC.  │
│  Logo           [ barnsford-crest.png ]  [Replace] [Remove]                              │
│                                                                                          │
│  Season                                                                                  │
│  Current        [ 2026/27 ▾ ]   1 Jul 2026 to 30 Jun 2027         [Manage seasons]      │
│                                                                                          │
│  Defaults                                                                                │
│  Week starts    [ Monday ▾ ]                                                             │
│  Analysis window [ 28 ] days   ⓘ Used as the default period across the product           │
│  Wellness prompt [ 07:00 ]                                                               │
│  RPE prompt      [ 30 ] minutes after a session ends                                     │
│  Session length when unset  [ 90 ] minutes                                               │
│  Quiet hours     [ 22:00 ] to [ 06:30 ]   [x] Staff may not override                     │
│                                                                                          │
│  Athlete visibility                                                                      │
│  [ ] Athletes see flags as soon as they are raised                                       │
│      ⓘ Default is off. Athletes see a flag once staff have acknowledged it, so they      │
│        hear it from a coach rather than from a red badge at 6am.                         │
│  [x] Athletes may opt out of leaderboards                                                │
│      ⓘ Cannot be turned off.                                                             │
│                                                                                          │
│  Subscription                                                                            │
│  Tier           Performance · 42 athletes · renews 1 Jul 2027    [Manage billing]        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `EmptyState` | `06-design-system.md` §6.16 | `noPermission` for a deep link into a section the role cannot open |
| `ConfirmSheet` | §6.18 | Log out with a pending sync queue, account deletion, revoking a session, disabling a locked setting |
| `BottomSheet` | §6.19 | Pickers on mobile: timezone, sport, season |
| `SyncStatusIndicator` | §6.17 | Last-sync line in the footer, and the pending-queue warning on log out |
| `SettingsList` | New, this screen | Grouped rows with a title, optional value, optional count badge, chevron, and a lock glyph |
| `SettingsSection` | New, this screen | A section's content pane on web, a pushed screen on mobile |
| `ToggleRow` | New, this screen | Label, description, switch, optional lock with the reason on press |
| `NotificationMatrix` | New, this screen | The channel-by-event grid, with org locks rendered |
| `PasswordChangeForm` | New, this screen | Current, new, confirm, with strength feedback |
| `SessionList` | New, this screen | Active sessions with device, location, last seen, and revoke |
| `DiagnosticFooter` | New, this screen | Version, build, org, tier, last sync, and a copy-to-clipboard action for support |
| `DangerZone` | New, this screen | Visually separated block for account deletion and organisation-level destructive actions |

---

## Data requirements

### Reads

| Field | Source `table.column` | Transformation |
|---|---|---|
| Display name, email, phone, avatar | `users.full_name`, `.email`, `.phone`, `.avatar_url` | None |
| Roles | `user_roles.role` | Rendered as a list. Multiple roles show as "Coach / S&C, Medical" |
| Athlete profile fields | `athletes.first_name`, `.last_name`, `.date_of_birth`, `.position`, `.squad_number`, `.dominant_side`, `.height_cm` | Only where `users.id = athletes.user_id` |
| Group membership | `group_memberships` → `groups.name`, `.colour` | Read-only on this screen. Managed in `groups.md` |
| Organisation | `organisations.name`, `.sport`, `.timezone`, `.country_code`, `.tier`, `.settings` | `settings` is `jsonb`, validated by Zod on read and write |
| Season | `seasons.name`, `.starts_on`, `.ends_on`, `.is_current` | Current season shown, others behind "Manage seasons" |
| Athlete count for billing | `count(athletes)` where `status <> 'left_club'` | The billed number, stated so it is checkable |
| Threshold count | `count(thresholds)` where `is_active` | Badge on the Thresholds row |
| Group count | `count(groups)` where `deleted_at is null` | Badge |
| Notification preferences | `notification_preferences` per `08-notifications.md` §11 | Resolution order per §5.1 of that document |
| Organisation notification locks | `organisations.settings.notifications.locks` | Renders the 🔒 and the reason |
| Push permission state | Device API plus `users.push_blocked_at` | Drives the "notifications are off in your phone settings" banner |
| Active sessions | Supabase auth sessions | Device, approximate location, last seen |
| Consent state | `athletes.consent_given_at`, `.consent_version` | Privacy section |
| HealthKit sync state | `07-integrations.md` connection record | Athlete privacy section, Premium tier and iOS only |
| Leaderboard opt-outs | `leaderboard_opt_outs` where `ended_at is null` | Count shown, managed from `leaderboards.md` or inline |
| Processing objections | `compliance_expectations.waived_reason = 'objection'` plus the per-domain flag | Article 21, per `09-security-and-compliance.md` §6 |
| App version and build | Client constants | Footer |
| Last sync | Local sync queue state | Footer |

### `organisations.settings` shape

The `jsonb` column is real configuration and needs a declared shape, per `04-data-model.md` §1:
`jsonb` only where the shape is genuinely open, never as a shortcut to avoid designing a table.
This one is a settings bag, which is the legitimate case, and it is validated.

```ts
export const OrgSettings = z.object({
  week: z.object({
    starts_on: z.enum(['monday','sunday']).default('monday'),
    default_analysis_days: z.number().int().min(7).max(365).default(28),
  }),
  notifications: z.object({
    wellness_prompt_local: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),
    rpe_prompt_delay_min: z.number().int().min(0).max(240).default(30),
    default_session_length_min: z.number().int().min(15).max(300).default(90),
    digest_day: z.number().int().min(1).max(7).default(1),
    digest_time_local: z.string().default('09:00'),
    quiet_hours: z.object({
      from: z.string().default('22:00'),
      to: z.string().default('06:30'),
      staff_may_override: z.boolean().default(false),
    }),
    escalation_hours: z.number().int().min(1).max(72).default(24),
    locks: z.array(z.string()).default(['flag.high','flag.escalation']),
  }),
  athlete_visibility: z.object({
    flags_visible_before_acknowledgement: z.boolean().default(false),
    leaderboard_opt_out_allowed: z.literal(true),
  }),
  // Children's Code, 09-security-and-compliance.md §4. Every value here is a floor that
  // applies to athletes under 18. None of them can be relaxed by a club, which is why
  // three of them are literals rather than booleans: the setting exists so the club can
  // see the commitment, not so the club can change it.
  children: z.object({
    parental_involvement_required: z.boolean().default(true),
    minimum_age_years:             z.literal(13),
    minor_leaderboards_opt_in:     z.literal(true),
    minor_photographs_allowed:     z.literal(false),
    minor_flag_push_lockable:      z.literal(false),
  }),
  nutrition: z.object({
    tolerance_pct: z.number().min(1).max(50).default(10),
    fluid_counts: z.boolean().default(false),
    default_metric: z.string().default('protein_g'),
  }),
  testing: z.object({
    one_rm_stale_days: z.number().int().min(30).max(730).default(120),
    asymmetry_warn_pct: z.number().min(1).max(50).default(10),
  }),
  reports: z.object({
    file_retention_days: z.number().int().min(1).max(365).default(30),
    allow_pdf_attachment: z.boolean().default(true),
  }),
  retention: z.object({
    athlete_data_years_after_leaving: z.number().int().min(1).max(25).default(3),
    injury_record_years: z.number().int().min(3).max(25).default(7),
  }),
});
```

`athlete_visibility.leaderboard_opt_out_allowed` is typed as `z.literal(true)`. The setting
exists so the UI can show it as a stated commitment, and the type makes it impossible to turn
off, per the Article 7(3) argument in `leaderboards.md`.

The `children` block uses the same device four times over, and it needs stating plainly rather
than being discovered by a developer wondering why a `z.literal` is not a `z.boolean`:

| Key | Why it is not editable |
|---|---|
| `minimum_age_years` | Under-13s are out of scope contractually and enforced at invite (`09-security-and-compliance.md` §4.4). A club cannot lower it |
| `minor_leaderboards_opt_in` | Standard 7. A minor appears on a board only by their own choice (`leaderboards.md`) |
| `minor_photographs_allowed` | Safeguarding, and standard 7. The photograph field is absent for a minor rather than off, so there is nothing for a club to switch |
| `minor_flag_push_lockable` | An org can lock most notifications on (`08-notifications.md` §2). It cannot lock `athlete.flag.shared` on for a child |

**`parental_involvement_required` is the one real setting**, and it defaults to **on**. When it
is on, a minor's optional consents stay unavailable until an admin records that the club's own
parental process has been completed (`04-data-model.md` §17.16). When a club turns it off, it is
asserting that it handles parental permissions elsewhere, and the athlete sees the ordinary
optional extras screen with everything still off. Turning it off is an admin action that is
audited and shown in the organisation settings screen as a stated position, not a quiet toggle.

The organisation settings screen renders the whole `children` block as a read-only panel headed
"Athletes under 18", with the one editable row, so an admin can see the club's obligations in the
product rather than only in the DPA. `[medium, this is a product judgement: the alternative is to
hide settings nobody can change, and a club that can see the rules is a club that can answer a
parent's question]`

### Query: settings root, staff

One query for the whole root, because the root is a list of rows with counts on them.

```sql
select
  u.id, u.full_name, u.email, u.phone, u.avatar_url, u.last_seen_at,
  array(select role from user_roles where user_id = u.id) as roles,
  o.id as org_id, o.name as org_name, o.sport, o.timezone, o.tier, o.settings,
  (select count(*) from thresholds t
    where t.org_id = o.id and t.is_active) as active_threshold_count,
  (select count(*) from groups g
    where g.org_id = o.id and g.deleted_at is null) as group_count,
  (select count(*) from athletes a
    where a.org_id = o.id and a.deleted_at is null
      and a.status <> 'left_club') as billable_athlete_count,
  (select row_to_json(s) from seasons s
    where s.org_id = o.id and s.is_current limit 1) as current_season,
  (select count(*) from users x
    where x.org_id = o.id and x.status = 'invited') as pending_invites
from users u
join organisations o on o.id = u.org_id
where u.id = auth_user_id();
```

### Writes

| Action | Write | Audit |
|---|---|---|
| Edit own profile | Update `users`, and `athletes` where the user is an athlete | `user.profile_update` |
| Change password | Supabase auth, requires the current password | `user.password_change` |
| Enrol or remove a passkey | Supabase auth | `user.passkey_change` |
| Revoke a session | Supabase auth | `user.session_revoke` |
| Change notification preferences | Upsert `notification_preferences` | none |
| Change appearance | Local device storage only. Not synced | none |
| Edit organisation settings | Update `organisations.name`, `.sport`, `.timezone`, `.settings` | `org.settings_update`, with before and after |
| Change the current season | Update `seasons.is_current` | `org.season_change` |
| Log out | Clear the session, clear the query cache, keep the local entry queue | `user.logout` |
| Request account deletion | Creates a request per `09-security-and-compliance.md` §13.4 | `user.deletion_request` |
| Withdraw a consent-based permission | Update the relevant consent record | `consent.withdraw` |
| Raise a processing objection | Sets the per-domain objection and waives future expectations | `consent.objection` |

`org.settings_update` records before and after, because a change to `quiet_hours` or
`flags_visible_before_acknowledgement` changes who sees what and when, and a club will
eventually need to establish when a setting changed.

---

## States

### Default

The role's section list. On web, the first section is selected. On mobile, the list only.

### Loading

The root renders from cache immediately: the user's name, roles and organisation are already
in the session. Counts on rows load in and show a skeleton pill rather than a zero. Sections
load their own content when opened.

### Empty

| Kind | Trigger | Copy | Action |
|---|---|---|---|
| `notStarted` | No thresholds configured | Rendered as a badge state on the row: "None set" | Opens `thresholds.md` |
| `notStarted` | No groups | "None" on the row | Opens `groups.md` |
| `noData` | No active sessions other than this one | "You are signed in on this device only." | none |
| `noPermission` | Deep link to a section the role cannot open | "Organisation settings are managed by your club admin." | "Back to settings" |
| `notStarted` | No integrations connected | "No integrations connected." | "Connect GPS import" |

### Error

Per §11.3, at the smallest scope. A failed section load shows the error inside that section
with the rest of the list usable. A failed save preserves the form input and states "Could not
save. Nothing was changed."

**Log out never fails.** If the sign-out call fails, the local session is destroyed anyway and
the server session expires on its own. A user who wants to log out on a shared device must not
be prevented from doing so by a network error.

### Offline

| Section | Behaviour |
|---|---|
| Root, profile, appearance | Fully readable from cache |
| Appearance | Fully writable. It is device-local |
| Notification preferences | Readable, not writable. The standard disabled copy |
| Organisation settings | Readable, not writable |
| Thresholds, Exports | Readable, not writable |
| Account security | Password change disabled. Session list shows cached data with the timestamp |
| Log out | **Available**, with a warning if the local entry queue is not empty |

The log-out warning:

```
Log out?

You have 2 entries that have not synced yet:
  · Wellness, 5 August
  · Gym session, 4 August

Logging out now will lose them. Connect to the internet
and wait for the sync indicator to clear first.

                  [Stay logged in]  [Log out anyway]
```

Per `03-flows.md` §10, the queue survives app termination and device restart but not a
reinstall with the same account, and it does not survive a log out. That is documented and
accepted there, and this screen is where the user is told before it happens rather than after.

### Role-specific

The section table under "Roles and access" is the specification. Three details:

1. **Coach and medical see organisation settings read-only.** A coach needs to know the quiet
   hours and the analysis window to understand product behaviour. Hiding the values entirely
   produces "why did my notification not arrive at 6am" as a support call rather than a glance.
2. **Admin sees no athlete data anywhere in Settings.** No compliance figures against names, no
   flag counts. `01-roles-and-permissions.md` §1 is deliberate about this and Settings is the
   easiest place to leak it accidentally through a "usage statistics" panel.
3. **A user with both coach and medical roles gets the union**, per the design note in
   `01-roles-and-permissions.md` §1. That means Thresholds appears for a coach-plus-medical
   user, from the coach half.

---

## Interactions

### Profile

Editable by the user themselves: display name, phone, avatar, and for athletes the fields they
own. Not editable here: email, roles, squad number, groups, position.

- **Email** changes through a verification flow in Account security, not as a profile field.
- **Roles** are granted by an admin in `user-management.md`. Self-service role change is the
  most obvious privilege-escalation path in a product and it does not exist.
- **Squad number and position** are squad structure and are set by staff on the athlete record.
  An athlete changing their own squad number breaks every printed testing sheet in the building.

An athlete editing `date_of_birth` after onboarding requires staff confirmation, because it
affects age-group eligibility and the children provisions in `09-security-and-compliance.md` §4.
Since 5 August 2026 it decides which protections apply to the account, so the change is audited
with both values (`04-data-model.md` §17.16) and a change that crosses 18 in either direction
never retrospectively alters what was collected while the athlete was a minor. Crossing 18
upwards makes the optional extras available and turns nothing on.

### Account security

| Control | Behaviour |
|---|---|
| Change password | Requires the current password. Zod-validated: 10 characters minimum, checked against a breached-password list, strength shown as feedback not as a gate |
| Passkeys | List, add, remove. At least one other sign-in method must remain |
| Two-factor | Enrol, view recovery codes, disable with re-authentication |
| Active sessions | Device, approximate location, last seen, current session marked. "Sign out everywhere else" |
| Recent security activity | Last 10 sign-ins, password changes and role changes, from `audit_log` |

Changing a password signs out every other session, and says so before it happens. Per
`09-security-and-compliance.md` §10.3 this is the device-loss path, and it is the reason the
session list is on this screen rather than buried.

### Notification preferences

The matrix from `08-notifications.md` §5, rendered. Resolution order per §5.1 of that document:
organisation lock, then user preference, then default.

- **Locked rows** show 🔒 and, on press, the reason: "Your club requires high severity flag
  notifications." They are not hidden and not silently overridden.
- **Quiet hours** are per user unless the organisation locks them. High-severity flags and
  escalations are delivered during quiet hours regardless, and the UI states this next to the
  control rather than letting a coach believe they are unreachable.
- **The athlete mute rule** from §5.2 of the notifications document applies: an athlete can mute
  reminders, and muting does not stop the entry being expected. The UI says so: "Muting
  reminders does not change what you are asked to submit."
- **OS-level block** is detected. When the device has notifications disabled, a banner sits
  above the matrix: "Notifications are turned off for Fydr in your phone settings." with a deep
  link to the OS settings. Rendering a full matrix of toggles that do nothing is worse than
  useless.

### Appearance and accessibility

Device-local, never synced, because a coach's tablet and their phone are used in different
conditions and syncing the setting is actively wrong.

| Control | Options | Default |
|---|---|---|
| Theme | System, light, dark | System |
| Density | Comfortable, compact | Comfortable on mobile, compact on web, per `06-design-system.md` §2.7 |
| Text size | Follows the OS. An in-app override is offered on web only | System |
| Reduce motion | Follows the OS, with an in-app override | System |
| High contrast | Follows the OS, with an in-app override | System |
| Units | Metric only in v1 | Metric |

Units is listed and fixed. `04-data-model.md` §1 makes units canonical and non-negotiable at the
storage layer, and presentation-layer conversion to imperial is a real request from some clubs
that is not in v1. Showing the row with "Metric" and no picker is more honest than omitting it.

### Organisation settings

Admin edits, coach and medical read. Grouped as in the wireframe: club details, season,
defaults, athlete visibility, subscription.

Two settings carry consequence warnings:

**Timezone.** Changing it changes when the 07:00 wellness prompt fires, when compliance
expectations are generated, and how every timestamp displays. The confirmation states: "All
scheduled notifications will move. Historical data is unchanged: times are stored in UTC and
will now display in the new timezone."

**Athletes see flags before acknowledgement.** Off by default, per
`01-roles-and-permissions.md` §3 carve-out 2. Turning it on shows the argument for the default
before accepting the change, because the club is overriding a deliberate duty-of-care design
choice: "An athlete should learn 'your sleep has dropped for four days, we've adjusted your
load' from a coach, not from a red badge at 6am." This is `01-roles-and-permissions.md` open
question O-2 made configurable.

### Privacy and my data

Every athlete-facing right from `09-security-and-compliance.md` §6, as a product feature, in one
place:

| Row | What it does |
|---|---|
| Export my data | Portability export, own data only. Routes to `exports.md` in athlete mode |
| What is collected | Plain-English version of the consent screen from onboarding, always available, with the consent version and date. **For an athlete under 18 this is the child version, step 5c, in the same words they were shown at onboarding** |
| Who can see my data | A table naming the roles and what each sees. The same table as `01-roles-and-permissions.md` §4, in plain English |
| Leaderboards | Global opt-out toggle and a per-board list. Article 7(3) |
| Health app sync | HealthKit connection, what is read, disconnect. Article 7(3) |
| Object to a type of monitoring | Per-domain objection, Article 21. Not account deactivation |
| Delete my account | Request flow per `09-security-and-compliance.md` §13.4 |
| **Under 18 only: what is off, and who is involved** | A standing statement, not a one-off screen: leaderboards off, photograph off, device sync off, and whether the club requires a parent or carer to be involved before optional extras can be turned on. Required by standards 7 and 11 (`09-security-and-compliance.md` §4.6, §4.7). It states facts, never invitations: no "turn this on to join in" |

**Account deletion is a request, not a button.** The App Store requires an in-app account
deletion path, per §13.4 of the security document, and Fydr cannot hard-delete athlete data,
per `CLAUDE.md` rule 4. The resolution is a request that: signs the athlete out immediately,
disables all collection and notifications, tells the club admin, and produces the decision-
support erasure screen on the admin side with the Article 17(3) retention reasons displayed.
The athlete is told exactly this before confirming, including which categories will be retained
and why. Not a delete button, and not a dead end either.

### Log out

A single, full-width, clearly separated action. It is not in a `DangerZone` block, because
logging out is routine, not destructive. It confirms only when the sync queue is non-empty.

On log out: the session is cleared, the TanStack Query cache is cleared entirely (per
`05-architecture.md` §9 rule 1, `orgId` is in every key so a missed clear cannot cross
organisations, but the cache is cleared anyway), local SQLite entry data for that user is
cleared, and the device push token is unregistered so the next user of the device does not
receive the previous user's notifications. That last one is easy to miss and is a real leak.

---

## Validation rules

| Rule | Severity | Message |
|---|---|---|
| Display name 2 to 80 characters | Block | "Enter your name." |
| Phone is a valid international number | Block | "Enter a valid phone number." |
| Avatar under 5 MB, image type, stripped of EXIF | Block | "Images must be under 5 MB." |
| Password 10 characters minimum | Block | "Use at least 10 characters." |
| Password not in the breached list | Block | "This password has appeared in a data breach. Choose another." |
| New password differs from the current one | Block | "Choose a different password." |
| Removing the last sign-in method | Block | "Keep at least one way to sign in." |
| Organisation name 2 to 100 characters | Block | "Enter the club name." |
| Timezone is a valid IANA identifier | Block | Picker only |
| Analysis window 7 to 365 days | Block | "Between 7 and 365 days." |
| Quiet hours span is under 16 hours | Warn | "Quiet hours of 18 hours will suppress most notifications." |
| Wellness prompt inside quiet hours | Block | "The wellness prompt cannot be inside quiet hours." |
| Season dates do not overlap another season | Block | "2026/27 overlaps 2025/26." |
| Changing the current season | Warn | "MD-n labels, compliance expectations and analytics defaults will use the new season." |
| Report retention 1 to 365 days | Block | "Between 1 and 365 days." |
| Athlete data retention below 1 year | Block | "Retention must be at least 1 year." Below that, injury records cannot be kept per §7 of the security document |
| Turning on pre-acknowledgement flag visibility | Warn, with the argument | As above |
| Deleting an account with an open injury record | Warn | "Your injury records will be retained. Your club must keep them." |

---

## Edge cases

1. **A user with both athlete and coach roles.** The union of both permission sets, per the
   design note. Settings shows both the athlete privacy section for their own data and the
   coach monitoring section. Their profile edits their `users` row and their `athletes` row.
2. **An athlete with no `users` row.** `athletes.user_id` is nullable so staff can add a squad
   member before they download the app. That person has no settings screen because they have no
   session. Nothing here breaks; there is simply no path in.
3. **A user whose role is removed while they have Settings open.** The next query fails RLS and
   the section renders `noPermission` rather than an error. A realtime role-change event forces
   a session claims refresh, per `05-architecture.md`, so the JWT does not keep granting the old
   role until expiry.
4. **An organisation downgraded from Performance to Core.** GPS integration and analytics
   sections render locked with "Part of the Premium tier" rather than disappearing. Nothing
   is deleted.
5. **The last admin in an organisation attempting to remove their own admin role.** Blocked in
   `user-management.md`, not here, but Settings shows the role list read-only so the attempt is
   made in one place only.
6. **A club changing timezone mid-season.** Historical `timestamptz` values are unaffected.
   `sessions.md_offset` is stored, per `04-data-model.md` §4, so MD-n labels do not shift.
   Scheduled notification times move, and the confirmation says so.
7. **A user logging out with 40 queued test results** from a testing afternoon. The warning
   lists the count by type rather than every item, and strongly discourages proceeding. Test
   results are staff-entered and queued per the exception in `testing.md`, and losing an
   afternoon of them is the worst data loss the product can suffer.
8. **Push token registered to a device that changes hands.** Log out unregisters the token. A
   token that survives log out delivers the previous user's flags to the new user, which is a
   cross-athlete data leak through a notification body, exactly the risk
   `08-notifications.md` §11 flags for admin visibility.
9. **A deep link to `fydr://settings/thresholds` delivered to an athlete.** Resolves to
   `noPermission` in the athlete shell, per `02-information-architecture.md` §7 rule 4. It does
   not crash and it does not render an empty threshold list.
10. **Two admins editing organisation settings simultaneously.** Last write wins on the whole
    `settings` object, which would silently discard the other's change. A version check on
    `organisations.updated_at` detects it and shows "Jo Patel changed these settings 20 seconds
    ago. Reload before saving."
11. **An athlete who has objected to wellness processing** opening Privacy. The objection is
    shown as active, with the date and the effect: "Wellness monitoring is off. Your past
    entries are kept and are not shown in squad views. You are not marked non-compliant."
    Nutrition is not on the objection list, because there is nothing to object to: Fydr
    publishes nutrition guidance to the athlete and records nothing back
    (`nutrition-guidance.md`).
12. **An account deletion request for an athlete who is also a coach.** The request removes the
    athlete profile's collection and retains the staff account, or removes both, and the flow
    asks which. Deleting a coach account that authored programmes and thresholds is not the same
    operation as deleting an athlete's data.

---

## Performance notes

| Path | Budget |
|---|---|
| Settings root | 150 ms p95 server, instant from cache |
| Any section open | 200 ms p95 |
| Log out to signed-out state | 300 ms p95, and never blocked on the network |

Rules:

1. **The root is one query.** Counts are subqueries in it, not separate round trips per badge.
2. **The root renders before the query returns**, from session claims and cache. The user's
   name, roles and organisation are already known, so the screen is never blank.
3. **Sections are code-split** on web. The audit log viewer and the integrations panel are not
   in the main bundle, which matters against the 4 MB Android bundle budget in
   `05-architecture.md` §11.
4. **Appearance settings apply synchronously** from local storage on app start, before the first
   render, so there is no theme flash.
5. **Query keys**: `qk.settings.root(orgId, userId)`, `qk.settings.org(orgId)`,
   `qk.settings.notifications(userId)`, `qk.settings.sessions(userId)`.
6. **Freshness**: root 5 min, organisation settings 10 min, sessions 0 with refetch on focus
   because a revoked session must disappear promptly.
7. **Invalidation**: an organisation settings write invalidates broadly, because quiet hours and
   the analysis window affect other screens' defaults. This is a rare write and a broad
   invalidation is the correct trade.
8. **No polling anywhere on this screen.** Nothing here changes without the user doing it,
   except the session list, which refetches on focus.

---

## Accessibility

1. **Sections are a real list** with `role="list"` and headings per group. On web the rail is a
   `nav` with `aria-current` on the selected section.
2. **Every row's accessible name includes its value and state**: "Thresholds, 12 active",
   "Notifications, on", "Organisation settings, view only".
3. **Toggles are switches** with `role="switch"` and `aria-checked`, with the description bound
   by `aria-describedby`, not placed as adjacent unassociated text.
4. **Locked settings announce the lock and the reason**: "High severity flags, push, on, locked
   by your organisation".
5. **The notification matrix is a real table** with row and column headers, so a cell announces
   "High severity flags, push, checked".
6. **Log out is a button with a clear accessible name**, "Log out of Fydr", and the confirmation
   is an `alertdialog` whose description lists the unsynced items.
7. **The diagnostic footer is selectable text** on web and has a "Copy details" action on
   mobile, so a user can give support the build number without reading it aloud.
8. **Destructive actions are not distinguished by colour alone.** "Delete my account" carries a
   glyph and sits in a labelled `DangerZone` region with a heading.
9. **Focus management**: opening a section on mobile moves focus to its heading; going back
   returns focus to the row that opened it.
10. **Dynamic type** to 200%. Rows grow vertically; values wrap beneath labels rather than
    truncating. The web two-column layout collapses to single column above 150%.
11. **Form errors** are bound with `aria-describedby` and announced on blur, and the password
    strength indicator is announced as text, never as a colour bar alone.

---

## Open questions

- **O-365**: Should coach and medical see organisation settings read-only, as specified, or not
  at all? Read-only answers real questions about product behaviour and also exposes the club's
  retention and visibility choices to staff. I think read-only is right.
- **O-366**: Restates `08-notifications.md` O-53 from the settings side: medical cannot set
  thresholds, per the permission matrix, but a physio is the person most likely to want a
  soreness rule. Either the matrix changes, or medical needs a request path to a coach.
- **O-367**: Should appearance settings sync across a user's devices? I have specified
  device-local, because density in particular should differ between a phone on a pitch and a
  desktop in an office. Theme is arguably different.
- **O-368**: Imperial units are not offered. Some UK clubs weigh in kilograms and measure
  height in feet, and some will ask for pounds. The storage layer is fixed by
  `04-data-model.md`, so this is purely a presentation-layer question, and it is a real one.
- **O-369**: What exactly happens to a staff account that is also an athlete when the person
  leaves the club? Deactivating the user and retaining the athlete record is probably right, and
  it needs specifying in `user-management.md` rather than being discovered.
- **O-980**: Who at a club may turn `children.parental_involvement_required` off? It is an admin
  action as specified, and a club admin is often a volunteer secretary rather than the person
  responsible for safeguarding. The alternative is that it is set by Fydr at onboarding and
  changed only by a support request, which is friction that puts the decision in front of someone
  who understands it. I lean towards the second. `[medium]`
- **O-370**: Should there be an organisation-level "support access" toggle, so a club can grant
  or revoke Fydr support's read access from Settings rather than by email?
  `01-roles-and-permissions.md` O-4 defers support access to Phase 3, and if it lands earlier
  this is where the control belongs.
