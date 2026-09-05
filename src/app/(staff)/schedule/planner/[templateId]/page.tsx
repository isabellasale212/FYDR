import { notFound } from 'next/navigation';
import { WeekTemplateBuilder } from '@/components/WeekTemplateBuilder/WeekTemplateBuilder';
import { fetchTemplate } from '@/lib/queries/weekTemplates';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Week template · Fydr' };

export default async function WeekTemplateBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const { db, orgId, claims } = await requireStaff();

  const template = await fetchTemplate(db, orgId, templateId);
  if (!template) notFound();

  const canWrite = claims.roles.includes('coach') || claims.roles.includes('medic');
  if (!canWrite) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">Week templates</p>
            <h1>{template.name}</h1>
          </div>
        </div>
        <p className="tiny">Read only. Templates are authored by coaching and medical staff.</p>
      </>
    );
  }

  return <WeekTemplateBuilder orgId={orgId} userId={claims.userId} templateId={template.id} name={template.name} structure={template.structure} archived={template.archived} canManage={hasAnyRole(claims.roles, SESSION_EDIT)} />;
}
