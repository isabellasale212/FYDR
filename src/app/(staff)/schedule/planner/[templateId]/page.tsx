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

  /* Was `coach || medic`, the pre-five-role phrase for "any staff who is not an
     admin". Two things were wrong with it and they pointed opposite ways. The
     SPORT SCIENTIST was refused outright, by the rendered branch below, while
     schedule/planner/page.tsx -- this page's own list -- had already been
     corrected to SESSION_EDIT: so that role saw the list with its write
     affordances and hit a refusal on clicking through. And the MEDIC was let in,
     though G-33 took scheduling off that role including week templates, so their
     writes met an RLS policy that refuses them. */
  const canWrite = hasAnyRole(claims.roles, SESSION_EDIT);
  if (!canWrite) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">Week templates</p>
            <h1>{template.name}</h1>
          </div>
        </div>
        <p className="tiny">Read only. Templates are authored by the sport scientist and the coach.</p>
      </>
    );
  }

  return <WeekTemplateBuilder orgId={orgId} userId={claims.userId} templateId={template.id} name={template.name} structure={template.structure} archived={template.archived} canManage={hasAnyRole(claims.roles, SESSION_EDIT)} />;
}
