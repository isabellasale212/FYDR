'use client';

import { useEffect, useId, useRef } from 'react';

/* THE ONE DIALOG PATTERN — B11 (Isabella, 2026-09-13), built once and
 * reused: the export dialog (PATTERN-S7 C3 / S8 C8), the finish-early
 * confirmation (ATH-ADULT-10 C2), the template-replace warning (B7). Its
 * rule travels with it: a dialog exists only where the action is
 * destructive or irreversible — never for a confirmation that merely slows
 * someone down. Anything reversible uses an armed card in place
 * (GroupArchiveCard) or an inline preview (the role change).
 *
 * The native <dialog> element: showModal() gives the scrim, focus trapping,
 * Escape, and inert content behind it for free; --w-dialog (640px, group A)
 * is its width, clamped to the viewport with the standard side gutter below
 * it. Focus returns to the opener on close because the browser does that
 * for showModal(). `title` is the accessible name; the body is whatever the
 * caller renders; `actions` is the row at the foot, primary first. */
type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  /** The card's edge: warn for a consequence, bad for the irreversible. */
  tone?: 'warn' | 'bad';
};

export function Dialog({ open, onClose, title, children, actions, tone }: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dlg${tone ? ` dlg-${tone}` : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        /* A click on the backdrop lands on the dialog element itself; a click
           inside lands on a child. */
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dlg-body">
        <h2 className="card-title dlg-title" id={titleId}>
          {title}
        </h2>
        {children}
        <div className="dlg-actions">{actions}</div>
      </div>
    </dialog>
  );
}
