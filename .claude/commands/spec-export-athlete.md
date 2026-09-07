Regenerate the athlete app specification Word document.

    python3 scripts/build-athlete-spec-docx.py

Writes `docs/generated/Fydr-Athlete-App-Specification.docx` from the markdown in
`docs/athlete/`. **Generated output, never hand edited.** If the document is
wrong, fix the markdown and re-run this.

It assembles: a cover, how to read this document, a Word table of contents field,
the eighteen screen specifications in order, then appendices for visibility, cross
app flows, metrics parity, App Store readiness, decisions, the gap queue, build
state and the screen inventory.

Pandoc is not installed on this machine, so python-docx does the conversion. The
markdown to Word converter is imported from `scripts/build-spec-docx.py` rather
than duplicated, so both documents stay consistent.
