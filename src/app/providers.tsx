'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /* A dashboard panel that refetches on every window focus is a
               dashboard that flickers all morning. 30 seconds is long enough
               to stop that and short enough that an availability change from
               the physio room lands before the session starts. */
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            /* retry: 0, AND THIS IS THE FIX FOR A BUG THAT SURVIVED THREE
               EARLIER ATTEMPTS. It was `retry: 2`.
             *
             * WHAT WENT WRONG. A failed mutation showed nothing at all: the
             * submit button sat on a disabled "Creating…" indefinitely, no
             * message, nothing written. Read off React Query's own state, the
             * correct error was there the whole time and never surfaced:
             *
             *   300ms   failureCount 1  failureReason "Your session has
             *                           expired, so nothing was saved"
             *   1200ms  isPaused TRUE
             *   6000ms  isPaused TRUE   ... indefinitely
             *
             * THE CAUSE is query-core's retryer.js:
             *
             *   const canContinue = () => focusManager.isFocused()
             *     && (config.networkMode === "always" || onlineManager.isOnline())
             *     && config.canRun();
             *
             * A mutation that fails and wants to RETRY calls that before
             * continuing, and pauses if it is false. focusManager.isFocused()
             * is ANDed in regardless of networkMode — so a failed write pauses
             * whenever the document is not focused, and onError never runs.
             * Setting networkMode: 'always' does not help; that was tried and
             * measured to change nothing, which is what pointed at the focus
             * term.
             *
             * WHO THIS HIT. Anyone who submits and then looks at something else
             * — another tab, another app, their phone. The write fails, the
             * retry waits for focus that never comes, and the form claims to
             * still be working. It also made the bug look like an
             * automated-testing artefact, because a CDP-driven tab is never
             * focused.
             *
             * WHY ZERO IS ALSO SIMPLY CORRECT HERE, independent of the pause:
             * these mutations are CREATES with no idempotency key. Retrying
             * createFixture's POST risks a second fixture, and a duplicate is
             * worse than an error message. A person deciding to press the
             * button again is a better retry than a silent one.
             *
             * networkMode 'always' stays for the separate case it fixes: with
             * the default 'online', a mutation started while the online manager
             * thinks it is offline pauses BEFORE attempting. This app has no
             * offline write queue for it to resume into, so that could only
             * ever hide the failure too. */
            networkMode: 'always',
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
