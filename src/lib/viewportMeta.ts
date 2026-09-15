/* THE INSTALLED APP DOES NOT ZOOM — Isabella, 15 September 2026, tested in
 * the standalone app: "wants pinch zoom gone entirely. It should behave like
 * an app, not a web page." The builder's recommendation was a 2× cap rather
 * than a block (WCAG 1.4.4); this is Isabella's call over it, recorded
 * either way (06-design-system.md §11.7).
 *
 * The viewport meta the athlete layout renders carries no cap. In standalone
 * — the manifest's display mode honoured, or Safari's navigator.standalone —
 * the client rewrites it to carry maximum-scale=1 and user-scalable=no,
 * keeping everything already there, viewport-fit=cover above all (P5: without
 * it every safe-area inset is zero). A Safari TAB ignores maximum-scale and
 * user-scalable by design, so the browser still zooms and the installed app
 * does not; that difference is the platform's, not a bug. Pure, so the guard
 * can hold it. */
export const STANDALONE_ZOOM_DIRECTIVES = ['maximum-scale=1', 'user-scalable=no'] as const;

export function standaloneViewportContent(content: string): string {
  const parts = content
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^(maximum-scale|user-scalable)\s*=/.test(s));
  return [...parts, ...STANDALONE_ZOOM_DIRECTIVES].join(', ');
}
