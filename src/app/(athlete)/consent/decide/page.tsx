import { ConsentBlocks } from '@/components/ConsentBlocks/ConsentBlocks';
import { CONSENT_VERSION } from '@/lib/legalPlaceholders';
import { requireAthlete } from '@/lib/session';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Two kinds of data · Fydr' };

/** PATTERN-S9 artboard 3A: the decision. Two blocks, listed apart because
 *  different people see them and because the athlete may be asked about them
 *  separately; the selection sentence with the caption that makes it honest;
 *  two equal actions, both 56px, both --surf with the accent line, in source
 *  order agree then decline — zero haloed primaries; the version line from
 *  the stored version. The Settings › Your data row (12-me.md) opens the same
 *  two blocks with the opposite pair. docs/athlete/screens/21-consent-first-run.md.
 *
 *  A minor never sees this screen: their guardian answers (4A / 4B). */
export default async function ConsentDecidePage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { consent } = await requireAthlete({ allowUndecided: true });
  if (consent.isMinor) redirect('/consent/guardian');
  const { e } = await searchParams;

  return (
    <ConsentBlocks
      eyebrow="Step 3 of 3 · your choice"
      title="Two kinds of data"
      sub="Listed apart because different people see them, and because you may be asked about them separately."
      error={e === 'failed' ? 'That did not save. Nothing was recorded — try again.' : null}
      action="/consent/decide/record"
      agreeLabel="I agree to both blocks"
      declineLabel="I do not agree"
      foot={
        <>
          You can change this whenever you like, in Settings › Your data. Version <span className="num">{CONSENT_VERSION}</span>,
          recorded with the date and time you choose.
        </>
      }
    />
  );
}
