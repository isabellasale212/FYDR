# 03. Application Flows

Every diagram here is normative. If the code does something different, one of the two is
wrong and it needs raising, not quietly reconciling.

---

## 1. The daily loop

The core rhythm of the product. Everything else is supporting infrastructure.

```mermaid
sequenceDiagram
    autonumber
    participant A as Athlete
    participant App as Fydr app
    participant API as Supabase
    participant Eng as Flag engine
    participant C as Coach

    Note over App: 07:00 scheduled push
    App->>A: "Morning wellness is open"
    A->>App: Opens Today tab
    App->>A: Shows outstanding entries
    A->>App: Submits wellness (< 45s)
    App->>API: Write entry (queued if offline)
    API->>Eng: Trigger threshold evaluation
    Eng->>Eng: Compare vs personal baseline<br/>and org thresholds
    alt Value breaches threshold
        Eng->>API: Create flag
        API->>C: Push notification
    end
    Note over C: 08:00
    C->>App: Opens Dashboard
    App->>C: Squad status + open flags
    C->>App: Opens flag → athlete profile
    C->>App: Acknowledges flag, adds note
    App->>API: Flag acknowledged
    API->>A: Athlete can now see the flag
    Note over C: Coach adjusts session load
    C->>App: Edits today's session
    App->>A: Updated session appears in Today
```

**Design consequence**: the flag engine must complete within a few seconds of submission.
A coach arriving at 08:00 must see flags from a 07:15 submission. Run it as a Postgres
trigger calling an Edge Function, not a nightly batch.

---

## 2. Athlete first-run and onboarding

```mermaid
graph TD
    S([Admin invites athlete]) --> E[Email + SMS invite<br/>with deep link]
    E --> D{App installed?}
    D -->|No| AS[App Store] --> I[Install]
    I --> DL[Deep link resumes]
    D -->|Yes| DL
    DL --> AU[Set password / passkey]
    AU --> PR[Capture profile<br/>name, DATE OF BIRTH, position]
    PR --> AGE{Age from DOB}

    AGE -->|Under 13| U13[Blocked. Out of scope.<br/>Admin notified]
    AGE -->|13 to 17| MIN[Child privacy screen<br/>plain language, reading age 13<br/>high-privacy defaults preset]
    AGE -->|18+| AD[Adult privacy screen<br/>what is collected, who sees it]

    MIN --> PAR[Parental involvement<br/>per club policy]
    PAR --> OPT
    AD --> OPT

    OPT[Optional extras, each separately opt-in:<br/>HealthKit · leaderboard · photographs]
    OPT --> NP[Notification permission]
    NP --> HK{Premium tier, iOS,<br/>and HealthKit opted in?}
    HK -->|Yes| HKP[HealthKit permission<br/>optional, skippable]
    HK -->|No| WT
    HKP --> WT[Walkthrough:<br/>3 screens, skippable]
    WT --> FW[First wellness entry<br/>guided]
    FW --> T([Today tab])

    style MIN fill:#b8860b,color:#fff
    style U13 fill:#8b0000,color:#fff
    style OPT fill:#b8860b,color:#fff
    style T fill:#1f6fea,color:#fff
```

**Correction, 5 August 2026. An earlier version of this flow gated the whole account on a
consent screen, with "consent declined" producing an inactive account. That was wrong and it
contradicted `09-security-and-compliance.md` §3.**

**Consent is not the lawful basis for the core processing.** An athlete cannot freely refuse
their coach. Consent that is not freely given is not consent, and it is invalid from the
moment it is collected. The core processing rests on the club's legitimate interests plus an
Article 9 condition, not on the athlete ticking a box. See `09-security-and-compliance.md` §3
for the full basis stack.

**So what the athlete actually sees is a privacy screen, not a consent gate.** It tells them
in plain English what is collected, who in the club can see it, that clinical notes are not
visible to their coach, and that they can export or request erasure. There is no "decline"
that switches the account off, because there is nothing to decline at that point.

