/* Preload module for `node --import`: registers ts-alias-hooks.mjs before
 * the target script's own module graph starts loading, which is required —
 * `module.register()` has to run before the first import that needs it, and
 * a top-level `import`/`register()` pair in one file races the hoisted
 * import. See scripts/test-schedule-timezone.ts's own header for the run
 * command. */

import { register } from 'node:module';

register('./ts-alias-hooks.mjs', import.meta.url);
