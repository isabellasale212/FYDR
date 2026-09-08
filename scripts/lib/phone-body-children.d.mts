/* Types for phone-body-children.mjs.
 *
 * A .d.mts rather than converting the module to TypeScript: the guard runs
 * under `node --experimental-strip-types` with no loader, so importing a `.ts`
 * path would need `allowImportingTsExtensions` in tsconfig — a project-wide
 * setting to serve one script. A declaration file keeps tsc satisfied and the
 * runtime unchanged. */
export type JsxChild = {
  /** The tag name as written, e.g. `div` or `AvailabilityBanner`. */
  tag: string;
  /** The raw attribute text, for className and style extraction. */
  attrs: string;
  /** Set when this element was resolved through a locally-defined component:
   *  the component whose root this is. */
  via?: string;
};
/** The elements that become direct children of `.phone-body` for one page. */
export function topLevelChildren(src: string): JsxChild[];
/** The className value from an attribute string, or ''. */
export function cls(attrs: string): string;
/** `marginTop: 14` style text from an inline style object, or null. */
export function inlineMargin(attrs: string): string | null;