**Consent applies only to the genuinely optional extras**, and each is separately opt-in and
separately withdrawable: HealthKit and device sync, appearing on leaderboards, and
photographs. Declining any of them leaves a fully working account.

**Age determines the flow, and date of birth is therefore captured, not confirmed.** Under-18
athletes are in scope (`09-security-and-compliance.md` §4), so the Children's Code applies in
full. Minors get child-facing privacy language written at a reading age of about 13,
high-privacy defaults preset rather than offered, parental involvement per club policy, and
leaderboards off unless actively opted in. Under-13s are blocked at invite: Article 8 requires
parental consent below 13 and Fydr does not model it. See O-961.

**An athlete cannot be activated without a date of birth**, because the age branch cannot be
resolved without one. `04-data-model.md` §17.16 enforces this at invite rather than with a
`not null` column, so staff can still add a squad member before they have full details.

### Staff first-run

Not diagrammed because it is short: invite, set password, multi-factor enrolment (mandatory
for staff, `09-security-and-compliance.md` §8), role confirmation, done. Staff have no consent
screen because they are not the data subject of the performance data. They do get a privacy
notice covering their own account data.

> **Real divergence, recorded per CLAUDE.md §5 rather than silently followed** (login-security
> checklist item 3): this build has no onboarding wizard at all — an admin-created account
> starts `active` immediately (`lib/queries/userManagement.ts`'s own header has always said
> so), and the person's first action is just signing in at the one real `/login` screen, not a
> guided multi-step sequence with an "MFA enrolment" step 2b to hook into. MFA enrollment
> instead lives in Settings (`MfaEnrollment.tsx`), reachable any time after first sign-in, and
> is a strong, undismissable prompt for coach/medical/admin rather than something that blocks
> progress the way this section's "mandatory" and the onboarding table below ("Staff without
> MFA: Cannot proceed. Sign-out is the only exit.") describe — see
> `09-security-and-compliance.md`'s implementation-status note for exactly why a hard block
> wasn't safe to ship in this pass. Also wrong below, independent of that design choice:
> item 19's "Recovery codes are the route back" — Supabase's TOTP MFA API has no recovery-code
> concept at all, checked against the shipped SDK types before writing any of this, so no
> implementation of this flow against this vendor could offer that. The real recovery path is
> `UserDetailPanel.tsx`'s admin-only "Remove MFA factor" action.

The shell they land in, athlete or staff, is resolved server-side from their roles. A user
holding both roles gets the staff shell with their own athlete data inside it, never two apps.

---

## 3. Wellness submission, including offline

```mermaid
stateDiagram-v2
    [*] --> Prompted: 07:00 push
    Prompted --> Open: Athlete opens entry
    Open --> Filling: Sliders + inputs
    Filling --> Filling: Adjusts values
    Filling --> Submitted: Taps submit

    Submitted --> Queued: No network
    Submitted --> Sent: Network available

    Queued --> Sent: Connectivity returns
    Queued --> Queued: Retry with backoff

    Sent --> Stored: 200 OK
    Sent --> Queued: Failure

    Stored --> Evaluated: Flag engine runs
    Evaluated --> Clear: Within thresholds
    Evaluated --> Flagged: Threshold breached

    Clear --> [*]
    Flagged --> Lifecycle: Enters the flag lifecycle
    Lifecycle --> [*]

    note right of Queued
        UI shows "saved, will sync".
        Never shows an error to the athlete.
        Entry is visible in their history
        immediately, marked pending.
    end note

    note right of Stored
        Entry becomes immutable.
        Corrections create a revision,
        they never update in place.
    end note

    note right of Lifecycle
        Full state machine in section 5.
        Do not implement the short
        version shown here.
    end note
```

