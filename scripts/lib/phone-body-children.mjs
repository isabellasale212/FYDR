/* WHICH ELEMENTS BECOME DIRECT CHILDREN OF .phone-body.
 *
 * Only those matter for vertical rhythm: `.phone-body` is a flex column with
 * `gap: var(--gap-stack)`, flex children do not collapse margins, so a child
 * that also sets margin-top ADDS to the gap. A margin deeper inside a card is
 * fine and must not be flagged -- the athlete surface has 105 vertical margins
 * and only 25 of them are on a phone-body child.
 *
 * VALIDATED AGAINST THE LIVE DOM, not trusted. The measured children on
 * production were Me: [hd.me-hd, card +14, me-stats, stack +14] and My data:
 * [hd, md-seg-track +4, div +12, stack +14, card.flush +14], and this module
 * reproduces both exactly. Two bugs were found by that comparison and are
 * fixed below: taking the file's FIRST `return (` rather than the default
 * export's, and treating a locally-defined component as the child rather than
 * resolving it to its own root element.
 */
/* Extract the DEPTH-1 JSX elements of each athlete page's return — the ones
   that become direct children of .phone-body. Validated below against the DOM
   measurements taken from the live app. */

export function topLevelChildren(src) {
  const strip = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  /* The DEFAULT EXPORT's return, not the file's first one. Validated the hard
     way: my-data/page.tsx defines ListCapNote, SeeAllLink and WindowLine above
     MyDataPage, so "the first return" reported a single <p className="cap"> as
     the whole screen. */
  const exp = strip.search(/export default (?:async )?function/);
  const from = exp < 0 ? 0 : exp;
  const i = strip.slice(from).search(/\n\s*return \(/);
  if (i < 0) return [];
  let j = strip.indexOf('(', from + i), depth = 0, end = -1;
  for (let k = j; k < strip.length; k++) {
    if (strip[k] === '(') depth++;
    else if (strip[k] === ')') { depth--; if (!depth) { end = k; break; } }
  }
  let body = strip.slice(j + 1, end).trim();
  // unwrap an outer fragment so its children are the phone-body children
  const frag = body.match(/^<>\s*([\s\S]*?)\s*<\/>$/);
  if (frag) body = frag[1];
  else return [firstTag(body)].filter(Boolean);           // single root element

  const out = [];
  let tagDepth = 0;
  const re = /<(\/?)([A-Za-z][\w.]*)((?:[^<>"']|"[^"]*"|'[^']*'|\{[^{}]*\})*?)(\/?)>/g;
  let m;
  while ((m = re.exec(body))) {
    const [, closing, tag, attrs, selfClose] = m;
    if (closing) { if (!/^[A-Z]/.test(tag)) tagDepth--; continue; }
    if (tagDepth === 0) {
      /* A CAPITALISED TAG DEFINED IN THIS FILE is not itself the phone-body
         child — its own root element is. My data renders <WellnessTab/> at
         depth 1, and the thing that carries margin-top:14 is the
         <div className="stack"> that tab returns. Without this the guard
         cannot see four of the violations it exists to find. */
      const local = /^[A-Z]/.test(tag)
        && new RegExp(`(?:async )?function ${tag}\\(`).test(strip);
      if (local) {
        const k = strip.search(new RegExp(`(?:async )?function ${tag}\\(`));
        const sub = strip.slice(k);
        const r = sub.search(/\n\s*return \(/);
        if (r >= 0) {
          const root = firstTag(sub.slice(r));
          if (root) { out.push({ ...root, via: tag }); continue; }
        }
      }
      out.push({ tag, attrs });
    }
    /* A CAPITALISED WRAPPER IS TRANSPARENT. Components that render {children}
       pass them straight through, so those children become phone-body children
       at runtime even though they are nested in the source. boards/page.tsx
       wraps its whole body in <LeaderboardVisibilityGate>, and the
       <div className="stack" style={{ marginTop: 14 }}> inside it rendered an
       18px/28px gap while this parser reported the screen clean.
       
       This OVER-approximates: a component that wraps its children in its own
       card would have them flagged wrongly. That is the safer direction for a
       guard and the same trade check-control-radius makes with INTERACTIVE --
       a false positive costs one baseline line, a false negative costs the
       rule. */
    if (!selfClose && !/^[A-Z]/.test(tag)) tagDepth++;
  }
  return out;
}
function firstTag(body) {
  const m = body.match(/<([A-Za-z][\w.]*)((?:[^<>"']|"[^"]*"|'[^']*'|\{[^{}]*\})*?)\/?>/);
  return m ? { tag: m[1], attrs: m[2] } : null;
}
export const cls = (a) => (a.match(/className="([^"]*)"/) || a.match(/className=\{`([^`]*)`\}/) || [,''])[1];
export const inlineMargin = (a) => {
  const m = a.match(/style=\{\{([^}]*)\}\}/);
  if (!m) return null;
  const body = m[1];
  const v = body.match(/(marginTop|marginBottom)\s*:\s*([\d.]+|'[^']*')/);
  if (v) return `${v[1]}: ${v[2]}`;
  /* THE SHORTHAND COUNTS TOO, and missing it cost a real finding:
     me/notifications has <p className="tiny" style={{ margin: '4px 0 14px' }}>
     as a phone-body child, which rendered 18px and 28px gaps while this guard
     reported the screen clean. A shorthand with a non-zero first or third value
     sets a vertical margin exactly as the longhand does. */
  const sh = body.match(/(?:^|,)\s*margin\s*:\s*('[^']*'|"[^"]*"|[\d.]+)/);
  if (!sh) return null;
  const raw = sh[1].replace(/['"]/g, '').trim();
  const parts = raw.split(/\s+/);
  const top = parts[0] ?? '0';
  const bottom = parts.length >= 3 ? parts[2] : top;
  const nz = (x) => x && !/^0(px|rem|em|%)?$/.test(x);
  return (nz(top) || nz(bottom)) ? `margin: ${raw}` : null;
};
