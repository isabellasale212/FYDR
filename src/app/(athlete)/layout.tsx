import { AthleteTabBar } from '@/components/AthleteTabBar/AthleteTabBar';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { requireAthlete } from '@/lib/session';

/** The athlete shell. Phase 1a ships it as responsive mobile web in the same
 *  Next.js application; ADR-002 still has the phone app as Expo, and these
 *  routes are the same paths that app will use. */
export default async function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAthlete();

  return (
    <div className="phone">
      <main className="phone-body" id="main">
        {children}
      </main>
      <AthleteTabBar />
      <footer
        style={{
          padding: '10px 16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <ThemeToggle />
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </footer>
    </div>
  );
}