**Non-negotiable**: the athlete never sees a network error. The entry is saved locally the
instant they submit, appears in their history, and syncs when it can. The submission is a
local write with a background sync, not a network request with a spinner.

---

## 4. Programme creation and tailoring

The whiteboard instruction: *"create general programme and tailor to specific athletes"*.

```mermaid
graph TD
    S([S&C coach]) --> NEW[New programme]
    NEW --> TMPL{Start from?}
    TMPL -->|Blank| BLANK[Empty programme]
    TMPL -->|Template| LIB[Programme library]
    TMPL -->|Copy| PREV[Duplicate existing]

    BLANK --> STRUCT
    LIB --> STRUCT
    PREV --> STRUCT

    STRUCT[Define structure:<br/>blocks → weeks → sessions → exercises]
    STRUCT --> PRESC[Prescribe per exercise:<br/>sets, reps, load basis, tempo, rest]
    PRESC --> LOADB{Load basis}
    LOADB -->|Absolute kg| ABS[Fixed weight]
    LOADB -->|% of 1RM| PCT[Resolved per athlete<br/>from testing data]
    LOADB -->|RPE target| RPE[Athlete self-regulates]

    ABS --> ASSIGN
    PCT --> ASSIGN
    RPE --> ASSIGN

    ASSIGN[Assign to group or individuals]
    ASSIGN --> GEN[General programme is now live]
    GEN --> TAILOR{Tailor an athlete?}
    TAILOR -->|No| DONE([Athletes see it in Programme tab])
    TAILOR -->|Yes| OVR[Create athlete override]
    OVR --> OVRT[Swap exercise · change volume ·<br/>cap load · mark exempt]
    OVRT --> LINK[Override stays linked to parent]
    LINK --> DONE

    UPD([Coach edits parent programme]) --> PROP{Athlete has override<br/>on that element?}
    PROP -->|No| INH[Change propagates]
    PROP -->|Yes| KEEP[Override preserved<br/>coach notified of divergence]

    style GEN fill:#1f6feb,color:#fff
    style OVR fill:#b8860b,color:#fff
```

**The critical mechanic** is the override model. A general programme is the parent. An
athlete-specific change creates an override record on a single element, not a full copy.
When the coach edits the parent, unmodified elements update everywhere and overridden
elements are preserved.

The alternative, copying the programme per athlete, means a coach editing one exercise
has to repeat it 30 times. That is the failure mode of every spreadsheet-based system Fydr
is replacing, so it cannot be reproduced.

**Rehab exception**: a medical-assigned rehab programme overrides a gym programme entirely
for that athlete. The gym programme is marked suspended, not deleted, and resumes on
clearance.

---

## 5. Flag lifecycle

```mermaid
stateDiagram-v2
    [*] --> Evaluating: New data arrives
    Evaluating --> [*]: Within thresholds
    Evaluating --> Raised: Threshold breached

    Raised --> Notified: Push to relevant staff
    Notified --> Acknowledged: Staff opens and acknowledges
    Notified --> Escalated: Unacknowledged > 24h

    Escalated --> Acknowledged

    Acknowledged --> Actioned: Staff records an action
    Acknowledged --> Dismissed: Staff marks not a concern

    Actioned --> Monitoring: Watch for N days
    Monitoring --> Resolved: Values return to normal
    Monitoring --> Raised: Breaches again

    Dismissed --> [*]
    Resolved --> [*]

    note right of Raised
        Athlete cannot see the flag yet.
        See roles doc, carve-out 2.
    end note

    note right of Dismissed
        Dismissal requires a reason.
        Repeated dismissal of the same
        threshold surfaces a suggestion
        that the threshold is miscalibrated.
    end note
```

**Deliberate feature**: if a threshold is dismissed repeatedly, Fydr suggests recalibrating
it. Alert fatigue is what kills monitoring systems. A flag nobody acts on is worse than no
flag, because it teaches staff to ignore the badge.

---

## 6. Injury and availability

