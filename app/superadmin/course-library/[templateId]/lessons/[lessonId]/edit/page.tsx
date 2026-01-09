'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgLessonEditorScreen } from '@/app/org/courses/[courseId]/lessons/[lessonId]/edit/page';

export default function SuperadminTemplateLessonEditorPage() {
  const params = useParams();
  const templateId = params?.templateId as string;
  const lessonId = params?.lessonId as string;

  if (!templateId || !lessonId) {
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

  return (
    <SuperadminGuard>
      <OrgLessonEditorScreen
        courseId={templateId}
        lessonId={lessonId}
        basePath="/superadmin/course-library"
        detailView="v_superadmin_template_lesson_detail"
        metadataRpc="rpc_update_template_lesson_metadata"
        blockRpcConfig={{
          createBlock: 'rpc_create_template_lesson_block',
          updateBlock: 'rpc_update_template_lesson_block',
          archiveBlock: 'rpc_archive_template_lesson_block',
          reorderBlocks: 'rpc_reorder_template_lesson_blocks',
        }}
      />
    </SuperadminGuard>
  );
}
