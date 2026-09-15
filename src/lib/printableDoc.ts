/* The print screen's one input (Isabella, 15 Sept 2026, mobile queue #15):
 * `/print?doc=` names one of this app's own PDF routes, and this decides
 * whether it does. Same-origin only — a leading slash, never two, no
 * scheme — a path ending in /pdf (every PDF route is `…/pdf/route.tsx`),
 * the query kept without `open`, which the print screen's own two links
 * set. Anything else is null and the screen is not found: it frames the
 * app's documents, it does not proxy addresses. A plain module, so the
 * guard can call it. */
export function printableDoc(doc: string | null | undefined): string | null {
  if (!doc || !doc.startsWith('/') || doc.startsWith('//') || doc.startsWith('/\\')) return null;
  let url: URL;
  try {
    url = new URL(doc, 'http://fydr.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://fydr.invalid' || !url.pathname.endsWith('/pdf')) return null;
  url.searchParams.delete('open');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}
