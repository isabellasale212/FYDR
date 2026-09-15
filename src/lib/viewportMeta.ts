/* THE INSTALLED APP DOES NOT ZOOM — Isabella, 15 September 2026, tested in
 * the standalone app: "wants pinch zoom gone entirely. It should behave like
 * an app, not a web page." The builder's recommendation was a 2× cap rather
 * than a block (WCAG 1.4.4); this is Isabella's call over it, recorded
 * either way (06-design-system.md §11.7).
 *
 * THE CAP IS IN THE BASE META, SERVER-RENDERED (16 September 2026, after the
 * 15 September build still zoomed on the phone it was tested on). That build shipped a meta
 * with no cap and rewrote it on the client once the app was found to be
 * standalone. Two things are wrong with that order on iOS: WebKit settles
 * the viewport when it parses the document, and a rewrite that arrives
 * after hydration is a change it may or may not act on — and nothing about
 * it can be verified from a desktop. So the athlete layout now renders
 * maximum-scale=1 and user-scalable=no in the HTML itself, where a
 * standalone launch reads them at parse and nothing ever removes them, and
 * the client RELAXES the meta only in a browser tab — the direction that
 * can be verified here, and that no phone's app depends on. A Safari tab
 * ignores the two directives by design either way, so the relaxation is
 * for Android Chrome and any tab that honours them; the installed app is
 * an app. Pure, so the guard can hold it. */
export const ZOOM_DIRECTIVES = ['maximum-scale=1', 'user-scalable=no'] as const;

const ZOOM_RE = /^(maximum-scale|user-scalable)\s*=/;

/** The meta as a browser tab should read it: the cap removed, the rest as
 *  it was — viewport-fit=cover above all. */
export function browserViewportContent(content: string): string {
  return content
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !ZOOM_RE.test(s))
    .join(', ');
}

/** The meta as the installed app must read it, for a guard that checks the
 *  rendered HTML: every directive the layout declares, the two of the cap
 *  among them. */
export function carriesZoomCap(content: string): boolean {
  const parts = content.split(',').map((s) => s.trim().replace(/\s+/g, ''));
  return ZOOM_DIRECTIVES.every((d) => parts.includes(d));
}