```mermaid
sequenceDiagram
    autonumber
    participant A as Athlete
    participant M as Medical
    participant Sys as Fydr
    participant C as Coach

    alt Athlete-reported
        A->>Sys: Reports a problem from Today tab
        Sys->>M: Notification
    else Staff-observed
        C->>Sys: Raises concern on athlete
        Sys->>M: Notification
    else Flag-triggered
        Sys->>M: Wellness soreness threshold breached
    end

    M->>Sys: Opens athlete, creates injury record
    M->>Sys: Records clinical detail (medical-only)
    M->>Sys: Sets availability + restrictions
    Sys->>C: Availability change (no clinical detail)
    Sys->>A: Status + restrictions visible

    Note over C: Coach plans around it
    C->>Sys: Session assignment respects restriction
    Sys-->>C: Warns if athlete assigned<br/>work they are restricted from

    M->>Sys: Assigns rehab programme
    Sys->>A: Rehab appears in Programme tab
    A->>Sys: Logs rehab sessions
    Sys->>M: Rehab compliance

    M->>Sys: Return-to-play milestones met
    M->>Sys: Clears athlete
    Sys->>C: Availability restored
    Sys->>A: Gym programme resumes
```

**Hard rule enforced in code**: the system warns when a coach assigns an athlete work that
their restrictions prohibit. It warns rather than blocks, coaches overrule physios
constantly and a hard block gets the product uninstalled, but the override is logged.

---

## 7. Data ingestion by source

```mermaid
graph LR
    subgraph P1["Phase 1, Manual"]
        SR[Athlete self-report<br/>wellness daily · RPE per session<br/>nutrition check-in WEEKLY]
        SE[Staff entry<br/>testing · observations]
    end
    subgraph P2["Phase 2, File import"]
        CSV[GPS vendor CSV<br/>Catapult · StatSports]
    end
    subgraph P3["Phase 3, Device"]
        HK[Apple HealthKit<br/>sleep · HR · HRV · steps]
    end
    subgraph P4["Phase 4, API"]
        VAPI[Vendor APIs]
    end

    SR --> V[Validation<br/>Zod schema + range checks]
    SE --> V
    CSV --> MAP[Column mapping<br/>saved per vendor profile]
    MAP --> V
    HK --> NORM[Unit normalisation]
    NORM --> V
    VAPI --> NORM

    V --> PROV[Attach provenance<br/>source · confidence · timestamp]
    PROV --> DEDUP[Deduplicate<br/>athlete + metric + window]
    DEDUP --> STORE[(Postgres)]
    STORE --> FLAG[Flag engine]
    STORE --> ANL[Analytics]

    style PROV fill:#1f6feb,color:#fff
    style DEDUP fill:#b8860b,color:#fff
```

**Deduplication matters more than it looks.** Sleep can arrive from a self-reported wellness
entry and from HealthKit for the same night. These are different measurements of the same
thing with different reliability. Rules:

1. Device data wins over self-report for objective metrics (sleep duration, heart rate)
2. Self-report wins for subjective metrics (sleep *quality*, soreness, mood, stress)
3. Both are retained; the resolution picks which is displayed and which feeds analytics
4. The display always shows provenance so a coach knows what they are reading

---

## 8. Weekly planning around MD-n

MD-n is the scheduling spine. Everything anchors to distance from the next fixture.

```mermaid
graph LR
    MD5["MD-5<br/>Recovery"] --> MD4["MD-4<br/>High load"]
    MD4 --> MD3["MD-3<br/>High intensity"]
    MD3 --> MD2["MD-2<br/>Moderate"]
    MD2 --> MD1["MD-1<br/>Activation"]
    MD1 --> MD["MD<br/>Fixture"]
    MD --> MD1P["MD+1<br/>Recovery"]
    MD1P --> MD2P["MD+2<br/>Off / regen"]

    style MD fill:#8b0000,color:#fff
    style MD1 fill:#b8860b,color:#fff
```

