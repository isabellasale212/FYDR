import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';

/** The two blocks, the sentence and its caption, the two equal actions —
 *  shared with the withdrawal screen, which draws the opposite pair. */
export function ConsentBlocks(o: {
  eyebrow: string;
  title: string;
  sub: string;
  error: string | null;
  action: string;
  agreeLabel: string;
  declineLabel: string;
  /** Which of the two is the write this screen offers first. Both are
   *  always drawn; on the withdrawal screen "keep" comes first. */
  foot: React.ReactNode;
}) {
  return (
    <>
      <div className="sheet-head">
        <p className="eyebrow">{o.eyebrow}</p>
        <h1 className="t">{o.title}</h1>
        <p className="s">{o.sub}</p>
      </div>

      {o.error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {o.error}
        </p>
      ) : null}

      <div className="stack">
        <section className="card" aria-labelledby="block-1">
          <p className="eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>Block 1</p>
          <h2 className="card-title" id="block-1">
            Performance data
          </h2>
          <dl className="consent-block-list">
            <dt>What</dt>
            <dd>morning check-ins, session ratings, gym and nutrition logs, test results, GPS if recorded.</dd>
            <dt>Who</dt>
            <dd>the coach, the sport scientist, the physiotherapist, and you.</dd>
            <dt>Why</dt>
            <dd>so training is planned around how you are coping, not around how the week looks on paper.</dd>
          </dl>
          <LegalPlaceholder id="LEGAL-3A" />
        </section>

        <section className="card" aria-labelledby="block-2">
          <p className="eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>Block 2</p>
          <h2 className="card-title" id="block-2">
            Health and injury data
          </h2>
          <dl className="consent-block-list">
            <dt>What</dt>
            <dd>injuries you report, symptoms, diagnosis, treatment, and the dates of each.</dd>
            <dt>Who</dt>
            <dd>the physiotherapist and you. The coach and the sport scientist see whether you are available and one restriction line.</dd>
          </dl>
          <LegalPlaceholder id="LEGAL-3B" />
        </section>
      </div>

      {/* In the flow, not a sticky footer: the sentence, its caption and the
          two choices are the last thing read, after the blocks, and a
          footer holding both placeholders would cover the blocks it is
          about on a phone. */}
      <form method="post" action={o.action} className="card" style={{ marginTop: 'var(--sp-14)' }} data-consent-form>
        <p className="import-sub" style={{ marginBottom: 'var(--sp-2)' }}>
          <b>Saying no does not affect selection.</b>
        </p>
        <p className="tiny" style={{ marginBottom: 'var(--sp-12)' }}>
          Your club states this. Fydr records your choice and cannot enforce what a coach does with it.
        </p>
        <LegalPlaceholder id="LEGAL-3C" />
        <div className="consent-choices" style={{ marginTop: 'var(--sp-12)' }}>
          <button type="submit" name="decision" value="agree" className="consent-choice">
            {o.agreeLabel}
          </button>
          <button type="submit" name="decision" value="decline" className="consent-choice">
            {o.declineLabel}
          </button>
        </div>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-10)' }}>{o.foot}</p>
        <LegalPlaceholder id="LEGAL-3D" />
      </form>
    </>
  );
}
