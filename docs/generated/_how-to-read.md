This document set defines what the Fydr staff app is supposed to be. It is
consulted before any code is written, and updated whenever agreed behaviour
changes. It is **not** a description of the current build: where the two differ,
the difference is recorded as a numbered decision and a queued piece of work.

**It is written for a coach or a club administrator, not a developer.** Every
formula is explained in words before any arithmetic appears, and jargon is
expanded the first time it is used. If a sentence does not make sense to you,
that is a fault in this document rather than in you, and worth saying so.

**How it is organised.**

The **screen specifications** are the body of the document, one per page of the
app, in the order the app is laid out. Each has the same nine sections, so you
can always find the same thing in the same place: who can reach it, how you get
there, what you see, every number, every thing you can act on, how it is built,
what it does when things go wrong, and what is still open.

**Every number in the app has an identifier**, such as MET-014, and appears in
the metrics registry at Appendix B with its full calculation. Screen
specifications refer to numbers by identifier and never restate a formula, so
there is exactly one place to change a calculation and exactly one place to look
it up.

**Every difference between this specification and the code has a decision
number**, such as D-01, in Appendix E, with a recommendation and a reason. Those
same differences appear again in Appendix F as a work queue ordered by risk.

**Three appendices cover what the screen specifications do not.** The **server
routes** appendix covers the 27 addresses that produce files or perform actions
rather than render pages, which is where this app's one real access breach
happened. The **state machines** appendix lists every set of named states a record
moves through and which moves are allowed. The **verification standard** says what
this document means when it claims something is verified.

**Three phrases are used precisely.**

**NOT BUILT** means the specification requires it and the code does not do it.

**UNVERIFIED** means the answer could not be established from the code, and names
the files that were searched. It never means "probably fine".

**Recorded rather than raised** means something is worth knowing but needs no
decision from you.

**Where a code reference appears**, such as `src/lib/session.ts:69`, it names the
file and line that the statement was taken from. You do not need to read it. It is
there so that anyone who doubts a claim can check it in one step.


---

**How thoroughly each part was checked, stated plainly so you can weigh it.**

The screen specifications were written in two passes. The first wrote all 62. The
second re-checked every page's access against the code, resolved six of the seven
questions the first pass could not answer, and corrected what it found.

**That second pass withdrew three findings as wrong** and found four new defects
the first pass had missed, including one ranked high risk: re-uploading a GPS file
duplicates every row. Every withdrawal is recorded in Appendix C rather than
quietly removed, so you can see what changed and why.

**Every page in this document now carries a "verified access" line** naming the
exact guards that run and where they are, taken from the code rather than
inferred. Where a statement elsewhere is less certain, it says UNVERIFIED and
names the files searched. **An absent UNVERIFIED means it was checked**, not that
nobody looked.

**This document is verified at the Read level throughout**, meaning somebody read
the code that does the thing and can quote the line. A handful of dashboard
measurements are verified at the Run level, meaning somebody made the app do it
and saw the result. The difference matters and the standard explains it: Read
cannot catch a control that looks interactive and is not.
