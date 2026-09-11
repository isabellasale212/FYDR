import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

/* Shared PDF rendering for report exports, using @react-pdf/renderer — a
 * pure-JS, server-side PDF layout engine (no headless browser, no native
 * binaries), actively maintained and built for exactly this: React
 * components in, a real PDF buffer out. Every earlier file in this build
 * that said "no PDF rendering pipeline... needs infrastructure this
 * environment doesn't have" was wrong about *why* — there was no missing
 * infrastructure, just a library that hadn't been evaluated yet. Verified
 * with a real render before writing a line of report content: see the
 * decision recorded in reports/squad/pdf/route.ts, the first report this
 * landed on. All five of this build's reports have a PDF export now —
 * Compliance, Injury & availability, the Athlete report and Testing
 * followed once Squad weekly proved the pattern held up against real data.
 *
 * What's still genuinely cut, and why it's different from the PDF gap:
 * scheduled delivery (email/push) needs a real external service — an email
 * provider's API key, a job scheduler — none of which exist in .env.local
 * and none of which this session can provision without the user obtaining
 * an account and credentials. That one stays a real, external-dependency
 * cut. PDF rendering had no such dependency once actually checked.
 *
 * Design choices, each a real simplification:
 *   - Helvetica only, the PDF standard font built into every reader — no
 *     custom font embedding. The web app's actual typeface isn't licensed
 *     for embedding and isn't needed for a print document to read cleanly.
 *   - Light/print colours only, taken from tokens.css's light theme by
 *     value (this renders server-side with no access to CSS custom
 *     properties or a browser, so the hex values are copied here directly,
 *     not derived). A printed page has no dark mode.
 *   - No charts. The wellness band chart and heat-map tint are both real
 *     screen-only rendering (SVG, cell shading) with no PDF equivalent —
 *     same reasoning reports/training/page.tsx's own CSV export already
 *     gives for leaving colour out of a downloadable file. Tables and
 *     headline numbers only.
 */

/* Verified with a real 28-athlete render: the tile row, both tables and the
 * footer all came out correctly, laid out across two pages exactly where
 * A4's height ran out. One honest, minor cosmetic gap found in that same
 * render: a table's header row doesn't repeat when its body spills onto the
 * next page, so a reader relying on a running header for a long table has
 * to scroll back to page 1 to remember which column is which. Real, small,
 * and not fixed in this pass — repeating headers need per-table page-break
 * awareness this component doesn't have yet. */

export const PDF_COLOR = {
  accent: '#17489b', // the brand accent, 11 Sept 2026, Isabella's decision
  text: '#13161c',
  muted: '#5b636e',
  faint: '#929aa5',
  border: '#e4e1db',
  good: '#0f8a72',
  warn: '#8a5a00',
  bad: '#b31e1e',
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: PDF_COLOR.text,
  },
  eyebrow: {
    fontSize: 8,
    color: PDF_COLOR.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  meta: {
    fontSize: 9,
    color: PDF_COLOR.muted,
    marginBottom: 16,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLOR.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 6,
  },
  sectionCaption: {
    fontSize: 8.5,
    color: PDF_COLOR.muted,
    marginBottom: 8,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_COLOR.border,
    borderRadius: 4,
    padding: 8,
  },
  tileLabel: {
    fontSize: 7.5,
    color: PDF_COLOR.muted,
    marginBottom: 3,
  },
  tileValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    width: '100%',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLOR.border,
    paddingVertical: 4,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLOR.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    fontSize: 9,
  },
  tdRight: {
    fontSize: 9,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: PDF_COLOR.faint,
    textAlign: 'center',
  },
  medicalBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PDF_COLOR.bad,
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 4,
    letterSpacing: 1,
  },
});

export function PdfHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <View>
      <Text style={pdfStyles.eyebrow}>{eyebrow}</Text>
      <Text style={pdfStyles.title}>{title}</Text>
      <Text style={pdfStyles.meta}>{meta}</Text>
      <View style={pdfStyles.hr} />
    </View>
  );
}

export function PdfTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <View style={pdfStyles.tile}>
      <Text style={pdfStyles.tileLabel}>{label}</Text>
      <Text style={[pdfStyles.tileValue, tone ? { color: PDF_COLOR[tone] } : {}]}>{value}</Text>
    </View>
  );
}

/** screens/reports.md: "Medical reports carry a visible 'Medical in
 *  confidence' banner on every page and in the PDF header and footer, and
 *  their file name states it." `fixed` repeats it on every page, not just
 *  the one it's placed on — see reports/injuries/pdf/route.tsx for the
 *  header, footer and filename halves of the same rule. */
export function PdfMedicalBanner() {
  return (
    <Text style={pdfStyles.medicalBanner} fixed>
      MEDICAL IN CONFIDENCE
    </Text>
  );
}

export function PdfTileRow({ children }: { children: ReactNode }) {
  return <View style={pdfStyles.tileRow}>{children}</View>;
}

export function PdfSectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      {caption ? <Text style={pdfStyles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

export type PdfColumn<T> = { key: string; label: string; width: string; align?: 'left' | 'right'; render: (row: T) => string };

export function PdfTable<T>({ columns, rows, emptyText }: { columns: PdfColumn<T>[]; rows: T[]; emptyText: string }) {
  if (rows.length === 0) {
    return <Text style={{ fontSize: 9, color: PDF_COLOR.muted }}>{emptyText}</Text>;
  }
  return (
    <View style={pdfStyles.table}>
      <View style={pdfStyles.tr} wrap={false}>
        {columns.map((c) => (
          <Text key={c.key} style={[pdfStyles.th, { width: c.width, textAlign: c.align ?? 'left' }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        // Rows have no stable id at this layer; index is stable for a single static render.
        <View style={pdfStyles.tr} key={i} wrap={false}>
          {columns.map((c) => (
            <Text key={c.key} style={[c.align === 'right' ? pdfStyles.tdRight : pdfStyles.td, { width: c.width, textAlign: c.align ?? 'left' }]}>
              {c.render(row)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PdfReport({ children, footer }: { children: ReactNode; footer: string }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page} wrap>
        {children}
        <Text style={pdfStyles.footer} fixed>
          {footer}
        </Text>
      </Page>
    </Document>
  );
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
