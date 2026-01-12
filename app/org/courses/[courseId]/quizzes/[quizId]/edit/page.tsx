'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  buildBulkImportErrorReport,
  parseOnboQuizBulk,
  type ParsedBulkQuestion,
} from '@/lib/quiz/bulkImport';

type QuizChoice = {
  choice_id: string;
  text: string;
  position: number;
  is_correct: boolean;
};

type QuizQuestion = {
  question_id: string;
  prompt: string;
  position: number;
  choices: QuizChoice[];
};

type DraftQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number | null;
  errors: string[];
};

type QuizDetailRow = {
  org_id: string;
  course_id: string;
  unit_id: string | null;
  quiz_id: string;
  quiz_type: 'unit' | 'final';
  title: string;
  description: string | null;
  pass_score_pct: number;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  num_questions?: number | null;
  questions: QuizQuestion[];
  updated_at: string;
};

function quizTypeLabel(type: QuizDetailRow['quiz_type']) {
  return type === 'final' ? 'Final' : 'Unidad';
}

export default function OrgQuizEditorPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const quizId = params?.quizId as string;

  if (!courseId || !quizId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Quiz no encontrado.
          </div>
        </div>
      </div>
    );
  }

  return (
    <OrgQuizEditorScreen
      courseId={courseId}
      quizId={quizId}
      basePath="/org/courses"
    />
  );
}

type QuizEditorScreenProps = {
  courseId: string;
  quizId: string;
  basePath: string;
  detailView?: string;
  rpcConfig?: QuizRpcConfig;
};

type QuizRpcConfig = {
  updateMetadata: string;
  createQuestion: string;
  createQuestionFull: string;
  updateQuestion: string;
  reorderQuestions: string;
  archiveQuestion: string;
  createChoice: string;
  updateChoice: string;
  reorderChoices: string;
  setCorrectChoice: string;
  bulkImport: string;
};

const DEFAULT_QUIZ_RPC: QuizRpcConfig = {
  updateMetadata: 'rpc_update_quiz_metadata',
  createQuestion: 'rpc_create_quiz_question',
  createQuestionFull: 'rpc_create_quiz_question_full',
  updateQuestion: 'rpc_update_quiz_question',
  reorderQuestions: 'rpc_reorder_quiz_questions',
  archiveQuestion: 'rpc_archive_quiz_question',
  createChoice: 'rpc_create_quiz_choice',
  updateChoice: 'rpc_update_quiz_choice',
  reorderChoices: 'rpc_reorder_quiz_choices',
  setCorrectChoice: 'rpc_set_quiz_correct_choice',
  bulkImport: 'rpc_bulk_import_quiz_questions',
};

