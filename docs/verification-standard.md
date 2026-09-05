# What "verified" means

The specification claims things are checked. This says what checking means, and
what it does not.

**Why this exists.** While the specification was being written, three findings
were reported and later withdrawn as wrong. All three had the same shape: a page
was described as unguarded when it guards correctly. All three came from the same
cause, which was treating the shape of a file as evidence of its behaviour.

Nothing in the specification said what verification required, so nothing caught
it. This is that missing rule.

---

## The three levels

Every factual claim in the specification sits at one of these. Where a claim's
level is not obvious from how it is written, it should say.

### Read

**Somebody read the code that does this and can quote the line.**

This is the level almost everything in the specification sits at, and it is what
the phrase "verified access, from the code" means on all 62 screens. It is a real
standard: a Read level claim carries a file and a line number, and anyone who
doubts it can check in one step.

**What Read catches.** Wrong formulas, missing guards, absent features, states
that no code produces, constants nobody explained.

**What Read cannot catch.** Whether the thing actually behaves that way when a
person uses it. A control can be perfectly wired in the source and still be
unreachable, invisible, or broken by something three files away.

### Run

**Somebody made the app do it and saw the result.**

**Almost nothing in the specification is verified at this level**, and that should
be stated rather than implied. The exceptions are the handful of measurements
taken in a browser with transitions disabled and computed values read.

**What Run catches that Read cannot.** A control that looks interactive and is
not. A refusal that arrives as a blank page rather than a message. A number that
renders as `NaN` for one athlete. A permission that is correct in the code and
bypassed by a client side navigation. A guard that fires but leaves the page
half rendered first.

**The dashboard's readiness rows are the worked example.** They carried a pointer
cursor and a chevron and were not links. Every Read level check passed: the
component existed, the styles were right, the data was correct. Only pressing one
revealed it.

### Inferred

**Reasoned from the shape of the code without confirming it.**

**This level must not appear in the specification at all.** It is named so that it
can be recognised and rejected, not used.

**All three withdrawn findings were Inferred**, and each looked like Read at the
time:

- A scan found which guard function each page called and treated that as the whole
  answer. It could not see access computed on the next line and used to shape the
  page, so the **reports hub** was reported as leaving people refused at every
  link when it deliberately marks each card unavailable with the reason.
- The same scan counted how often a file mentioned each role. It could not tell a
  guard from a comment, so a **clinical review screen** was reported as open to
  any staff member when it redirects a non-medic on line 19.
- A search for one function name in one route was treated as proof of absence, so
  Fydr was reported as **sending no invitation emails** when it has a full email
  subsystem that single user creation uses.

**The tell, in every case:** the conclusion was drawn from what was not found
rather than from what was.

---

## The rule

**A finding that something is broken must be verified at the Run level before it
is reported.**

Everything else may be reported at Read, clearly labelled. But a claim that the
app does the wrong thing is different in kind from a claim about how it is built,
because of what happens next: somebody goes and changes working code.

**A false finding costs more than a missing one.** It wastes the fix, it risks
breaking something that worked, and it makes every other finding in the document
less believable. A reader who catches one wrong finding is right to wonder about
the rest.

This rule would have prevented all three withdrawals, at the cost of opening three
pages in a browser.

---

## Three habits that produce Inferred claims

Recognisable in advance, and each produced a real error here.

**Concluding from absence.** "I searched for X and did not find it, so X does not
happen." The email finding was exactly this. Absence of a match is evidence about
the search, not about the app. Say what was searched and treat the result as a
question rather than an answer.

**Trusting a scan across many files.** A pattern that works on nine files and
fails on the tenth produces a table that looks complete and is wrong in one row,
which is worse than an obviously incomplete table. **Nine of the route inventory's
role entries were wrong this way.** Every one erred in the same direction, which
should have been the clue: consistent bias is a property of the method, not of the
subject.

**Reading the guard and stopping.** A page can call a permissive guard and then
narrow access on the next line. Read the lines around the thing, not just the
thing.

---

## How UNVERIFIED is used

**UNVERIFIED means the answer could not be established, and names the files
searched.** It never means "probably fine" and it is never a way to avoid looking.

**An absent UNVERIFIED means it was checked.** That is a promise the specification
makes, and it is why UNVERIFIED must not be sprinkled defensively: if it appears
where somebody simply did not look, the absence of it stops meaning anything.

**Where a question would change what a screen specification says, it is listed as
needing resolution before sign off** rather than left in the body. Those lists are
at the end of `docs/spec-gaps.md`.

---

## Withdrawals

**Report a withdrawal as prominently as the finding.** If something previously
reported as broken turns out to work, say so plainly, in the same place, rather
than quietly deleting the entry.

`docs/decisions-required.md` keeps withdrawn entries in place, renumbered to
nothing, with what they claimed, what is actually true, and how the error arose.
A reader who acted on the original deserves to find the correction where they
found the claim.

---

## What this standard does not require

**Not everything needs Run.** Verifying 62 screens by hand in a browser would take
longer than writing them and would go stale faster. Read is the right level for
most of a specification.

**What it requires is honesty about which level applies**, and one hard line at
the point where the cost of being wrong changes: a claim that something is broken.

---

## Applying it to what exists

The specification as it stands is **Read level throughout**, with a handful of Run
level measurements on the dashboard.

**That is worth stating on the front page rather than leaving for a reader to
work out**, and it is now in the "how to read this document" section.

**The parts most worth raising to Run**, in order:

1. **Every control in section 6 of each screen specification.** This is where a
   dead control hides, and Read cannot find one.
2. **The refusal path on each of the 27 server routes.** Whether a route with no
   session refuses cleanly has not been tested by hand.
3. **The four access findings that remain open**, before anyone spends time
   fixing them.
