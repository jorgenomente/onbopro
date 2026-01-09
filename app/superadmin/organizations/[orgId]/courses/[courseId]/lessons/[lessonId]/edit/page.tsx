'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgLessonEditorScreen } from '@/app/org/courses/[courseId]/lessons/[lessonId]/edit/page';

export default function SuperadminOrgLessonEditorPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;

  if (!orgId || !courseId || !lessonId) {
    return (
      <SuperadminGuard>
        <div className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Lección no encontrada.
          </div>
        </div>
      </SuperadminGuard>
    );
  }

  const basePath = `/superadmin/organizations/${orgId}/courses`;

  return (
    <SuperadminGuard>
      <OrgLessonEditorScreen
        courseId={courseId}
        lessonId={lessonId}
        basePath={basePath}
      />
    </SuperadminGuard>
  );
}
