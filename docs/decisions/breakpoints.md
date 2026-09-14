# The breakpoints — a record read out of the stylesheet

**A record, not new work. Written 16 September 2026 from `src/styles/base.css`
as it is; nothing was changed to write it.** The question "at what width does
the web layout become the mobile one" had no written answer; the stylesheet
has had one since the phone shell was built.

## The one that matters: 767px

**Below 768px the staff app is the phone app.** `@media (max-width: 767px)` is
the most-used query in the file (nineteen blocks), and it is where the shell
changes shape:

- the `.app` grid drops its sidebar column and the rail strip
  (`grid-template-columns: minmax(0, 1fr)`; `background-image: none`);
- the phone shell appears (`.ph-shell { display: block }` — hidden at every
  width above): a fixed 64px title bar, the five-tab bottom bar, the More
  sheet;
- the 44px floor for staff controls applies ("THE 44px FLOOR, staff controls
  below 768", `--tap-min`), and inline links take the padding-and-negative-
  margin extension so they clear it without moving;
- report tables become cards where they are marked to (`table.tbl.tbl-cards`,
  at 900px, below).

`@media (min-width: 768px)` is its mirror (eight blocks): the desktop-only
rules.

## The rail: 768–1023px

`@media (min-width: 768px) and (max-width: 1023px)`: the sidebar narrows to
its 64px icon rail (`grid-template-columns: 64px minmax(0, 1fr)`), the same
drawing cropped to its icon tier. From 1024px up the full 236px sidebar
(`--sidebar-w`; System A's 214px is a recorded divergence).

## The others, each local

- **900px** (twelve blocks): dense tables become cards (`table.tbl.tbl-cards`
  — audit log, retention, subject access); two-column report bodies stack;
  the skeletons' two columns stack with them.
- **1100px** (eight) and **1150px / 1200px**: the widest page grids — the
  player profile's `.pp-grid`, the programme body — go to one column before
  the sidebar narrows, because their two columns need the width more than the
  rail saves.
- **1079px** (three): the sign-in launch page's own layout, unrelated to the
  app shell.
- **700px, 640px, 560px**: single components (the availability tiles, a
  chip row) wrapping earlier than the shell does.

## The athlete app has no breakpoint

It is a phone column at every width: `.phone { max-width: 480px;
margin-inline: auto }` on a `--surf-sunken` desk (`body:has(.phone)`), the
same on a 390px phone and a 1440px monitor. Nothing in it changes shape with
the viewport; it is the mobile layout, always.

## How to read this when adding a screen

A staff screen is designed at 1440 and must work at 390. Between them it
passes 1023 (rail) and 767 (phone shell) — test at 1440, 1000, 800 and 390,
and treat 767 as the line: above it a sidebar and a mouse, below it a tab bar
and a thumb, with the 44px floor.
