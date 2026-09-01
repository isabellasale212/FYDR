import { BackButton } from '@/components/BackButton/BackButton';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

/** The staff web shell. Staff only, so there is no /staff prefix on any route:
 *  20-route-map.md §2.1 rule 1. */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { claims, fullName, orgName, previewingTier, tier } = await requireStaff();

  return (
    <div className="app">
      <Sidebar
        roles={claims.roles}
        fullName={fullName}
        orgName={orgName}
        premium={isPremium(tier)}
        previewingTier={previewingTier}
      />
      <main className="main" id="main">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
