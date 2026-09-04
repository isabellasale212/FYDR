---
description: Regenerate the Word specification document from the markdown sources.
---

Regenerate `docs/generated/Fydr-Staff-App-Specification.docx`.

```bash
python3 scripts/build-spec-docx.py
```

If `python-docx` is not installed:

```bash
python3 -m pip install --user python-docx
```

## What it assembles

A cover page, a "how to read this document" page, a table of contents, then every
file matching `docs/screens/[0-9][0-9]-*.md` in route order, then six appendices:
the access matrix, the metrics registry, the decisions required, the spec gaps,
the role model and the route inventory.

## Rules

**This file is generated output and is never hand edited.** To change what it
says, change the markdown source and run this again.

**Heading levels map to real Word heading styles**, so the navigation pane and the
contents both work. A screen specification's own `#` heading becomes Heading 2
inside the document, and its numbered sections become Heading 3.

**The table of contents is a Word field.** It shows placeholder text until it is
built: in Word, select it and press F9, or open the document and choose to update
fields. This is normal and is not a fault in the export.

**After running, report** the file path, its size, the number of screen
specifications included, and the number of tables. If the count of screen
specifications is not what you expect, a file has been added or renamed outside
the `NN-route-slug.md` convention and will have been silently omitted.
