'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setCoachSeesInjurySite } from '@/lib/queries/orgDetails';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

export const SITE_SWITCH_OFF = 'Off (the default): a coach reads the status word, the restriction line and the expected return — never the body site or the side. Those stay with the medic, the sport scientist and the S&C, and with the athlete.';
export const SITE_SWITCH_ON = 'On: a coach also reads the body site and side of an open injury, on the injuries list, the squad list, the allocation and rehab boards and the injury report. Never the diagnosis, the treatment notes or the protocol stage — those stay clinical whatever this setting says.';

/* PATTERN-S3 C8 (Isabella, 2026-09-13; migration 0122): body site and side
 * are not coach-visible, a club setting defaulting to off — the same switch
 * shape as the RPE setting, on Settings › Club, the sport scientist's. Both
 * consequences are said before it is pressed. The database enforces it
 * (injuries_staff masks the two columns; the table refuses them). */
type Props = { orgId: string; userId: string; initial: boolean };

export function InjurySiteSettingSwitch({ orgId, userId, initial }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await withWriteTimeout(setCoachSeesInjurySite(createClient(), orgId, userId, next));
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
          <span className="mute-switch-title">Coaches see the injury site</span>
          <span className="mute-switch-sub">{busy ? 'Saving…' : on ? 'On — a coach reads the body site and side of an open injury.' : 'Off — a coach reads the status, the restriction line and the expected return only.'}</span>
        </span>
        <span className="mute-switch-track" aria-hidden="true" />
      </button>
      <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
        {SITE_SWITCH_OFF}
      </p>
      <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
        {SITE_SWITCH_ON}
      </p>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
