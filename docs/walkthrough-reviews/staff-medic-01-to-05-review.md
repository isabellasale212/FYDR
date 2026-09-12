# Persona review — STAFF-MEDIC-01, -02 and -05, with the two gate questions run both ways

**Persona.** The club physio: the only staff member who reads a diagnosis, on the touchline
with a phone when an injury happens.

**Account.** Ruth Callaghan, `r.callaghan@ashcomberfc.example` — medic only, on scratch,
its own Chrome profile (CDP port 9503). Jane Pemberton (sport scientist), Mark Iremonger
(coach), Owen Hartnell (S&C) and Sana Mirza (nutritionist) for the comparisons and the
database probes. **Reviewed 2026-09-12** at **1280×900 and 375×812**. Read-only: nothing
written on scratch; the one submit attempted was made with the network emulated offline and
refused by the app.

---

## Question 1 — what the medic sees that nobody else should, and who enforces it

**Read at the database, not the screen.** Each role's own session token (the tab's Supabase
cookie, refreshed by a page load) was used to call PostgREST directly on scratch —
`GET /rest/v1/<table>?select=*&limit=3` with `Prefer: count=exact` — so the answer is RLS's,
with no page in between.

| Table | Medic | Sport scientist (admin) | Coach | S&C | Nutritionist |
|---|---|---|---|---|---|
| `injury_clinical` (diagnosis, mechanism, severity, tissue, imaging, treatment) | **7 rows** | 0 | 0 | 0 | 0 |
| `problem_reports` (athletes' own words) | **4** | 0 | 0 | 0 | 0 |
| `problem_report_notes` | **1** | 0 | 0 | 0 | 0 |
| `sar_clinical_reviews` (include / withhold + reason) | **2** | **2** | 0 | 0 | 0 |
| `injuries` (censored: area, side, status, return) | 7 | 7 | 7 | 7 | 7 |
| `audit_log` | 0 | — | 0 | — | — |

So the clinical boundary is the database's: `clinical_medical_only` (0063) holds for every
non-medic role including the admin, and the censored `injuries` row is what everyone else
reads (0074 for the nutritionist, a recorded decision). **One row for Isabella, not a
defect:** the admin reads `sar_clinical_reviews` — the medic's include/withhold decision per
injury *and the free-text reason for a withholding* — by design of 0032 ("admin, medical"),
because the admin assembles the pack and must know what was withheld. The UI never renders
the reason to the admin (the review page is `CLINICAL_ONLY`); the database would. Whether a
clinician's withholding reason is admin-readable is a compliance question (§6 of the
security doc), asked in the questions file.

**On the screens**, measured as the medic against the sport scientist: the profile's Injury
panel is the one panel with two bodies — the medic's carries onset, diagnosis, mechanism,
severity, tissue type, imaging and the treatment plan with "Edit" and "Manage injury &
programme →" (227 leaves vs 211); no other panel differs. Regex over every non-medic render
of the same page, both athletes: no clinical word.

**In the exports and PDFs**, fetched with each role's own session and read after
decompressing every stream (`pdftotext` on the PDFs):

| Artefact | Coach | Medic |
|---|---|---|
| `/reports/injuries/export` (CSV) | no clinical word | no clinical word |
| `/reports/injuries/pdf` | 5,591 bytes, no clinical word | 7,054 bytes: a "MEDICAL IN CONFIDENCE" header and a "New injuries by body area" table; **still no diagnosis, mechanism or treatment** |
| `/reports/athlete/{id}/export` (CSV) | no clinical word | no clinical word |
| `/reports/athlete/{id}/pdf` | 9,737 bytes | **byte-identical** to the coach's |
| `/reports/squad/export`, `/reports/compliance/export` | no clinical word | — |