export function OrgQuizEditorScreen({
  courseId,
  quizId,
  basePath,
  detailView,
  rpcConfig,
}: QuizEditorScreenProps) {
  const router = useRouter();
  const viewName = detailView ?? 'v_org_quiz_detail';
  const rpcNames = rpcConfig ?? DEFAULT_QUIZ_RPC;
  const isTemplate = basePath.startsWith('/superadmin/course-library');
  const backLabel = isTemplate ? 'Templates' : 'Cursos';
  const outlineLabel = isTemplate ? 'Template' : 'Outline';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<QuizDetailRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passScorePct, setPassScorePct] = useState('80');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [numQuestions, setNumQuestions] = useState('');
  const [questionPrompts, setQuestionPrompts] = useState<
    Record<string, string>
  >({});
  const [choiceTexts, setChoiceTexts] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ParsedBulkQuestion[]>([]);
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [importErrorDetails, setImportErrorDetails] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState<DraftQuestion | null>(
    null,
  );
  const [draftNotice, setDraftNotice] = useState('');
  const [draftError, setDraftError] = useState('');
  const draftRef = useRef<HTMLDivElement | null>(null);

  const applyQuizToForm = (data: QuizDetailRow) => {
    setTitle(data.title ?? '');
    setDescription(data.description ?? '');
    setPassScorePct(
      data.pass_score_pct != null ? String(data.pass_score_pct) : '80',
    );
    setShuffleQuestions(Boolean(data.shuffle_questions));
    setShowCorrectAnswers(Boolean(data.show_correct_answers));
    setNumQuestions(
      data.num_questions != null ? String(data.num_questions) : '',
    );

    const nextPrompts: Record<string, string> = {};
    const nextChoices: Record<string, string> = {};
    for (const question of data.questions ?? []) {
      nextPrompts[question.question_id] = question.prompt ?? '';
      for (const choice of question.choices ?? []) {
        nextChoices[choice.choice_id] = choice.text ?? '';
      }
    }
    setQuestionPrompts(nextPrompts);
    setChoiceTexts(nextChoices);
    setActionError('');
    setActionSuccess('');
  };

  const refetchQuiz = async () => {
    if (!quizId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from(viewName)
      .select('*')
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    const nextRow = (data as QuizDetailRow) ?? null;
    setRow(nextRow);
    if (nextRow) {
      applyQuizToForm(nextRow);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!quizId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from(viewName)
        .select('*')
        .eq('quiz_id', quizId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      const nextRow = (data as QuizDetailRow) ?? null;
      setRow(nextRow);
      if (nextRow) {
        applyQuizToForm(nextRow);
      }
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [quizId, viewName]);

  const questions = useMemo(() => {
    const list = row?.questions ?? [];
    return [...list].sort((a, b) =>
      a.position === b.position
        ? a.question_id.localeCompare(b.question_id)
        : a.position - b.position,
    );
  }, [row]);

  useEffect(() => {
    if (!draftQuestion || !draftRef.current) return;
    draftRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const input = draftRef.current.querySelector('textarea');
    if (input instanceof HTMLTextAreaElement) {
      input.focus();
    }
  }, [draftQuestion]);

  const questionWarnings = useMemo(() => {
    return questions.map((question) => {
      const issues: string[] = [];
      const choices = question.choices ?? [];
      if (choices.length < 2) {
        issues.push('Menos de 2 opciones');
      }
      if (!choices.some((choice) => choice.is_correct)) {
        issues.push('Sin respuesta correcta');
      }
      return { questionId: question.question_id, issues };
    });
  }, [questions]);

  const totalWarningCount = useMemo(
    () => questionWarnings.reduce((acc, item) => acc + item.issues.length, 0),
    [questionWarnings],
  );

  const canSave = !!row && !loading && !isSaving;
  const bankSize = row?.questions?.length ?? 0;
  const parsedNumQuestions = numQuestions.trim() ? Number(numQuestions) : null;
  const numQuestionsWarning =
    parsedNumQuestions != null &&
    Number.isFinite(parsedNumQuestions) &&
    bankSize > 0 &&
    parsedNumQuestions > bankSize
      ? `Se solicitaron ${parsedNumQuestions} preguntas, pero el banco tiene ${bankSize}.`
      : '';

  const importSummary = useMemo(() => {
    const total = importPreview.length;
    const valid = importPreview.filter(
      (item) => item.errors.length === 0,
    ).length;
    return {
      total,
      valid,
      invalid: total - valid,
    };
  }, [importPreview]);

  const handleSaveMetadata = async () => {
    if (!row || !quizId) return;
    setActionError('');
    setActionSuccess('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setActionError('El titulo es obligatorio.');
      return;
    }

    const parsedPass = passScorePct.trim()
      ? Number(passScorePct)
      : row.pass_score_pct;
    if (Number.isNaN(parsedPass)) {
      setActionError('El porcentaje debe ser un numero.');
      return;
    }
    if (parsedPass < 0 || parsedPass > 100) {
      setActionError('El porcentaje debe estar entre 0 y 100.');
      return;
    }

    let parsedNumQuestionsValue: number | null = null;
    if (numQuestions.trim()) {
      parsedNumQuestionsValue = Number(numQuestions);
      if (Number.isNaN(parsedNumQuestionsValue)) {
        setActionError('La cantidad de preguntas debe ser un numero.');
        return;
      }
      if (parsedNumQuestionsValue < 1) {
        setActionError('La cantidad de preguntas debe ser al menos 1.');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      p_quiz_id: quizId,
      p_title: trimmedTitle,
      p_description: description.trim() || null,
      p_pass_score_pct: parsedPass,
      p_shuffle_questions: shuffleQuestions,
      p_show_correct_answers: showCorrectAnswers,
    };

    if (!isTemplate) {
      payload.p_num_questions = parsedNumQuestionsValue;
    }

    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc(
      rpcNames.updateMetadata,
      payload,
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
    setActionSuccess('Configuracion guardada.');
  };

  const handleImportPreview = () => {
    const parsed = parseOnboQuizBulk(importText);
    setImportPreview(parsed);
    setImportError('');
    setImportNotice('');
    setImportErrorDetails([]);
  };

  const handleCopyImportErrors = async () => {
    const report = buildBulkImportErrorReport(importPreview);
    if (!report) {
      setImportNotice('No hay errores para copiar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(report);
      setImportNotice('Reporte copiado.');
    } catch {
      setImportNotice('No se pudo copiar el reporte.');
    }
  };

  const handleImportQuestions = async () => {
    if (!quizId) return;
    const parsed = importPreview.length
      ? importPreview
      : parseOnboQuizBulk(importText);
    setImportPreview(parsed);
    setImportError('');
    setImportNotice('');
    setImportErrorDetails([]);

    const validItems = parsed.filter((item) => item.errors.length === 0);
    if (validItems.length === 0) {
      setImportError('No hay preguntas validas para importar.');
      return;
    }

    if (validItems.length > 20) {
      const confirmed = window.confirm(
        `Vas a importar ${validItems.length} preguntas. ¿Confirmar?`,
      );
      if (!confirmed) return;
    }

    setImporting(true);
    const { data, error: rpcError } = await supabase.rpc(rpcNames.bulkImport, {
      p_quiz_id: quizId,
      p_items: validItems.map((item) => ({
        prompt: item.prompt,
        choices: item.choices,
        correct_index: item.correctIndex,
        explain: item.explain ?? null,
      })),
    });
    setImporting(false);

    if (rpcError) {
      setImportError(rpcError.message);
      return;
    }

    const insertedCount = Number(
      (data as { inserted_count?: number } | null)?.inserted_count ?? 0,
    );
    const errors =
      (data as { errors?: { index?: number; message?: string }[] } | null)
        ?.errors ?? [];

    if (errors.length > 0) {
      setImportNotice(
        `Importadas ${insertedCount} preguntas. ${errors.length} fallaron.`,
      );
      setImportErrorDetails(
        errors.map(
          (err) =>
            `Bloque ${err.index ?? '?'}: ${err.message ?? 'Error desconocido'}`,
        ),
      );
    } else {
      setImportNotice(`Importadas ${insertedCount} preguntas.`);
    }

    await refetchQuiz();
    if (errors.length === 0) {
      setImportOpen(false);
      setImportText('');
      setImportPreview([]);
    }
  };

  const handleCreateDraft = () => {
    if (!canSave) return;
    setDraftNotice('');
    setDraftError('');
    setDraftQuestion({
      id: `draft-${Date.now()}`,
      prompt: '',
      choices: ['', '', '', ''],
      correctIndex: null,
      errors: [],
    });
  };

  const validateDraft = (draft: DraftQuestion): DraftQuestion => {
    const errors: string[] = [];
    if (!draft.prompt.trim()) {
      errors.push('El enunciado es obligatorio.');
    }
    const filledChoices = draft.choices.map((choice) => choice.trim());
    const nonEmptyChoices = filledChoices.filter(Boolean);
    if (nonEmptyChoices.length < 2) {
      errors.push('Ingresá al menos 2 opciones.');
    }
    if (draft.correctIndex == null) {
      errors.push('Seleccioná una respuesta correcta.');
    } else if (!filledChoices[draft.correctIndex]) {
      errors.push('La opción correcta no puede estar vacía.');
    }
    return { ...draft, errors };
  };

  const handleSaveDraft = async () => {
    if (!draftQuestion || !quizId) return;
    setDraftNotice('');
    setDraftError('');

    const validated = validateDraft(draftQuestion);
    setDraftQuestion(validated);
    if (validated.errors.length > 0) {
      setDraftError('Hay errores en el borrador.');
      return;
    }

    const trimmedChoices = validated.choices.map((choice) => choice.trim());
    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc(
      rpcNames.createQuestionFull,
      {
        p_quiz_id: quizId,
        p_prompt: validated.prompt.trim(),
        p_choices: trimmedChoices,
        p_correct_index: validated.correctIndex,
      },
    );
    setIsSaving(false);

    if (rpcError) {
      setDraftError(rpcError.message);
      return;
    }

    setDraftQuestion(null);
    setDraftNotice('Pregunta creada.');
    await refetchQuiz();
  };

  const handleUpdateQuestion = async (questionId: string) => {
    const prompt = (questionPrompts[questionId] ?? '').trim();
    if (!prompt) {
      setActionError('El enunciado es obligatorio.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.updateQuestion, {
      p_question_id: questionId,
      p_prompt: prompt,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleArchiveQuestion = async (questionId: string) => {
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.archiveQuestion, {
      p_question_id: questionId,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleReorderQuestions = async (newOrder: string[]) => {
    if (!quizId) return;
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.reorderQuestions, {
      p_quiz_id: quizId,
      p_question_ids: newOrder,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const draftCountLabel = draftQuestion ? ' (borrador)' : '';

  const handleCreateChoice = async (questionId: string) => {
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.createChoice, {
      p_question_id: questionId,
      p_text: 'Nueva opción',
      p_is_correct: false,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleUpdateChoice = async (choiceId: string) => {
    const text = (choiceTexts[choiceId] ?? '').trim();
    if (!text) {
      setActionError('El texto de la opcion es obligatorio.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.updateChoice, {
      p_choice_id: choiceId,
      p_text: text,
      p_is_correct: null,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleSetCorrect = async (questionId: string, choiceId: string) => {
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.setCorrectChoice, {
      p_question_id: questionId,
      p_choice_id: choiceId,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleReorderChoices = async (
    questionId: string,
    newOrder: string[],
  ) => {
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcNames.reorderChoices, {
      p_question_id: questionId,
      p_choice_ids: newOrder,
    });

    if (error) {
      setActionError(error.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
  };

  const handleBack = () => {
    if (courseId) {
      router.push(`${basePath}/${courseId}/outline`);
      return;
    }
    router.back();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <nav className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href={basePath} className="font-semibold text-zinc-700">
              {backLabel}
            </Link>
            <span>/</span>
            {courseId ? (
              <Link
                href={`${basePath}/${courseId}/outline`}
                className="font-semibold text-zinc-700"
              >
                {outlineLabel}
              </Link>
            ) : (
              <span>{outlineLabel}</span>
            )}
            <span>/</span>
            <span>Quiz</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Quiz editor
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                {row?.title ?? 'Editar quiz'}
              </h1>
              {isTemplate ? (
                <span className="mt-2 inline-flex rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                  TEMPLATE GLOBAL
                </span>
              ) : null}
              {row && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-200 px-3 py-1 font-semibold text-zinc-700">
                    {quizTypeLabel(row.quiz_type)}
                  </span>
                  <span>
                    Actualizado {new Date(row.updated_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                type="button"
                onClick={handleBack}
              >
                Volver al outline
              </button>
              <button
                className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                type="button"
                disabled={!canSave}
                onClick={handleSaveMetadata}
              >
                Guardar configuración
              </button>
            </div>
          </div>
        </header>

        {loading && (
          <div className="space-y-4">
            <div className="h-12 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              type="button"
              onClick={handleBack}
            >
              Volver
            </button>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            No encontrado o sin acceso.
          </div>
        )}

        {!loading && !error && row && (
          <>
            {(actionError || actionSuccess) && (
              <div
                className={`rounded-2xl p-4 text-sm ${
                  actionError
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {actionError || actionSuccess}
              </div>
            )}
            {totalWarningCount > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Hay {totalWarningCount} advertencia(s) en preguntas. Revisá las
                opciones marcadas antes de publicar.
              </div>
            )}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">
                Configuración
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Título
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Porcentaje aprobación
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    type="number"
                    min="0"
                    max="100"
                    value={passScorePct}
                    onChange={(event) => setPassScorePct(event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Descripción
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                {!isTemplate ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Preguntas por intento
                    </label>
                    <input
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      type="number"
                      min="1"
                      value={numQuestions}
                      onChange={(event) => setNumQuestions(event.target.value)}
                      placeholder={`Banco actual: ${bankSize}`}
                    />
                    {numQuestionsWarning ? (
                      <p className="text-xs text-amber-700">
                        {numQuestionsWarning}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className="flex items-center gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300"
                    checked={shuffleQuestions}
                    onChange={(event) =>
                      setShuffleQuestions(event.target.checked)
                    }
                  />
                  Mezclar preguntas
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300"
                    checked={showCorrectAnswers}
                    onChange={(event) =>
                      setShowCorrectAnswers(event.target.checked)
                    }
                  />
                  Mostrar respuestas correctas
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Preguntas{draftCountLabel}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                    type="button"
                    disabled={!canSave}
                    onClick={() => {
                      setImportOpen(true);
                      setImportError('');
                      setImportNotice('');
                    }}
                  >
                    Importar preguntas
                  </button>
                  <button
                    className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    type="button"
                    disabled={!canSave}
                    onClick={handleCreateDraft}
                  >
                    + Agregar pregunta
                  </button>
                </div>
              </div>

              {draftQuestion ? (
                <div
                  ref={draftRef}
                  className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Borrador
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      Nuevo
                    </span>
                  </div>
                  <textarea
                    className="mt-3 min-h-[90px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    placeholder="Enunciado de la pregunta"
                    value={draftQuestion.prompt}
                    onChange={(event) =>
                      setDraftQuestion((prev) =>
                        prev ? { ...prev, prompt: event.target.value } : prev,
                      )
                    }
                  />

                  <div className="mt-4 space-y-3">
                    {draftQuestion.choices.map((choice, idx) => (
                      <div
                        key={`draft-choice-${idx}`}
                        className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          checked={draftQuestion.correctIndex === idx}
                          onChange={() =>
                            setDraftQuestion((prev) =>
                              prev ? { ...prev, correctIndex: idx } : prev,
                            )
                          }
                        />
                        <input
                          className="flex-1 bg-transparent text-sm text-zinc-800 outline-none"
                          placeholder={`Opción ${idx + 1}`}
                          value={choice}
                          onChange={(event) =>
                            setDraftQuestion((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    choices: prev.choices.map((c, cIdx) =>
                                      cIdx === idx ? event.target.value : c,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        />
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-60"
                          type="button"
                          disabled={draftQuestion.choices.length <= 2}
                          onClick={() =>
                            setDraftQuestion((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    choices: prev.choices.filter(
                                      (_, cIdx) => cIdx !== idx,
                                    ),
                                    correctIndex:
                                      prev.correctIndex === idx
                                        ? null
                                        : prev.correctIndex != null &&
                                            prev.correctIndex > idx
                                          ? prev.correctIndex - 1
                                          : prev.correctIndex,
                                  }
                                : prev,
                            )
                          }
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                      type="button"
                      onClick={() =>
                        setDraftQuestion((prev) =>
                          prev
                            ? { ...prev, choices: [...prev.choices, ''] }
                            : prev,
                        )
                      }
                    >
                      + Opción
                    </button>
                  </div>

                  {draftQuestion.errors.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-xs text-rose-600">
                      {draftQuestion.errors.map((err) => (
                        <li key={err}>• {err}</li>
                      ))}
                    </ul>
                  ) : null}
                  {draftError ? (
                    <div className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                      {draftError}
                    </div>
                  ) : null}
                  {draftNotice ? (
                    <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                      {draftNotice}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      type="button"
                      disabled={!canSave}
                      onClick={handleSaveDraft}
                    >
                      Guardar pregunta
                    </button>
                    <button
                      className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      type="button"
                      onClick={() => setDraftQuestion(null)}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ) : null}

              {questions.length === 0 && !draftQuestion && (
                <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
                  Este quiz todavía no tiene preguntas.
                </div>
              )}

              {questions.map((question, index) => (
                <div
                  key={question.question_id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Pregunta {question.position}
                      </span>
                      {questionWarnings
                        .find(
                          (item) => item.questionId === question.question_id,
                        )
                        ?.issues.map((issue) => (
                          <span
                            key={`${question.question_id}-${issue}`}
                            className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700"
                          >
                            {issue}
                          </span>
                        ))}
                      <textarea
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                        value={questionPrompts[question.question_id] ?? ''}
                        onChange={(event) =>
                          setQuestionPrompts((prev) => ({
                            ...prev,
                            [question.question_id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                        type="button"
                        disabled={!canSave}
                        onClick={() =>
                          handleUpdateQuestion(question.question_id)
                        }
                      >
                        Guardar
                      </button>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                        type="button"
                        disabled={!canSave || index === 0}
                        onClick={() => {
                          const order = questions.map((q) => q.question_id);
                          const next = [...order];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          void handleReorderQuestions(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                        type="button"
                        disabled={!canSave || index === questions.length - 1}
                        onClick={() => {
                          const order = questions.map((q) => q.question_id);
                          const next = [...order];
                          [next[index], next[index + 1]] = [
                            next[index + 1],
                            next[index],
                          ];
                          void handleReorderQuestions(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="rounded-full border border-red-200 px-3 py-1 font-semibold text-red-600 hover:border-red-300 disabled:opacity-60"
                        type="button"
                        disabled={!canSave}
                        onClick={() =>
                          handleArchiveQuestion(question.question_id)
                        }
                      >
                        Archivar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-900">
                        Opciones
                      </h3>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                        type="button"
                        disabled={!canSave}
                        onClick={() => handleCreateChoice(question.question_id)}
                      >
                        + Opción
                      </button>
                    </div>

                    {question.choices.length === 0 && (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                        Sin opciones cargadas.
                      </div>
                    )}

                    {question.choices.map((choice, choiceIndex) => (
                      <div
                        key={choice.choice_id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                      >
                        <label className="flex items-center gap-3 text-sm text-zinc-700">
                          <input
                            type="radio"
                            name={`correct-${question.question_id}`}
                            checked={choice.is_correct}
                            onChange={() =>
                              handleSetCorrect(
                                question.question_id,
                                choice.choice_id,
                              )
                            }
                          />
                          <input
                            className="min-w-[240px] rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                            value={choiceTexts[choice.choice_id] ?? ''}
                            onChange={(event) =>
                              setChoiceTexts((prev) => ({
                                ...prev,
                                [choice.choice_id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                            type="button"
                            disabled={!canSave}
                            onClick={() => handleUpdateChoice(choice.choice_id)}
                          >
                            Guardar
                          </button>
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                            type="button"
                            disabled={!canSave || choiceIndex === 0}
                            onClick={() => {
                              const order = question.choices.map(
                                (item) => item.choice_id,
                              );
                              const next = [...order];
                              [next[choiceIndex - 1], next[choiceIndex]] = [
                                next[choiceIndex],
                                next[choiceIndex - 1],
                              ];
                              void handleReorderChoices(
                                question.question_id,
                                next,
                              );
                            }}
                          >
                            ↑
                          </button>
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                            type="button"
                            disabled={
                              !canSave ||
                              choiceIndex === question.choices.length - 1
                            }
                            onClick={() => {
                              const order = question.choices.map(
                                (item) => item.choice_id,
                              );
                              const next = [...order];
                              [next[choiceIndex], next[choiceIndex + 1]] = [
                                next[choiceIndex + 1],
                                next[choiceIndex],
                              ];
                              void handleReorderChoices(
                                question.question_id,
                                next,
                              );
                            }}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {importOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        Importar preguntas
                      </h2>
                      <p className="text-sm text-zinc-500">
                        Pegá bloques ONBO-QUIZ v1 y previsualizá antes de
                        importar.
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                      type="button"
                      onClick={() => setImportOpen(false)}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Pegar contenido
                      </label>
                      <textarea
                        className="min-h-[260px] w-full rounded-xl border border-zinc-200 px-4 py-3 font-mono text-xs text-zinc-800"
                        placeholder="---\nQ: ¿Cuál es la norma de seguridad?\nA1: Opción A\nA2: Opción B\nA3: Opción C\nA4: Opción D\nCORRECT: 2\nEXPLAIN: Opcional\n---"
                        value={importText}
                        onChange={(event) => setImportText(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                          type="button"
                          onClick={handleImportPreview}
                        >
                          Previsualizar
                        </button>
                        <button
                          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                          type="button"
                          onClick={handleCopyImportErrors}
                        >
                          Copiar reporte de errores
                        </button>
                      </div>
                      {importError ? (
                        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                          {importError}
                        </div>
                      ) : null}
                      {importNotice ? (
                        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {importNotice}
                        </div>
                      ) : null}
                      {importErrorDetails.length > 0 ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                          <p className="font-semibold">
                            Errores de importación
                          </p>
                          <ul className="mt-2 space-y-1">
                            {importErrorDetails.map((detail) => (
                              <li key={detail}>• {detail}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                          Preview
                        </div>
                        <div className="text-xs text-zinc-500">
                          Total: {importSummary.total} · Válidas:{' '}
                          {importSummary.valid} · Con errores:{' '}
                          {importSummary.invalid}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {importPreview.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                            Pegá contenido y previsualizá para ver resultados.
                          </div>
                        ) : (
                          importPreview.map((item) => (
                            <div
                              key={`import-${item.index}`}
                              className="rounded-xl border border-zinc-200 p-4 text-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                                  Bloque {item.index}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                    item.errors.length === 0
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {item.errors.length === 0
                                    ? 'Válido'
                                    : 'Con errores'}
                                </span>
                              </div>
                              <p className="mt-2 font-semibold text-zinc-900">
                                {item.prompt || 'Sin pregunta'}
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                                {item.choices.map((choice, idx) => (
                                  <li
                                    key={`choice-${item.index}-${idx}`}
                                    className={`rounded-lg px-2 py-1 ${
                                      item.correctIndex === idx
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-zinc-50'
                                    }`}
                                  >
                                    {idx + 1}. {choice || '—'}
                                  </li>
                                ))}
                              </ul>
                              {item.errors.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-xs text-rose-600">
                                  {item.errors.map((err) => (
                                    <li
                                      key={`${item.index}-${err}`}
                                      className="leading-snug"
                                    >
                                      • {err}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Importa solo las preguntas válidas.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        type="button"
                        onClick={() => setImportOpen(false)}
                      >
                        Cerrar
                      </button>
                      <button
                        className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        type="button"
                        disabled={importSummary.valid === 0 || importing}
                        onClick={handleImportQuestions}
                      >
                        {importing
                          ? 'Importando…'
                          : `Importar ${importSummary.valid} preguntas`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
