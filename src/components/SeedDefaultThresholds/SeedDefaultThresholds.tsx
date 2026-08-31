'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { seedDefaultThresholds } from '@/lib/queries/thresholds';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string };

/**
 * The coach-facing half of migration 0059: the button that turns "we have no
 * default thresholds" into "start with ours".
 *
 * Why this exists on the empty state specifically
 *   The empty /settings/thresholds screen used to be a dead end that read
 *   "No thresholds set — nothing is being watched yet" and offered exactly one
 *   way out: author five rules by hand from /settings/thresholds/new, with no
 *   indication of what good rules look like. That is also, silently, the state
 *   in which the nightly flag engine (migration 0052) evaluates nothing and
 *   raises nothing, so a brand-new club's Flags screen looks reassuringly calm
 *   because no rule exists to be crossed. A default set that can only be applied
 *   by calling an RPC by hand would not have answered the coach's question, so
 *   the affordance lives where the gap actually shows.
 *
 * Only rendered when the list is genuinely empty. Deliberately NOT offered
 * alongside an existing set: seed_default_thresholds() would refuse anyway
 * (it returns 0 rather than topping up), and a button that usually does nothing
 * is worse than no button.
 *
 * One case this screen cannot distinguish, and says so instead of guessing: a
 * club whose rules were all RETIRED also shows an empty list, and is refused by
 * the function (a soft-deleted rule is a decision, not an absence — 0059
 * correction (c)). That is why the zero-result line below offers "New threshold"
 * rather than claiming the club "already has thresholds", which would be a
 * confusing thing to read on a screen showing none.
 *
 * Same write discipline as ThresholdRow directly next to it — withWriteTimeout
 * so a hung write surfaces rather than spinning forever, toUserMessage for the
 * wording, router.refresh() to re-run the server component that owns the list.
 */
export function SeedDefaultThresholds({ orgId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nothingToDo, setNothingToDo] = useState(false);

  const seed = useMutation({
    mutationFn: () => withWriteTimeout(seedDefaultThresholds(createClient(), orgId)),
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      // 0 is not a failure. It means one of two things, and the copy below has to
      // cover both because this screen cannot tell them apart: another coach got
      // there first, OR this club has had thresholds before and retired them, which
      // makes it permanently ineligible for the starter set (0059 correction (c) —
      // a retired rule is a decision, and re-seeding over it would reinstate rules
      // somebody removed on purpose). Refresh either way so the list catches up
      // instead of the coach clicking a button that appears to do nothing.
      setNothingToDo(result.inserted === 0);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div className="empty">
      <h2>No thresholds set</h2>
      <p>
        Flags are raised when a threshold is crossed. Nothing is being watched yet, so
        no flag can be raised for anyone in this squad.
      </p>
      <p style={{ marginTop: 10 }}>
        Fydr has a starter set of five rules &mdash; readiness against each athlete&rsquo;s own
        norm, a sleep drop, sustained soreness, acute:chronic load, and wellness compliance.
        They are a starting point, not a commitment: edit, deactivate or retire any of them
        afterwards.
      </p>
      {/* Said here rather than left to be discovered on the list, because a rule
          that arrives switched off looks like a mistake until you know why. The
          reason is real and specific: wellness compliance counts submissions, so
          on a squad that has not started logging it reads zero and would flag
          everyone in week one. See migration 0059's correction (a). */}
      <p className="tiny" style={{ marginTop: 8 }}>
        Four of them start watching straight away. Wellness compliance arrives switched
        off &mdash; it counts submissions, so it cannot tell a squad that has stopped
        logging from one that has not started. Turn it on once the squad has a couple of
        weeks of entries behind it.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      {nothingToDo ? (
        <p className="tiny" style={{ marginTop: 10 }}>
          Nothing was added. Either someone else has just set thresholds up, or this club
          has had rules before and retired them &mdash; retired rules are never brought
          back automatically. Add one with &ldquo;New threshold&rdquo;.
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
        >
          {seed.isPending ? 'Setting up…' : 'Start with the default set'}
        </button>
      </div>
    </div>
  );
}
