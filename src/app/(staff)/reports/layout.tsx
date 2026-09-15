import { DesktopOnlyNotice } from '@/components/DesktopOnlyNotice/DesktopOnlyNotice';

/* #18 (Isabella, 15 Sept 2026, mobile queue): REPORTS ARE DESKTOP-ONLY.
 * Below 768px this notice is what the section shows and the report itself
 * is hidden — base.css's `.main:has(> .desk-note)` rule, so nothing wraps
 * the pages and the desktop DOM is exactly what it was. The pages still
 * render and still answer at every width: this is presentation, not
 * permission (docs/access-matrix.md, "Phone-width presentation"). The More
 * sheet has no Reports row for the same reason (shell.ts). */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopOnlyNotice
        title="Reports are desktop-only"
        body="Open Fydr on a desktop or laptop to read and export a report. Everything else is here on your phone."
        action={{ href: '/dashboard', label: 'Back to Dashboard' }}
      />
      {children}
    </>
  );
}
