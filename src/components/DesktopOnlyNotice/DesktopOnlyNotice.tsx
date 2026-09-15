import Link from 'next/link';

/* A DESKTOP-ONLY VIEW, said so at phone width (Isabella, 15 Sept 2026,
 * mobile queue #18 and #20): the reports, and creating a gym programme.
 * Drawn below 768px only — data-phone-only is base.css's width gate — in
 * place of the screen it stands for. Presentation, not permission: the
 * screen is in the page at every width, the server answers it as it
 * always has, and a tablet held upright or a narrow desktop window sees
 * this notice too (the known consequence of a width breakpoint). One
 * title, one sentence, one way on. */
type Props = {
  title: string;
  body: string;
  /** Where the reader goes from here — the section this screen hangs off. */
  action: { href: string; label: string };
};

export function DesktopOnlyNotice({ title, body, action }: Props) {
  return (
    <div className="card desk-note" data-phone-only="" role="status">
      <h2 className="desk-note-title">{title}</h2>
      <p className="desk-note-body">{body}</p>
      <Link href={action.href} className="btn-ghost desk-note-action">
        {action.label}
      </Link>
    </div>
  );
}
