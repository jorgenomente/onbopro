'use client';

import { useParams } from 'next/navigation';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgQuizEditorScreen } from '@/app/org/courses/[courseId]/quizzes/[quizId]/edit/page';

const TEMPLATE_QUIZ_RPC = {
  updateMetadata: 'rpc_update_template_quiz_metadata',
  createQuestion: 'rpc_create_template_quiz_question',
  updateQuestion: 'rpc_update_template_quiz_question',
  reorderQuestions: 'rpc_reorder_template_quiz_questions',
  archiveQuestion: 'rpc_archive_template_quiz_question',
  createChoice: 'rpc_create_template_quiz_choice',
  updateChoice: 'rpc_update_template_quiz_choice',
  reorderChoices: 'rpc_reorder_template_quiz_choices',
  setCorrectChoice: 'rpc_set_template_quiz_correct_choice',
};

export default function SuperadminTemplateQuizEditorPage() {
  const params = useParams();
  const templateId = params?.templateId as string;
  const quizId = params?.quizId as string;

  if (!templateId || !quizId) {
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

  return (
    <SuperadminGuard>
      <OrgQuizEditorScreen
        courseId={templateId}
        quizId={quizId}
        basePath="/superadmin/course-library"
        detailView="v_superadmin_template_quiz_detail"
        rpcConfig={TEMPLATE_QUIZ_RPC}
      />
    </SuperadminGuard>
  );
}
