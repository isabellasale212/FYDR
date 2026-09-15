/* Types for coverage.mjs — see that file. */
export class CoverageError extends Error {}
export const COUNTS: {
  readonly migrations: number;
  readonly pgtapTests: number;
  readonly srcFiles: number;
  readonly srcTs: number;
  readonly srcTsx: number;
  readonly srcCss: number;
  readonly staffPages: number;
  readonly staffTsx: number;
  readonly staffRoutes: number;
  readonly athleteTsx: number;
  readonly componentTsx: number;
  readonly componentTs: number;
  readonly appTsx: number;
  readonly appTs: number;
  readonly appFiles: number;
  readonly appRoutesAndTsx: number;
  readonly appRoutes: number;
  readonly libTs: number;
  readonly appPages: number;
  readonly appLayouts: number;
  readonly athletePages: number;
};
/** Fail loudly unless `actual` (a number or a list) is exactly `expected`; returns `actual`. */
export function expectCount<T extends number | readonly unknown[]>(label: string, actual: T, expected: number): T;
