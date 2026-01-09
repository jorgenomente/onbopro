'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgCourseEditScreen } from '@/app/org/courses/[courseId]/edit/page';

export default function SuperadminTemplateEditPage() {
  const params = useParams();
  const templateId = params?.templateId as string;

  if (!templateId) {
    return (
      <SuperadminGuard>
        <div className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Template no encontrado.
          </div>
        </div>
      </SuperadminGuard>
    );
  }

  return (
    <SuperadminGuard>
      <OrgCourseEditScreen
        courseId={templateId}
        basePath="/superadmin/course-library"
        metadataView="v_superadmin_course_template_metadata"
        updateRpc="rpc_update_template_metadata"
      />
    </SuperadminGuard>
  );
}
