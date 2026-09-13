'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { displayModeFrom, platformFrom } from '@/lib/installState';

/** PATTERN-S9 artboard 6: install teaching. Fydr's own card, marked as
 *  Fydr's three ways at once — the eyebrow "From Fydr, not from iPhone", the
 *  product card treatment, a 44px close plus a worded "Not now" — so it
 *  cannot be mistaken for a system dialog. Three steps naming the exact menu
 *  item, Add to Home Screen then Add, with a schematic Safari bar and the
 *  share control ringed and labelled. What changes once added, and what does
 *  not. On Android the browser can offer the install itself
 *  (beforeinstallprompt), so the card offers a real Install button with the
 *  menu route as the fallback; on a desktop it says to open Fydr on the
 *  phone. Already standalone: the card says so and offers nothing.
 *
 *  Three routes only (the notes): Settings › Reminders › Add to Home Screen
 *  (`canonical`), returned once if a reminder could not be delivered (S11's,
 *  once a sender exists), and reachable by name. Not on every Today open and
 *  not on a timer: Today shows it once, after the first check-in. */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DISMISS_KEY = 'fydr-install-card-not-now';

export function InstallCard({ canonical = false, onDismiss }: { canonical?: boolean; onDismiss?: () => void }) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'other' | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(platformFrom(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    setStandalone(displayModeFrom({ matchesStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false, navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone }) === 'standalone');
    if (!canonical) {
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
      } catch {
        /* ignore */
      }
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [canonical]);

  if (platform === null) return null;
  if (dismissed && !canonical) return null;

  function notNow() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
    onDismiss?.();
  }

  const device = platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android' : 'your phone';

  if (standalone || installed) {
    return (
      <section className="card install-card" aria-labelledby="install-title" data-install="done">
        <p className="eyebrow">From Fydr, not from {device}</p>
        <h2 className="card-title" id="install-title">
          Fydr is on your Home Screen
        </h2>
        <p className="import-sub" style={{ marginBottom: 0 }}>
          Reminders are possible from here. Nothing else changed: your login, your entries and what staff can see are the same.
        </p>
      </section>
    );
  }

  return (
    <section className="card install-card" aria-labelledby="install-title" data-install={platform}>
      {!canonical ? (
        <button type="button" className="install-close" aria-label="Not now" onClick={notNow}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
      <p className="eyebrow">From Fydr, not from {platform === 'desktop' || platform === 'other' ? 'your phone' : device}</p>
      <h2 className="card-title" id="install-title">
        Add Fydr to your Home Screen
      </h2>
      <p className="import-sub">
        {platform === 'ios'
          ? 'Safari cannot send you a reminder. Added to the Home Screen it can — it asks you once, the first time you open it from there.'
          : platform === 'android'
            ? 'A browser tab cannot reliably send you a reminder. Added to the Home Screen it can — it asks you once, the first time you open it from there.'
            : 'On your phone, Fydr added to the Home Screen can send reminders; a browser tab cannot. Open fydr.app on your phone and this card shows the steps for it.'}
      </p>

      {platform === 'ios' ? (
        <>
          <ol className="install-steps">
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">1</span>
              <span>
                Tap <b>Share</b> in Safari’s bar at the bottom of the screen — the square with an arrow coming out of the top. It is circled below.
              </span>
            </li>
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">2</span>
              <span>
                Scroll that list down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
              </span>
            </li>
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">3</span>
              <span>Open Fydr from the Home Screen. It asks about reminders once, and you can say no.</span>
            </li>
          </ol>
          <div className="safari-bar" aria-hidden="true">
            <div className="safari-address">fydr.app</div>
            <div className="safari-controls">
              <span>‹</span>
              <span>›</span>
              <span className="safari-share">⇧</span>
              <span>⧉</span>
              <span>▢</span>
            </div>
            <div className="safari-share-label">Share — step 1</div>
          </div>
        </>
      ) : platform === 'android' ? (
        <>
          {installEvent ? (
            <button
              type="button"
              className="btn-primary btn-commit"
              onClick={async () => {
                await installEvent.prompt();
                const { outcome } = await installEvent.userChoice;
                if (outcome === 'accepted') setInstalled(true);
              }}
            >
              Install Fydr
            </button>
          ) : null}
          <ol className="install-steps">
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">1</span>
              <span>
                {installEvent ? 'Or from the browser menu: ' : 'From the browser menu (the three dots): '}tap <b>Add to Home screen</b> (some browsers say <b>Install app</b>).
              </span>
            </li>
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">2</span>
              <span>
                Tap <b>Add</b> (or <b>Install</b>).
              </span>
            </li>
            <li className="install-step">
              <span className="install-step-n" aria-hidden="true">3</span>
              <span>Open Fydr from the Home Screen. It asks about reminders once, and you can say no.</span>
            </li>
          </ol>
        </>
      ) : null}

      <p className="import-sub" style={{ marginTop: 'var(--sp-12)' }}>
        <b>What changes once it is added.</b> An icon on your Home Screen, no browser bars, and reminders become possible. Your login, your
        entries and what staff can see do not change.
      </p>

      {!canonical ? (
        <>
          <button type="button" className="btn-ghost btn-commit" onClick={notNow}>
            Not now
          </button>
          <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
            This stays in{' '}
            <Link href="/me/reminders/install" className="linklike">
              Settings › Reminders › Add to Home Screen
            </Link>
            , and comes back once if a reminder could not reach you.
          </p>
        </>
      ) : null}
    </section>
  );
}
