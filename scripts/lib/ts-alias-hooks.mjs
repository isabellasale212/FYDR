/* Node ESM resolve hook so a plain `node --experimental-strip-types` script
 * can import repo TypeScript modules directly, the same two things `tsc`
 * (via tsconfig.json's `paths`) and Next.js's bundler both resolve for free
 * but the bare Node loader does not:
 *
 *  - the `@/*` -> `./src/*` path alias every app module is written against
 *    (tsconfig.json's own `paths` entry, not reinvented here — this is a
 *    minimal runtime mirror of that one mapping for a script context that
 *    is not itself compiled or bundled).
 *  - extensionless relative TS imports (`./groups`, not `./groups.ts`) that
 *    every query file uses, which `tsc` resolves but Node's ESM resolver
 *    does not.
 *
 * Only used by test scripts run directly with `node --experimental-strip-types`
 * (see scripts/test-schedule-timezone.ts). The app itself never loads this —
 * Next.js has its own resolution. */

import { pathToFileURL } from 'node:url';

const root = pathToFileURL(process.cwd() + '/');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = new URL('src/' + specifier.slice(2) + '.ts', root);
    return nextResolve(target.href, context);
  }
  if (specifier.startsWith('.') && !/\.[a-zA-Z]+$/.test(specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(specifier + '.ts', context);
    }
  }
  return nextResolve(specifier, context);
}
