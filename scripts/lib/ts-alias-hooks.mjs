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

/* `server-only` throws on import outside a React Server Component, which is the
   whole point of it: a module carrying that marker must never reach the browser.
   A Node script is neither, so the marker fires on a context it was not written
   about and blocks the import.
   
   Stubbed rather than removed from the module being imported. The alternative
   was to copy that module's logic into the script, and for lib/invite.ts in
   particular that would mean a SECOND way this repo creates a sign-in — which is
   exactly what its header says must not exist. A script importing the real one
   keeps the guarantee testable; a script reimplementing it quietly voids it.
   
   Narrow on purpose: only this one specifier, and only in scripts that opt in by
   loading these hooks. Nothing here weakens the marker for the app itself, which
   uses Next's resolution and never loads this file. */
export async function load(url, context, nextLoad) {
  if (url === 'stub:server-only') {
    return { format: 'module', shortCircuit: true, source: 'export {};' };
  }
  return nextLoad(url, context);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'stub:server-only', format: 'module', shortCircuit: true };
  }
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
