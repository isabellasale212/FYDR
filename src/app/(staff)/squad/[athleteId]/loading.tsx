import { SkCard, SkLine, SkPage, SkPageHead } from '@/components/Skeleton/Skeleton';

/* The player profile while it loads — ten sequential rounds after the
 * 16 Sept 2026 fixes (docs/perf-measurements-2026-09-16.md). Shaped like the
 * page: the hero card with the avatar, name and chips, then the two columns
 * of cards. This boundary also covers the profile's domain pages beneath it
 * (wellness, gym, nutrition, availability) until one earns its own. */
export default function PlayerProfileLoading() {
  return (
    <SkPage label="the player profile">
      <SkPageHead title="26%" />
      <SkCard h={160}>
        <div className="sk-row">
          <span className="sk" style={{ width: 56, height: 56, borderRadius: 'var(--r-round)', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <SkLine w="34%" size="h1" />
            <SkLine w="52%" size="label" />
            <SkLine w="40%" size="label" />
          </div>
        </div>
      </SkCard>
      <div className="sk-cols">
        <div className="stack">
          <SkCard h={220} lines={4} />
          <SkCard h={260} lines={5} />
        </div>
        <div className="stack">
          <SkCard h={180} lines={3} />
          <SkCard h={300} lines={6} />
        </div>
      </div>
    </SkPage>
  );
}
