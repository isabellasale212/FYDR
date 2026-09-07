/* An unmarked env file must never name production.
 *
 * WHY THIS EXISTS. On 2026-09-06 a `set -a && source .env.local` exported
 * production into a shell, a later `npm run dev` inherited it, and the dev
 * server spent an hour writing to live club data before anyone measured it
 * rather than assumed it. The morning after, `.env.local` still named
 * production and the ONLY thing keeping the dev server off it was
 * `.env.development.local` sitting one line above it in Next's lookup order.
 * Delete that file — or let `vercel env pull` rewrite `.env.local`, which is
 * what put a VERCEL_OIDC_TOKEN in it — and localhost is live again with no
 * error, no banner, and no difference you would notice until you had written
 * something.
 *
 * THE INVARIANT. Next resolves, in order: process.env, `.env.$(NODE_ENV).local`,
 * `.env.local`, `.env.$(NODE_ENV)`, `.env`. Of those, only the ones with
 * "production" in the name announce what they hold. Every other file is picked
 * up by an ordinary `next dev` or `next build` without anybody choosing it, so
 * none of them may point at the production project. Production is loaded by
 * naming it: `--env-file=.env.production.explicit`, a filename Next does not
 * look for on its own.
 *
 * WHAT IT DOES NOT CHECK. `.env.production.local` is left alone on purpose. It
 * is auto-loaded by `next build`, but a file with production in its name IS the
 * explicit, deliberate act being asked for, and a guard that also refuses that
 * would be refusing the escape hatch it recommends.
 *
 * The project ref below is not a secret. It is the hostname in every API URL
 * the production app serves to a browser; it is committed here so the guard
 * works on a machine that has no env files at all, which is where a hardcoded
 * value is worth more than a derived one.
 */
import { existsSync, readFileSync } from 'node:fs';

const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';

/* Every filename Next loads WITHOUT being told to, minus the ones that say
   "production" in the name. `.env.test*` is here for completeness: it is not
   loaded today, and the moment it is, it will be loaded by `next test` rather
   than by a decision. */
const UNMARKED = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.test', '.env.test.local'];

const offenders = UNMARKED.filter((f) => existsSync(f) && readFileSync(f, 'utf8').includes(PRODUCTION_REF));

if (offenders.length > 0) {
  console.error(`\nEnv guard: ${offenders.length} unmarked env file(s) name the PRODUCTION project.\n`);
  for (const f of offenders) console.error(`  ${f}  ->  ${PRODUCTION_REF}`);
  console.error(`
Next loads these without anybody choosing them, so this is the shape of the
2026-09-06 incident: localhost writing to live club data with nothing on screen
to say so.

To fix:
  1. Move the production values into .env.production.explicit, which Next does
     not look for. The commands that genuinely want production already name it
     (npm run db:push, verify:tier-rls).
  2. Put the SCRATCH values in .env.local — see .env.scratch for them.

If \`vercel env pull\` just rewrote .env.local, that is the cause: it pulls the
production environment. Re-run step 2.
`);
  process.exit(1);
}

const checked = UNMARKED.filter((f) => existsSync(f));
console.log(
  checked.length === 0
    ? 'Env guard: no unmarked env files on this machine, nothing to check.'
    : `Env guard: ${checked.length} unmarked env file(s) checked, none name production — ${checked.join(', ')}`,
);
