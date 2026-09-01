import { Sidebar } from '@/components/Sidebar/Sidebar';
import { requireStaff } from '@/lib/session';

/** The staff web shell. Staff only, so there is no /staff prefix on any route:
 *  20-route-map.md §2.1 rule 1. */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { claims, fullName, orgName, previewingTier } = await requireStaff();

  return (
    <div className="app">
      <Sidebar roles={claims.roles} fullName={fullName} orgName={orgName} previewingTier={previewingTier} />
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
