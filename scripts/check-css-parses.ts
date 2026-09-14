/* Both stylesheets parse as CSS.
 *
 * WHY THIS EXISTS. On 15 Sept 2026 a comment in tokens.css named two token
 * families as "fs-star slash sp-star" with the real characters — and a star
 * followed by a slash ends a comment, so the rest of the file was
 * parsed as declarations, Next reported "Parsing CSS source code failed" and
 * every page rendered its error overlay. Prebuild was green: every guard
 * reads the stylesheet as text with regexes, and not one of them parses it,
 * so the build that would have caught it was the deploy's own `next build`.
 * The whole product's styling depends on two files parsing; this asks a real
 * parser, before anything else runs.
 */
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

let failed = 0;
for (const file of ['src/styles/tokens.css', 'src/styles/base.css']) {
  try {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    let decls = 0;
    root.walkDecls(() => { decls += 1; });
    console.log(`  ok   - ${file} parses (${decls} declarations)`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL - ${file}: ${(e as Error).message}`);
  }
}
console.log(failed ? `\n${failed} stylesheet(s) do not parse` : '\nboth stylesheets parse');
process.exit(failed ? 1 : 0);
