'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setCollectsRpe } from '@/lib/queries/orgDetails';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { RPE_SWITCH_OFF, RPE_SWITCH_ON } from '@/lib/rpeSetting';

/* The RPE club setting's one switch (Isabella, 2026-09-13; migration 0118),
 * on Settings › Club, the sport scientist's. Both consequences are said
 * before it is pressed; the switch itself is the write (audited); no
 * confirmation — it is reversible and nothing recorded is lost. The same
 * switch shape as the athlete's Mute everything (C13). */
type Props = { orgId: string; userId: string; initial: boolean };

export function RpeSettingSwitch({ orgId, userId, initial }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await withWriteTimeout(setCollectsRpe(createClient(), orgId, userId, next));
      if (err) {
        setError(err);
        return;
      }
      setOn(next);
      router.refresh();
    } catch (e) {
      setError(toUserMessage(e, 'staff'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rpe-setting">
      <button type="button" role="switch" aria-checked={on} className="mute-switch" onClick={flip} disabled={busy}>
        <span className="mute-switch-text">
          <span className="mute-switch-title">Session RPE</span>
          <span className="mute-switch-sub">{busy ? 'Saving…' : on ? 'On — athletes rate each session on the CR-10 scale.' : 'Off — nobody is asked to rate a session.'}</span>
        </span>
        <span className="mute-switch-track" aria-hidden="true" />
      </button>
      <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
        {RPE_SWITCH_ON}
      </p>
      <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
        {RPE_SWITCH_OFF}
      </p>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
