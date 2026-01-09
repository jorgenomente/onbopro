'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgCourseEditScreen } from '@/app/org/courses/[courseId]/edit/page';

export default function SuperadminOrgCourseEditPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const courseId = params?.courseId as string;

  if (!orgId || !courseId) {
    return (
      <SuperadminGuard>
        <div className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Curso no encontrado.
          </div>
        </div>
      </SuperadminGuard>
    );
  }

  const basePath = `/superadmin/organizations/${orgId}/courses`;

  return (
    <SuperadminGuard>
      <OrgCourseEditScreen courseId={courseId} basePath={basePath} />
    </SuperadminGuard>
  );
}
