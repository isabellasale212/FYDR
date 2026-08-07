import { Sidebar } from '@/components/Sidebar/Sidebar';
import { requireStaff } from '@/lib/session';

/** The staff web shell. Staff only, so there is no /staff prefix on any route:
 *  20-route-map.md §2.1 rule 1. */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { claims, fullName, orgName } = await requireStaff();

  return (
    <div className="app">
      <Sidebar roles={claims.roles} fullName={fullName} orgName={orgName} />
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
