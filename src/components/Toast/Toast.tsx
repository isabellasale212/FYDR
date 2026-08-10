'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  message: string;
  /** Strips the query param(s) that triggered this toast from the URL on
   *  dismiss/timeout, so a refresh or a back-nav doesn't reopen it. */
  clearHref: string;
};

const AUTO_DISMISS_MS = 5000;

/** ATHLETE-APP-SPEC.md §13. A floating confirmation over the tab bar, not
 *  the inline "banner" pattern this screen used before — every submit flow
 *  (Wellness, RPE, Nutrition, Gym) redirects to its tab with a `?submitted=`
 *  param; the page that reads it renders this and the param is what
 *  `clearHref` removes. Auto-dismisses so an athlete who does nothing still
 *  gets the tab bar back. */
export function Toast({ message, clearHref }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setVisible(false);
    router.replace(clearHref);
  }

  if (!visible) return null;

  return (
    <div className="toast" role="status">
      <span className="msg">{message}</span>
      <button type="button" className="dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
