#!/usr/bin/env python3
"""Assemble the Fydr staff app specification into a Word document.

Generated output. Never hand edited: run this again instead.
Heading levels map to real Word heading styles so the navigation pane and the
table of contents both work.
"""
import re, sys, glob, os, datetime
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = "1.1"
TODAY = datetime.date.today().strftime("%d %B %Y")
OUT = os.path.join(ROOT, "docs", "generated", "Fydr-Staff-App-Specification.docx")

INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*]+\*)")

def add_runs(par, text):
    """Bold, italic and code, without a markdown library."""
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            par.add_run(part[2:-2]).bold = True
        elif part.startswith("`") and part.endswith("`") and len(part) > 2:
            r = par.add_run(part[1:-1]); r.font.name = "Consolas"; r.font.size = Pt(9)
            r.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            par.add_run(part[1:-1]).italic = True
        else:
            par.add_run(part)

def field(par, instr):
    """A Word field, used for the table of contents and page numbers."""
    r = par.add_run()
    for tag, attrs, text in (("w:fldChar", {"w:fldCharType": "begin"}, None),
                             ("w:instrText", {"xml:space": "preserve"}, instr),
                             ("w:fldChar", {"w:fldCharType": "separate"}, None),
                             ("w:t", {}, "Update this field to build"),
                             ("w:fldChar", {"w:fldCharType": "end"}, None)):
        el = OxmlElement(tag)
        for k, v in attrs.items():
            el.set(qn(k) if ":" in k else k, v)
        if text: el.text = text
        r._r.append(el)

def add_table(doc, rows):
    header, body = rows[0], rows[1:]
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Light Grid Accent 1"
    for i, cell in enumerate(header):
        p = t.rows[0].cells[i].paragraphs[0]
        add_runs(p, cell)
        for r in p.runs: r.bold = True
    for row in body:
        cells = t.add_row().cells
        for i, cell in enumerate(row[:len(header)]):
            add_runs(cells[i].paragraphs[0], cell)
    doc.add_paragraph()

def render(doc, md, base_level=0):
    """Markdown to Word. Headings shift by base_level so a file's H1 can sit
    under a section heading in the assembled document."""
    lines = md.split("\n")
    i, pending = 0, []
    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("|") and line.endswith("|"):
            pending.append([c.strip() for c in line.strip("|").split("|")])
            i += 1
            continue
        if pending:
            # A markdown separator row is |---|---|. A row of EMPTY cells is not
            # one, and the old test treated it as one because the empty set is a
            # subset of everything. That silently deleted any deliberately blank
            # table row, which is what an answer box in the athlete workbook is
            # made of: the box rendered as a header with nowhere to write.
            # Requiring at least one dash keeps real separators out and blank
            # rows in.
            def _is_separator(row):
                return any("-" in c for c in row) and all(set(c) <= set("-: ") for c in row)

            rows = [r for r in pending if not _is_separator(r)]
            if len(rows) >= 1: add_table(doc, rows)
            pending = []
        if not line.strip():
            i += 1; continue
        m = re.match(r"^(#{1,6}) (.*)$", line)
        if m:
            lvl = min(len(m.group(1)) + base_level, 9)
            h = doc.add_heading("", level=lvl)
            add_runs(h, m.group(2))
        elif line.strip() in ("---", "***"):
            pass
        elif line.startswith("```"):
            i += 1; buf = []
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i]); i += 1
            p = doc.add_paragraph()
            r = p.add_run("\n".join(buf)); r.font.name = "Consolas"; r.font.size = Pt(9)
            p.paragraph_format.left_indent = Inches(0.3)
        elif re.match(r"^\s*[-*] ", line):
            p = doc.add_paragraph(style="List Bullet")
            add_runs(p, re.sub(r"^\s*[-*] ", "", line))
        elif re.match(r"^\s*\d+\. ", line):
            p = doc.add_paragraph(style="List Number")
            add_runs(p, re.sub(r"^\s*\d+\. ", "", line))
        elif line.startswith(">"):
            p = doc.add_paragraph(); p.paragraph_format.left_indent = Inches(0.4)
            add_runs(p, line.lstrip("> ")); 
            for r in p.runs: r.italic = True
        else:
            add_runs(doc.add_paragraph(), line)
        i += 1
    if pending:
        rows = [r for r in pending if not all(set(c) <= set("-: ") for c in r)]
        if rows: add_table(doc, rows)

def footer(doc, text):
    for section in doc.sections:
        p = section.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(text + "    Page ")
        field(p, "PAGE")

def main():
    doc = Document()
    st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5)

    # Cover
    doc.add_paragraph()
    t = doc.add_heading("Fydr", level=0)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Staff app build specification"); r.bold = True; r.font.size = Pt(18)
    for line in (f"Version {VERSION}", TODAY,
                 "This document defines what the app is supposed to be.",
                 "It is not a description of the current build."):
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(line)
    doc.add_page_break()

    # How to read
    doc.add_heading("How to read this document", level=1)
    render(doc, open(os.path.join(ROOT, "docs/generated/_how-to-read.md"), encoding="utf-8").read(), base_level=1)
    doc.add_page_break()

    # Contents
    doc.add_heading("Contents", level=1)
    field(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u')
    doc.add_page_break()

    # Screens, in route order
    doc.add_heading("Screen specifications", level=1)
    files = sorted(glob.glob(os.path.join(ROOT, "docs/screens/[0-9][0-9]-*.md")))
    for f in files:
        render(doc, open(f, encoding="utf-8").read(), base_level=1)
        doc.add_page_break()

    # Appendices
    for title, path in (("Appendix A: Access matrix", "docs/access-matrix.md"),
                        ("Appendix B: Metrics registry", "docs/metrics.md"),
                        ("Appendix C: Server routes", "docs/server-routes.md"),
                        ("Appendix D: State machines", "docs/state-machines.md"),
                        ("Appendix E: Decisions required and spec mismatches", "docs/decisions-required.md"),
                        ("Appendix F: Spec gaps, ordered by risk", "docs/spec-gaps.md"),
                        ("Appendix G: What \"verified\" means", "docs/verification-standard.md"),
                        ("Appendix H: Role model", "docs/generated/00-role-model.md"),
                        ("Appendix I: Route inventory", "docs/generated/01-route-inventory.md")):
        doc.add_heading(title, level=1)
        render(doc, open(os.path.join(ROOT, path), encoding="utf-8").read(), base_level=1)
        doc.add_page_break()

    footer(doc, f"Fydr staff app specification  v{VERSION}  {TODAY}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc.save(OUT)
    print(f"wrote {OUT}")
    print(f"{len(files)} screen specifications, 9 appendices")

if __name__ == "__main__":
    main()
