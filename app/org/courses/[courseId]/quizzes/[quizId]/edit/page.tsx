'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

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
};

export function OrgQuizEditorScreen({
  courseId,
  quizId,
  basePath,
}: QuizEditorScreenProps) {
  const router = useRouter();

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
  const [questionPrompts, setQuestionPrompts] = useState<
    Record<string, string>
  >({});
  const [choiceTexts, setChoiceTexts] = useState<Record<string, string>>({});

  const applyQuizToForm = (data: QuizDetailRow) => {
    setTitle(data.title ?? '');
    setDescription(data.description ?? '');
    setPassScorePct(
      data.pass_score_pct != null ? String(data.pass_score_pct) : '80',
    );
    setShuffleQuestions(Boolean(data.shuffle_questions));
    setShowCorrectAnswers(Boolean(data.show_correct_answers));

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
      .from('v_org_quiz_detail')
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
        .from('v_org_quiz_detail')
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
  }, [quizId]);

  const questions = useMemo(() => {
    const list = row?.questions ?? [];
    return [...list].sort((a, b) =>
      a.position === b.position
        ? a.question_id.localeCompare(b.question_id)
        : a.position - b.position,
    );
  }, [row]);

  const canSave = !!row && !loading && !isSaving;

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

    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc('rpc_update_quiz_metadata', {
      p_quiz_id: quizId,
      p_title: trimmedTitle,
      p_description: description.trim() || null,
      p_pass_score_pct: parsedPass,
      p_shuffle_questions: shuffleQuestions,
      p_show_correct_answers: showCorrectAnswers,
    });

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchQuiz();
    setIsSaving(false);
    setActionSuccess('Configuracion guardada.');
  };

  const handleUpdateQuestion = async (questionId: string) => {
    const prompt = (questionPrompts[questionId] ?? '').trim();
    if (!prompt) {
      setActionError('El enunciado es obligatorio.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc('rpc_update_quiz_question', {
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
    const { error } = await supabase.rpc('rpc_archive_quiz_question', {
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

  const handleCreateQuestion = async () => {
    if (!quizId) return;
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc('rpc_create_quiz_question', {
      p_quiz_id: quizId,
      p_prompt: 'Nueva pregunta',
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
    const { error } = await supabase.rpc('rpc_reorder_quiz_questions', {
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

  const handleCreateChoice = async (questionId: string) => {
    setIsSaving(true);
    setActionError('');
    const { error } = await supabase.rpc('rpc_create_quiz_choice', {
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
    const { error } = await supabase.rpc('rpc_update_quiz_choice', {
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
    const { error } = await supabase.rpc('rpc_set_quiz_correct_choice', {
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
    const { error } = await supabase.rpc('rpc_reorder_quiz_choices', {
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
              Cursos
            </Link>
            <span>/</span>
            {courseId ? (
              <Link
                href={`${basePath}/${courseId}/outline`}
                className="font-semibold text-zinc-700"
              >
                Outline
              </Link>
            ) : (
              <span>Outline</span>
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
                  Preguntas
                </h2>
                <button
                  className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={!canSave}
                  onClick={handleCreateQuestion}
                >
                  + Agregar pregunta
                </button>
              </div>

              {questions.length === 0 && (
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
          </>
        )}
      </div>
    </div>
  );
}
