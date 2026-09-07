import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/tokens.css';
import '@/styles/base.css';

/* One family, Roboto, in five faces. 06-design-system.md §2.1 paired Sora with
 * DM Mono for figures; both are gone and Roboto now sets everything.
 *
 * THE TABULAR-FIGURES HAZARD IS GONE, WHICH I HAD WRONG UNTIL I MEASURED IT.
 * DM Mono was monospaced, so its digits were fixed-width whether or not
 * anything asked; Sora's were proportional, which is why every numeric rule in
 * base.css carries `font-variant-numeric: tabular-nums` explicitly. I assumed
 * Roboto was proportional too and wrote that here. It is not. Measured in the
 * browser at 20px, with Georgia as a positive control so a null result could
 * not mean a broken probe:
 *
 *   Roboto  "111" 33.73px   "888" 33.73px   delta 0
 *   Georgia "111" 25.78px   "888" 35.77px   delta 9.99
 *
 * Roboto's figures are tabular by default. THE REQUESTS STAY ANYWAY. They are
 * correct whatever the family is, they cost nothing, and they are the only
 * thing that would stop the next swap silently reintroducing drifting columns
 * — which is precisely the failure this comment used to be warning about.
 *
 * 500 IS REAL NOW. Sora had no 500 and writing font-weight: 500 against it
 * synthesised one; Roboto ships Medium, so those weights stop being faked.
 *
 * The CSS variable is --font-sans, not --font-roboto. Naming a token after the
 * family it currently holds is the same mistake as writing the hex inline: the
 * 52 references in base.css had to be rewritten for this change only because
 * the old name said "sora". */
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fydr',
  description: 'Athlete performance management for sports clubs.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** 06-design-system.md §2.4: dark arrives three ways. #2 (prefers-color-scheme
 *  with no stored choice) and #3 (:root[data-theme] with one) both need to be
 *  in place before first paint or the app flashes light-to-dark on load —
 *  audit S7/finding 40. #2 is pure CSS (tokens.css's own
 *  `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {...} }`)
 *  and needs nothing here: the stylesheet is already blocking-render, so it
 *  applies at first paint with no script involved.
 *
 *  #3 is the part that needs help. It used to be applied by ThemeToggle's own
 *  mount effect, which had two problems: it runs after hydration, well after
 *  first paint (the flash), and it only runs on the handful of pages that
 *  happen to render a <ThemeToggle/> — every other route never applied the
 *  stored choice at all and silently fell back to whatever #2 resolved to.
 *  A synchronous inline script, first thing in <body>, runs before the
 *  browser paints anything below it and runs on every route regardless of
 *  what that route mounts. ThemeToggle still owns writing the choice and
 *  reflecting it live once the user flips it (see that component). */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('fydr-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      className={roboto.variable}
      // The blocking script below sets data-theme on this element before
      // hydration, deliberately outside anything React rendered server-side
      // (the server has no localStorage to read). Without this, React logs a
      // hydration-mismatch warning on every single navigation — real noise,
      // not a real bug: the attribute is exactly what it should be either way.
      suppressHydrationWarning
    >
      <body>
        {/* The no-flash theme script has to be a plain synchronous inline
            script to run before first paint; there is no JSX way to do this. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
