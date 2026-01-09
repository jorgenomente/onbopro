'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgQuizEditorScreen } from '@/app/org/courses/[courseId]/quizzes/[quizId]/edit/page';

export default function SuperadminOrgQuizEditorPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const courseId = params?.courseId as string;
  const quizId = params?.quizId as string;

  if (!orgId || !courseId || !quizId) {
    return (
      <SuperadminGuard>
        <div className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Quiz no encontrado.
          </div>
        </div>
      </SuperadminGuard>
    );
  }

  const basePath = `/superadmin/organizations/${orgId}/courses`;

  return (
    <SuperadminGuard>
      <OrgQuizEditorScreen
        courseId={courseId}
        quizId={quizId}
        basePath={basePath}
      />
    </SuperadminGuard>
  );
}