The medic's injuries PDF differs from the coach's only by the confidentiality banner and a
body-area count; the body areas are already in the coach's DETAIL column. **Nothing
clinical leaves the app in an export or a PDF for any role, the medic included.** (The SAR
pack, the one artefact that carries clinical content on purpose, is the admin's flow —
SS-30g — and is reviewed with MEDIC-30g.)

**Found in the PDF, both roles (§0ay):** the injuries PDF's DETAIL column falls back to the
word "Restricted" when a row has no body area and no restriction — so an athlete with no
availability recorded prints as "Unknown · Restricted" (Dan Okonkwo, Kai Mercer and the
scratch-only "Walkthrough Reference" athlete). The web page handles `unknown` separately;
the PDF does not.

## Question 2 — pitch-side, phone in hand, no signal, an injury just happened

**As the medic at 375, `/injuries/new` opened online, then the network cut:** filled the
form (athlete, body area) and pressed "Create injury record". The app refused honestly —
`role="alert"` "That didn't save — the connection dropped or timed out. Check your
connection and try again." — the form stayed, the values stayed, the button stayed
enabled. Back online the alert stayed until a retry. **No queue:** the staff app has no
outbox (the athlete app's `OutboxFlusher` is the athlete's alone) and no service worker
(§0b L751 / §3 L1988, open), so:

- with no signal **from the start, the medic cannot open the form at all** — nothing loads;
- with signal lost **after** opening it, nothing typed is lost while the page stays open,
  and nothing is saved until signal returns.

What the medic can reach with the form open: athlete, body area, side, onset date,
"occurred during", expected return — **the non-clinical fields only; no clinical field is on
the create form even for the medic** (diagnosis and the rest are added on the injury's own
page afterwards). PATTERN-S3 C9's pitch-side four-field form is queued; the offline half is
the service-worker item. Recorded on the pilot list against the medic persona.

---

## STAFF-MEDIC-01 — Read the dashboard

**Identical, verified** (122 leaves, 25 controls, 1,602 / 3,005px). Bar slot: Flags.

## STAFF-MEDIC-02 — Browse the squad

**Identical minus "Add athlete"** (`SETTINGS_ADMIN`), as for the coach; sideways scroll at
375 (§0ap's roster table) — the medic's touchline roster.

## STAFF-MEDIC-05 — Athlete profile: the only role that sees clinical detail

**Identical to STAFF-SS-05 plus the clinical Injury panel, minus the SAR section** — 3,378px
at desktop (the sport scientist's 3,117), **6,134 at phone**, sideways scroll at 375. The
clinical panel is the sixth of nine on a page that starts with Athleticism; for the physio
it is the first thing they open the page for. The Body-weight trio is live (`WEIGH_IN_EDIT`),
corrections live (`ENTRY_CORRECTION`), the header "Edit" live (`ATHLETE_BIO_EDIT`).

---

## Summary for design

1. **The physio's first question is the sixth panel down**, 6,134px at phone. *(Design; the
   SS-02-05 board's role-ordered panels (C4) is the answer — the inventory gives the medic's
   order.)*
2. **Pitch-side with no signal is a blank page.** *(Design and build: the service-worker
   item, already open; the S3 C9 pitch-side form does not help without it.)*
3. **The injuries PDF prints "Restricted" for an unknown status.** *(Defect, §0ay, both
   roles.)*
4. Right and worth keeping: the "MEDICAL IN CONFIDENCE" banner on the medic's PDF; the
   honest offline refusal that keeps the typed values.
5. Boundaries verified at the database: every clinical table medic-only; the censored
   injury row for the other four; the admin's read of SAR reviews (a question, not a
   finding).

## Claims checked

| Claim | Verdict |
|---|---|
| 01, 02 identical | **Identical** (02 minus Add athlete). |
| 05: SS-05 plus diagnosis and mechanism | **Plus** onset, severity, tissue, imaging, treatment, two links; **minus** the SAR section. Corrected. |
| "The medic is the only staff role that reads them" | **Verified at the database**, all five roles. |