**How it works in the product:**

1. The coach enters fixtures for the season
2. Fydr computes the MD-n label for every day between fixtures automatically
3. A **week template** defines what happens at each MD-n position: session types, expected
   load, which entries are required from athletes
4. Applying a template to a week generates the sessions, and the coach adjusts from there
5. Compliance expectations follow the template, no wellness entry is expected on a day
   the template marks as off

**Consequence**: compliance is measured against what was *expected that day*, never against
a flat "every athlete every day". An athlete is not marked non-compliant on a rest day. Get
this wrong and every compliance figure in the product is meaningless.

**Edge cases to handle:**
- Two fixtures in one week: MD-n labels are relative to the *next* fixture; the days after
  a fixture carry both MD+n and MD-n labels and the UI shows both
- No fixture scheduled: days are labelled by training week position instead
- Fixture postponed: MD-n labels recompute, and already-logged sessions keep their original
  label recorded alongside the new one

---

## 9. Analytics query flow

```mermaid
graph TD
    C([Coach]) --> AN[Analytics]
    AN --> CH{Start from}
    CH -->|Preset| PRE[Preset library:<br/>ACWR · wellness trend ·<br/>compliance · load distribution]
    CH -->|Custom| BLD[Builder]

    BLD --> V1[Pick metrics<br/>across domains]
    V1 --> V2[Pick population<br/>squad · group · athletes]
    V2 --> V3[Pick window<br/>adjustable, default 28d]
    V3 --> V4[Pick visualisation<br/>bar · line · scatter · heatmap]
    V4 --> V5[Optional: correlate<br/>metric A vs metric B]

    PRE --> Q
    V5 --> Q[Query built]
    Q --> GUARD{Enough data?}
    GUARD -->|No| WARN[Show insufficient-data notice<br/>state n and window]
    GUARD -->|Yes| RUN[Execute]
    RUN --> REND[Render + provenance footnote]
    REND --> SAVE{Save?}
    SAVE -->|Yes| LIB[Saved view<br/>shareable within org]
    SAVE -->|No| END([Done])

    style GUARD fill:#b8860b,color:#fff
    style WARN fill:#8b0000,color:#fff
```

**The guard is a product feature, not a technicality.** A correlation computed on nine data
points from one athlete will look convincing and mean nothing. Fydr states sample size and
window on every analytical output, and refuses to draw a correlation below a minimum n.

> **Open question O-8**: minimum n before a correlation is displayed. I have set 20 paired
> observations as a placeholder. This needs your sports science judgement, not mine.

---

## 10. Offline and sync

```mermaid
graph TD
    ACT([Athlete action]) --> LW[Write to local SQLite<br/>with client-generated UUID]
    LW --> UI[UI updates immediately<br/>marked 'pending sync']
    LW --> Q[Append to sync queue]
    Q --> NET{Online?}
    NET -->|No| WAIT[Wait for connectivity]
    WAIT --> NET
    NET -->|Yes| PUSH[Push queue in order]
    PUSH --> RES{Response}
    RES -->|Success| CLR[Mark synced<br/>clear pending badge]
    RES -->|Conflict| CONF[Server wins for staff-owned data<br/>Client wins for athlete self-report]
    RES -->|Auth error| REAUTH[Re-authenticate<br/>preserve queue]
    RES -->|Network error| BACK[Exponential backoff<br/>max 5 min]
    BACK --> NET
    CONF --> CLR
    REAUTH --> PUSH

    style LW fill:#1f6feb,color:#fff
```

**Client-generated UUIDs are required.** They make sync idempotent: replaying a queue after
a crash cannot create duplicate entries. Do not use server-generated sequential IDs for any
row an athlete can create offline.

**Queue survives**: app termination, device restart, and reinstall-with-same-account is a
loss (documented, accepted). The queue is persisted, not in memory.
