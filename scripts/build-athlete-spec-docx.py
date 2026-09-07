"""Assemble the athlete app specification into one Word document.

Generated output. Never hand edited. Re-run it instead.

    python3 scripts/build-athlete-spec-docx.py

WHY IT IMPORTS THE STAFF EXPORTER RATHER THAN COPYING IT. The markdown to Word
conversion, the heading mapping, the table builder and the page number field are
already written and already correct in scripts/build-spec-docx.py. A second copy
would drift from the first the moment either is fixed, and the two documents are
meant to look like one product's documentation. Only the assembly order and the
cover are different, so only those are here.

Pandoc is not installed on this machine, so python-docx does the conversion.
Headings map to real Word heading styles, so the navigation pane and the table of
contents both work.
"""
import os
import sys
from datetime import date

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

# The staff exporter's filename is hyphenated, so it cannot be imported by name.
# Loaded by path instead. Its main() is guarded by __name__, so importing it does
# not write the staff document as a side effect.
import importlib.util

_spec_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-spec-docx.py")
_spec = importlib.util.spec_from_file_location("fydr_staff_spec_exporter", _spec_path)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
field, footer, render = _mod.field, _mod.footer, _mod.render

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "generated", "Fydr-Athlete-App-Specification.docx")
VERSION = "1.0"
TODAY = date.today().strftime("%d %B %Y")

SCREENS_DIR = os.path.join(ROOT, "docs/athlete/screens")

APPENDICES = [
    # The workbook comes first among the appendices on purpose: it is the part
    # Isabella acts on, and burying it behind six reference documents would make
    # the one actionable section the hardest to find.
    ("Appendix A. Open questions and decisions: the workbook", "docs/athlete/open-questions.md"),
    ("Appendix B. What an athlete can see", "docs/athlete/visibility.md"),
    ("Appendix C. Cross app flows", "docs/athlete/cross-app-flows.md"),
    ("Appendix D. Metrics parity", "docs/metrics-parity.md"),
    ("Appendix E. App Store readiness", "docs/athlete/app-store.md"),
    ("Appendix F. Decisions required", "docs/athlete/decisions-required.md"),
    ("Appendix G. Gap queue", "docs/athlete/spec-gaps.md"),
    ("Appendix H. Build state", "docs/athlete/generated/00-build-state.md"),
    ("Appendix I. Screen inventory", "docs/athlete/generated/01-screen-inventory.md"),
]

HOW_TO_READ = """
**This document describes the athlete app that exists.** It is a responsive web
app, running in a browser, sharing one codebase, one deployment and one Supabase
project with the staff app. **There is no iOS app.** Stage A0 established that and
re-verified it on 7 September 2026.

**Read the screen specification before changing a screen.** Each one is written as
a requirement in the present tense, not as a description of what the code happens
to do today.

**Formulas are not in this document.** Every number carries a metric ID, and the
formula lives once in `docs/metrics.md`, shared with the staff app. Appendix C
shows every metric both apps display and confirms they compute the same way.

**Two labels appear throughout and they mean different things.**

- **NOT BUILT** means the behaviour is specified here and no code implements it.
- **UNVERIFIED** means it could not be traced, and the entry says where the
  search looked. It is never a guess presented as a fact.

**Wording is specified exactly where an athlete types something**, because the
wording of a question changes what the answer means. All five wellness scales run
1 to 5 with **5 as the best answer**, including soreness, where 5 means no
soreness.

**Appendix A is the part you fill in.** Every unknown and every open decision in
this document is collected there as a numbered question, each explained in full
and each followed by a box to write the answer in. Twenty seven of them. They are
ordered so the ones that affect a real person come first, and seven of them can be
answered by opening a screen on a phone and writing down what it says.
"""


def main():
    doc = Document()
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)

    doc.add_paragraph()
    t = doc.add_heading("Fydr", level=0)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Athlete app build specification")
    r.bold = True
    r.font.size = Pt(18)
    for line in (
        f"Version {VERSION}",
        TODAY,
        "The app players use. Responsive web, not iOS.",
        "This document defines what the app is supposed to be.",
    ):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(line)
    doc.add_page_break()

    doc.add_heading("How to read this document", level=1)
    render(doc, HOW_TO_READ, base_level=1)
    doc.add_page_break()

    doc.add_heading("Contents", level=1)
    p = doc.add_paragraph()
    field(p, r'TOC \o "1-3" \h \z \u')
    doc.add_page_break()

    doc.add_heading("Screen specifications", level=1)
    files = sorted(f for f in os.listdir(SCREENS_DIR) if f.endswith(".md"))
    for name in files:
        md = open(os.path.join(SCREENS_DIR, name), encoding="utf-8").read()
        render(doc, md, base_level=1)
        doc.add_page_break()

    for title, rel in APPENDICES:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        doc.add_heading(title, level=1)
        render(doc, open(path, encoding="utf-8").read(), base_level=1)
        doc.add_page_break()

    footer(doc, f"Fydr athlete app specification, version {VERSION}, {TODAY}. Page ")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc.save(OUT)
    print(f"wrote {OUT}")
    print(f"{len(files)} screen specifications, {len(APPENDICES)} appendices")


if __name__ == "__main__":
    main()
