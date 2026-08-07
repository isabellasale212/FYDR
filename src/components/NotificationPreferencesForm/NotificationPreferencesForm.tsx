'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { muteAll, setNotificationChannel, unmuteAll, type PreferenceState } from '@/lib/queries/notificationPreferences';
import type { CatalogueEntry, NotificationChannel } from '@/lib/notifications/catalogue';

type Props = {
  orgId: string;
  userId: string;
  entries: CatalogueEntry[];
  initialPreferences: Record<string, PreferenceState>;
  /** Only athletes get the mute-all control (§5.2) — staff has no such rule
   *  in 08-notifications.md. */
  showMuteAll: boolean;
  /** §5.4: under 18, the three listed rows are floored off and locked. */
  isMinor: boolean;
};

function isOn(entry: CatalogueEntry, channel: NotificationChannel, pref: PreferenceState | undefined): boolean {
  const stored = channel === 'push' ? pref?.push : pref?.email;
  if (stored !== null && stored !== undefined) return stored;
  return entry.defaultOn[channel] ?? false;
}

export function NotificationPreferencesForm({ orgId, userId, entries, initialPreferences, showMuteAll, isMinor }: Props) {
  const [prefs, setPrefs] = useState<Record<string, PreferenceState>>(initialPreferences);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const disableable = entries.filter((e) => e.canDisable);

  async function toggle(entry: CatalogueEntry, channel: NotificationChannel) {
    if (entry.minorFloorOff && isMinor) return; // locked, not just defaulted
    const db = createClient();
    const next = !isOn(entry, channel, prefs[entry.id]);
    setBusyId(`${entry.id}:${channel}`);
    setError(null);
    setPrefs((p) => ({ ...p, [entry.id]: { push: null, email: null, ...p[entry.id], [channel]: next } }));
    const { error: err } = await setNotificationChannel(db, orgId, userId, entry.id, channel, next);
    setBusyId(null);
    if (err) setError(`Couldn't save "${entry.label}" — try again.`);
  }

  async function onMuteAll() {
    const db = createClient();
    const ids = disableable.filter((e) => !(e.minorFloorOff && isMinor)).map((e) => e.id);
    setBusyId('__mute_all__');
    setError(null);
    const { error: err } = await muteAll(db, orgId, userId, ids);
    setBusyId(null);
    if (err) {
      setError("Couldn't mute everything — try again.");
      return;
    }
    setMuted(true);
    setPrefs((p) => {
      const next = { ...p };
      for (const id of ids) next[id] = { push: false, email: false };
      return next;
    });
  }

  async function onUnmuteAll() {
    const db = createClient();
    const ids = disableable.map((e) => e.id);
    setBusyId('__mute_all__');
    setError(null);
    const { error: err } = await unmuteAll(db, orgId, userId, ids);
    setBusyId(null);
    if (err) {
      setError("Couldn't restore notifications — try again.");
      return;
    }
    setMuted(false);
    setPrefs((p) => {
      const next = { ...p };
      for (const id of ids) next[id] = { push: true, email: true };
      return next;
    });
  }

  return (
    <div className="stack">
      {showMuteAll ? (
        <section className="card">
          <h2 className="card-title">Pause everything</h2>
          <p className="import-sub">
            Turns off every notification you&apos;re allowed to mute in one go. Availability changes and privacy notices still
            reach you either way &mdash; those two never turn off.
          </p>
          <button type="button" className="btn-ghost" onClick={muted ? onUnmuteAll : onMuteAll} disabled={busyId === '__mute_all__'}>
            {busyId === '__mute_all__' ? 'Working…' : muted ? 'Turn notifications back on' : 'Mute everything else'}
          </button>
        </section>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card flush">
        {entries.map((entry, index) => {
          const pref = prefs[entry.id];
          const locked = entry.minorFloorOff && isMinor;
          return (
            <div key={entry.id}>
              {index > 0 ? <div className="hair" /> : null}
              <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto', padding: '12px 16px' }}>
                <div>
                  <p className="nm" style={{ marginBottom: 2 }}>
                    {entry.label}
                  </p>
                  <p className="tiny">{entry.trigger}</p>
                  {locked ? <p className="tiny g-warn">Off for under-18 accounts &mdash; the club can&apos;t turn this on for you.</p> : null}
                </div>
                {!entry.canDisable ? (
                  <span className="tiny" style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                    Always on
                  </span>
                ) : entry.channels.length === 0 ? (
                  <span className="tiny" style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                    In-app only
                  </span>
                ) : (
                  <>
                    {entry.channels.includes('push') ? (
                      <button
                        type="button"
                        className="squad-chip"
                        aria-pressed={!locked && isOn(entry, 'push', pref)}
                        disabled={locked || busyId === `${entry.id}:push`}
                        onClick={() => toggle(entry, 'push')}
                      >
                        Push {locked || !isOn(entry, 'push', pref) ? 'off' : 'on'}
                      </button>
                    ) : (
                      <span />
                    )}
                    {entry.channels.includes('email') ? (
                      <button
                        type="button"
                        className="squad-chip"
                        aria-pressed={!locked && isOn(entry, 'email', pref)}
                        disabled={locked || busyId === `${entry.id}:email`}
                        onClick={() => toggle(entry, 'email')}
                      >
                        Email {locked || !isOn(entry, 'email', pref) ? 'off' : 'on'}
                      </button>
                    ) : (
                      <span />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <p className="cap">
        In-app notifications are always on and can&apos;t be turned off here. Saved instantly, per device &mdash; nothing here
        actually sends a push or an email yet in this build; see the club&apos;s own roadmap for when that lands.
      </p>
    </div>
  );
}
