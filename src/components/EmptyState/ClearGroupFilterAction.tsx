'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { writeGroupFilterCookie } from '@/lib/groupFilterCookie';

/** The "Show the whole squad" action of a filter empty (PATTERN-S6 C8).
 *
 *  It cannot be a plain link. Under §0ak the cookie is the shared filter and a
 *  `?groups=` parameter overrides one page load only, so a link to a bare URL
 *  resolves back to the cookie and shows the same empty group again — the
 *  silent, sticky filter the S4 audit named. This does what the chip row's
 *  "Clear filter" does: writes the empty cookie through the one writer
 *  (lib/groupFilterCookie), then navigates to the href without `groups`. */
export function ClearGroupFilterAction({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <button
      type="button"
      className="btn-ghost empty-action"
      onClick={() => {
        writeGroupFilterCookie([]);
        /* When the filter came from the cookie the URL open is already bare,
           so the href IS the current URL and a push to it would hand back the
           tree the router has — still filtered. Refresh re-runs the server
           component against the cleared cookie; push is for a URL that still
           carries `groups`. */
        const query = params.toString();
        const current = query ? `${pathname}?${query}` : pathname;
        if (current === href) router.refresh();
        else router.push(href);
      }}
    >
      {label}
    </button>
  );
}
