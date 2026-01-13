'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  buildBulkImportErrorReport,
  parseOnboQuizBulk,
  type ParsedBulkQuestion,
} from '@/lib/quiz/bulkImport';
import { ONBO_QUIZ_V1_PROMPT } from '@/lib/quiz/onboQuizPrompt';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type QuizChoice = {
  choice_id: string;
  text: string;
  position: number;
  is_correct: boolean;
};

type QuizQuestion = {
  question_id: string;
  prompt: string;
  explanation?: string | null;
  position: number;
  choices: QuizChoice[];
};

type ArchivedQuestion = {
  org_id: string;
  course_id: string;
  quiz_id: string;
  question_id: string;
  prompt: string;
  archived_at: string;
  position: number | null;
  options_count?: number | null;
};

type DraftQuestion = {
  id: string;
  prompt: string;
  explanation?: string | null;
  choices: { id: string; text: string }[];
  correctIndex: number | null;
  errors: string[];
};

type EditChoice = {
  id: string;
  text: string;
  isNew?: boolean;
};

type EditQuestionDraft = {
  questionId: string;
  prompt: string;
  explanation?: string | null;
  choices: EditChoice[];
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
  quiz_prompt?: string | null;
  questions: QuizQuestion[];
  updated_at: string;
};

function quizTypeLabel(type: QuizDetailRow['quiz_type']) {
  return type === 'final' ? 'Final' : 'Unidad';
}

function makeChoiceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `choice-${crypto.randomUUID()}`;
  }
  return `choice-${Math.random().toString(36).slice(2, 10)}`;
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
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState<EditQuestionDraft | null>(null);
  const [editNotice, setEditNotice] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState(ONBO_QUIZ_V1_PROMPT);
  const [promptError, setPromptError] = useState('');
  const [promptNotice, setPromptNotice] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptCopyFeedback, setPromptCopyFeedback] = useState<
    'idle' | 'copied' | 'error'
  >('idle');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState('');
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [archivedQuestions, setArchivedQuestions] = useState<
    ArchivedQuestion[]
  >([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingFocusQuestionId, setPendingFocusQuestionId] = useState<
    string | null
  >(null);
  const draftRef = useRef<HTMLDivElement | null>(null);
  const didDraftFocusRef = useRef(false);

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

    setActionError('');
    setActionSuccess('');
  };

  const fetchArchivedCount = useCallback(async () => {
    if (!quizId || isTemplate) return;
    const { count, error: countError } = await supabase
      .from('v_org_quiz_archived_questions')
      .select('question_id', { count: 'exact', head: true })
      .eq('quiz_id', quizId);

    if (countError) {
      return;
    }

    setArchivedCount(count ?? 0);
  }, [isTemplate, quizId]);

  const fetchArchivedQuestions = useCallback(async () => {
    if (!quizId || isTemplate) return;
    setArchivedLoading(true);
    setArchivedError('');
    const { data, error: fetchError } = await supabase
      .from('v_org_quiz_archived_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('archived_at', { ascending: false });

    if (fetchError) {
      setArchivedError(fetchError.message);
      setArchivedQuestions([]);
      setArchivedLoading(false);
      return;
    }

    setArchivedQuestions((data as ArchivedQuestion[]) ?? []);
    setArchivedLoading(false);
  }, [isTemplate, quizId]);

  const refetchQuiz = useCallback(async () => {
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

    if (!isTemplate) {
      void fetchArchivedCount();
    }
  }, [fetchArchivedCount, isTemplate, quizId, viewName]);

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

      if (!isTemplate) {
        void fetchArchivedCount();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetchArchivedCount, isTemplate, quizId, viewName]);

  const questions = useMemo(() => {
    const list = row?.questions ?? [];
    return [...list].sort((a, b) =>
      a.position === b.position
        ? a.question_id.localeCompare(b.question_id)
        : a.position - b.position,
    );
  }, [row]);

  const draftId = draftQuestion?.id;

  useEffect(() => {
    if (!draftId || !draftRef.current) return;
    if (didDraftFocusRef.current) return;
    didDraftFocusRef.current = true;
    draftRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const input = draftRef.current.querySelector('textarea');
    if (input instanceof HTMLTextAreaElement) {
      input.focus({ preventScroll: true });
    }
  }, [draftId]);

  useEffect(() => {
    if (!pendingFocusQuestionId) return;
    const id = pendingFocusQuestionId;
    requestAnimationFrame(() => {
      const selector = `[data-question-id="${id}"]`;
      const target = document.querySelector(selector);
      if (!target) return;
      target.scrollIntoView({ block: 'center' });
      const textarea = target.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus({ preventScroll: true });
      }
      setPendingFocusQuestionId(null);
    });
  }, [pendingFocusQuestionId, questions.length]);

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
  const canManagePrompt = !isTemplate && !!row?.org_id;
  const effectivePrompt = row?.quiz_prompt ?? ONBO_QUIZ_V1_PROMPT;
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

  const handlePromptCopy = async () => {
    const success = await copyToClipboard(promptValue);
    setPromptCopyFeedback(success ? 'copied' : 'error');
    window.setTimeout(() => {
      setPromptCopyFeedback('idle');
    }, 1500);
  };

  const handlePromptSave = async (nextValue?: string) => {
    if (!row?.org_id || !canManagePrompt) {
      setPromptError('El prompt solo se puede editar a nivel organización.');
      return;
    }

    const trimmed = (nextValue ?? promptValue).trim();
    if (!trimmed) {
      setPromptError('El prompt es obligatorio.');
      return;
    }
    if (trimmed.length < 50) {
      setPromptError('El prompt debe tener al menos 50 caracteres.');
      return;
    }

    setPromptSaving(true);
    setPromptError('');
    setPromptNotice('');
    const { error: rpcError } = await supabase.rpc(
      'rpc_update_org_quiz_prompt',
      {
        p_org_id: row.org_id,
        p_quiz_prompt: trimmed,
      },
    );
    setPromptSaving(false);

    if (rpcError) {
      setPromptError(rpcError.message);
      return;
    }

    setPromptNotice('Guardado.');
    setPromptValue(trimmed);
    await refetchQuiz();
  };

  const handlePromptReset = async () => {
    const defaultPrompt = ONBO_QUIZ_V1_PROMPT.trim();
    setPromptValue(defaultPrompt);
    await handlePromptSave(defaultPrompt);
  };

  const handleRestoreArchived = async (
    questionId: string,
    options: { edit?: boolean } = {},
  ) => {
    setRestoringId(questionId);
    setArchivedError('');
    const { error: rpcError } = await supabase.rpc(
      'rpc_unarchive_quiz_question',
      {
        p_question_id: questionId,
      },
    );
    setRestoringId(null);

    if (rpcError) {
      setArchivedError(rpcError.message);
      return;
    }

    await refetchQuiz();
    await fetchArchivedQuestions();

    if (options.edit) {
      setArchivedOpen(false);
      setPendingFocusQuestionId(questionId);
    }
  };

  const handleCreateDraft = () => {
    if (!canSave) return;
    if (editingQuestionId) {
      setActionError('Finalizá la edición actual antes de crear un borrador.');
      return;
    }
    setDraftNotice('');
    setDraftError('');
    didDraftFocusRef.current = false;
    setDraftQuestion({
      id: `draft-${Date.now()}`,
      prompt: '',
      explanation: '',
      choices: [
        { id: makeChoiceId(), text: '' },
        { id: makeChoiceId(), text: '' },
        { id: makeChoiceId(), text: '' },
        { id: makeChoiceId(), text: '' },
      ],
      correctIndex: null,
      errors: [],
    });
  };

  const validateDraft = (draft: DraftQuestion): DraftQuestion => {
    const errors: string[] = [];
    if (!draft.prompt.trim()) {
      errors.push('El enunciado es obligatorio.');
    }
    const filledChoices = draft.choices.map((choice) => choice.text.trim());
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

  const validateEditDraft = (draft: EditQuestionDraft): EditQuestionDraft => {
    const errors: string[] = [];
    if (!draft.prompt.trim()) {
      errors.push('El enunciado es obligatorio.');
    }
    const filledChoices = draft.choices.map((choice) => choice.text.trim());
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

    const trimmedChoices = validated.choices.map((choice) =>
      choice.text.trim(),
    );
    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc(
      rpcNames.createQuestionFull,
      {
        p_quiz_id: quizId,
        p_prompt: validated.prompt.trim(),
        p_explanation: validated.explanation?.trim() || null,
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

  const handleStartEditQuestion = (question: QuizQuestion) => {
    if (draftQuestion) {
      setActionError('Guardá o descartá el borrador antes de editar.');
      return;
    }
    if (editingQuestionId && editingQuestionId !== question.question_id) {
      setActionError('Finalizá la edición actual antes de continuar.');
      return;
    }

    const orderedChoices = [...(question.choices ?? [])].sort((a, b) =>
      a.position === b.position
        ? a.choice_id.localeCompare(b.choice_id)
        : a.position - b.position,
    );
    const correctIndex = orderedChoices.findIndex(
      (choice) => choice.is_correct,
    );

    setEditDraft({
      questionId: question.question_id,
      prompt: question.prompt ?? '',
      explanation: question.explanation ?? '',
      choices: orderedChoices.map((choice) => ({
        id: choice.choice_id,
        text: choice.text ?? '',
      })),
      correctIndex: correctIndex === -1 ? null : correctIndex,
      errors: [],
    });
    setEditingQuestionId(question.question_id);
    setEditError('');
    setEditNotice('');
    setActionError('');
    setActionSuccess('');
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditDraft(null);
    setEditError('');
    setEditNotice('');
  };

  const handleSaveEditQuestion = async () => {
    if (!editDraft) return;
    const validated = validateEditDraft(editDraft);
    setEditDraft(validated);
    if (validated.errors.length > 0) {
      setEditError('Hay errores en la edición.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    setEditNotice('');

    const { error: questionError } = await supabase.rpc(
      rpcNames.updateQuestion,
      {
        p_question_id: validated.questionId,
        p_prompt: validated.prompt.trim(),
        p_explanation: validated.explanation?.trim() || null,
      },
    );
    if (questionError) {
      setEditSaving(false);
      setEditError(questionError.message);
      return;
    }

    const createdChoiceIds = new Map<string, string>();
    for (const choice of validated.choices) {
      const text = choice.text.trim();
      if (!choice.isNew) {
        const { error } = await supabase.rpc(rpcNames.updateChoice, {
          p_choice_id: choice.id,
          p_text: text,
          p_is_correct: null,
        });
        if (error) {
          setEditSaving(false);
          setEditError(error.message);
          return;
        }
        continue;
      }

      const { data, error } = await supabase.rpc(rpcNames.createChoice, {
        p_question_id: validated.questionId,
        p_text: text,
        p_is_correct: false,
      });
      if (error) {
        setEditSaving(false);
        setEditError(error.message);
        return;
      }
      if (typeof data === 'string') {
        createdChoiceIds.set(choice.id, data);
      }
    }

    const orderedChoiceIds = validated.choices.map((choice) => {
      if (choice.isNew) {
        return createdChoiceIds.get(choice.id) ?? choice.id;
      }
      return choice.id;
    });
    const correctChoiceId =
      validated.correctIndex != null
        ? orderedChoiceIds[validated.correctIndex]
        : null;
    if (!correctChoiceId) {
      setEditSaving(false);
      setEditError('No se pudo resolver la opción correcta.');
      return;
    }

    const { error: correctError } = await supabase.rpc(
      rpcNames.setCorrectChoice,
      {
        p_question_id: validated.questionId,
        p_choice_id: correctChoiceId,
      },
    );
    if (correctError) {
      setEditSaving(false);
      setEditError(correctError.message);
      return;
    }

    const { error: reorderError } = await supabase.rpc(
      rpcNames.reorderChoices,
      {
        p_question_id: validated.questionId,
        p_choice_ids: orderedChoiceIds,
      },
    );
    if (reorderError) {
      setEditSaving(false);
      setEditError(reorderError.message);
      return;
    }

    await refetchQuiz();
    setEditSaving(false);
    setEditNotice('Cambios guardados.');
    setEditingQuestionId(null);
    setEditDraft(null);
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Configuración
                </h2>
                <button
                  className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={!canSave}
                  onClick={handleSaveMetadata}
                >
                  Guardar configuración
                </button>
              </div>
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
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <label className="flex items-center gap-3">
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-[10px] font-semibold text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                        type="button"
                        aria-label="Ayuda sobre mezclar preguntas"
                      >
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      Si está activado, en cada intento se seleccionan preguntas
                      del banco en orden aleatorio. Distintos intentos pueden
                      ver preguntas (y orden) diferentes.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <label className="flex items-center gap-3">
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-[10px] font-semibold text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                        type="button"
                        aria-label="Ayuda sobre mostrar respuestas correctas"
                      >
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      Si está activado, al finalizar el intento el colaborador
                      podrá ver cuáles eran las respuestas correctas.
                    </TooltipContent>
                  </Tooltip>
                </div>
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
                  {!isTemplate ? (
                    <button
                      className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                      type="button"
                      disabled={!canSave}
                      onClick={() => {
                        setArchivedError('');
                        setArchivedOpen(true);
                        void fetchArchivedQuestions();
                      }}
                    >
                      Archivadas
                      {archivedCount != null ? ` (${archivedCount})` : ''}
                    </button>
                  ) : null}
                  <button
                    className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                    type="button"
                    disabled={!canSave}
                    onClick={() => {
                      setPromptValue(effectivePrompt);
                      setPromptError('');
                      setPromptNotice('');
                      setPromptCopyFeedback('idle');
                      setPromptOpen(true);
                    }}
                  >
                    Prompt
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
              <Dialog
                open={archivedOpen}
                onOpenChange={(open) => {
                  setArchivedOpen(open);
                  if (open) {
                    void fetchArchivedQuestions();
                  }
                }}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Preguntas archivadas</DialogTitle>
                    <DialogDescription>
                      Las preguntas archivadas no aparecen en el quiz. Podés
                      restaurarlas cuando las necesites.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {archivedLoading ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                        Cargando archivadas...
                      </div>
                    ) : null}
                    {archivedError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {archivedError}
                      </div>
                    ) : null}
                    {!archivedLoading && archivedQuestions.length === 0 ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                        No hay preguntas archivadas.
                      </div>
                    ) : null}
                    {archivedQuestions.map((question) => (
                      <div
                        key={question.question_id}
                        className="rounded-xl border border-zinc-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-900">
                              {question.prompt}
                            </p>
                            <p className="mt-2 text-xs text-zinc-500">
                              Archivada{' '}
                              {new Date(question.archived_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                              type="button"
                              disabled={restoringId === question.question_id}
                              onClick={() =>
                                handleRestoreArchived(question.question_id)
                              }
                            >
                              {restoringId === question.question_id
                                ? 'Restaurando...'
                                : 'Restaurar'}
                            </button>
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                              type="button"
                              disabled={restoringId === question.question_id}
                              onClick={() =>
                                handleRestoreArchived(question.question_id, {
                                  edit: true,
                                })
                              }
                            >
                              Restaurar y editar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <button
                      className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      type="button"
                      onClick={() => setArchivedOpen(false)}
                    >
                      Cerrar
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={promptOpen}
                onOpenChange={(open) => {
                  setPromptOpen(open);
                  if (open) {
                    setPromptValue(effectivePrompt);
                    setPromptError('');
                    setPromptNotice('');
                    setPromptCopyFeedback('idle');
                  }
                }}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Prompt ONBO</DialogTitle>
                    <DialogDescription>
                      Editá el prompt maestro para generar preguntas
                      automáticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <textarea
                      className="min-h-[240px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      value={promptValue}
                      onChange={(event) => setPromptValue(event.target.value)}
                    />
                    {!canManagePrompt ? (
                      <p className="text-xs text-zinc-500">
                        Este prompt es de solo lectura en templates.
                      </p>
                    ) : null}
                    {promptError ? (
                      <p className="text-xs text-red-600">{promptError}</p>
                    ) : null}
                    {promptNotice ? (
                      <p className="text-xs text-emerald-700">{promptNotice}</p>
                    ) : null}
                    {promptCopyFeedback === 'error' ? (
                      <p className="text-xs text-amber-700">
                        No se pudo copiar el prompt.
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        type="button"
                        onClick={handlePromptCopy}
                      >
                        {promptCopyFeedback === 'copied' ? 'Copiado' : 'Copiar'}
                      </button>
                      {canManagePrompt ? (
                        <button
                          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                          type="button"
                          disabled={promptSaving}
                          onClick={handlePromptReset}
                        >
                          Restablecer al predeterminado
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        type="button"
                        onClick={() => setPromptOpen(false)}
                      >
                        Cerrar
                      </button>
                      {canManagePrompt ? (
                        <button
                          className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          type="button"
                          disabled={promptSaving}
                          onClick={() => handlePromptSave()}
                        >
                          {promptSaving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                      ) : null}
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
                        key={choice.id}
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
                          value={choice.text}
                          onChange={(event) =>
                            setDraftQuestion((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    choices: prev.choices.map((c, cIdx) =>
                                      cIdx === idx
                                        ? { ...c, text: event.target.value }
                                        : c,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                            }
                          }}
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
                                      (cItem) => cItem.id !== choice.id,
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
                            ? {
                                ...prev,
                                choices: [
                                  ...prev.choices,
                                  { id: makeChoiceId(), text: '' },
                                ],
                              }
                            : prev,
                        )
                      }
                    >
                      + Opción
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Explicación (opcional)
                    </label>
                    <textarea
                      className="min-h-[90px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      placeholder="Se usa para explicar por qué la respuesta correcta es la correcta."
                      value={draftQuestion.explanation ?? ''}
                      onChange={(event) =>
                        setDraftQuestion((prev) =>
                          prev
                            ? { ...prev, explanation: event.target.value }
                            : prev,
                        )
                      }
                    />
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

              {questions.map((question, index) => {
                const isEditing = editingQuestionId === question.question_id;
                const editBlocked =
                  !!draftQuestion ||
                  (!!editingQuestionId && !isEditing) ||
                  editSaving;
                const draft = isEditing ? editDraft : null;
                return (
                  <div
                    key={question.question_id}
                    data-question-id={question.question_id}
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
                        {!isEditing ? (
                          <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-900">
                            {question.prompt}
                          </p>
                        ) : (
                          <textarea
                            className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                            value={draft?.prompt ?? ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? { ...prev, prompt: event.target.value }
                                  : prev,
                              )
                            }
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                        {!isEditing ? (
                          <>
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                              type="button"
                              disabled={!canSave || editBlocked}
                              onClick={() => handleStartEditQuestion(question)}
                            >
                              Editar
                            </button>
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                              type="button"
                              disabled={!canSave || index === 0 || editBlocked}
                              onClick={() => {
                                const order = questions.map(
                                  (q) => q.question_id,
                                );
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
                              disabled={
                                !canSave ||
                                index === questions.length - 1 ||
                                editBlocked
                              }
                              onClick={() => {
                                const order = questions.map(
                                  (q) => q.question_id,
                                );
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
                              disabled={!canSave || editBlocked}
                              onClick={() =>
                                handleArchiveQuestion(question.question_id)
                              }
                            >
                              Archivar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                              type="button"
                              disabled={editSaving}
                              onClick={handleCancelEditQuestion}
                            >
                              Cancelar
                            </button>
                            <button
                              className="rounded-full bg-zinc-900 px-3 py-1 font-semibold text-white disabled:opacity-60"
                              type="button"
                              disabled={editSaving}
                              onClick={handleSaveEditQuestion}
                            >
                              {editSaving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-900">
                          Opciones
                        </h3>
                        {isEditing ? (
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                            type="button"
                            onClick={() =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      choices: [
                                        ...prev.choices,
                                        {
                                          id: makeChoiceId(),
                                          text: '',
                                          isNew: true,
                                        },
                                      ],
                                    }
                                  : prev,
                              )
                            }
                          >
                            + Opción
                          </button>
                        ) : null}
                      </div>

                      {!isEditing ? (
                        <>
                          {question.choices.length === 0 && (
                            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                              Sin opciones cargadas.
                            </div>
                          )}
                          {question.choices.map((choice) => (
                            <div
                              key={choice.choice_id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                            >
                              <span className="text-sm text-zinc-700">
                                {choice.text}
                              </span>
                              {choice.is_correct ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                  Correcta
                                </span>
                              ) : null}
                            </div>
                          ))}
                          {question.explanation?.trim() ? (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                                Explicación
                              </p>
                              <p className="mt-2 whitespace-pre-wrap">
                                {question.explanation}
                              </p>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {draft?.choices.map((choice, choiceIndex) => (
                            <div
                              key={choice.id}
                              className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-2 text-sm"
                            >
                              <input
                                type="radio"
                                checked={draft.correctIndex === choiceIndex}
                                onChange={() =>
                                  setEditDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          correctIndex: choiceIndex,
                                        }
                                      : prev,
                                  )
                                }
                              />
                              <input
                                className="flex-1 bg-transparent text-sm text-zinc-800 outline-none"
                                placeholder={`Opción ${choiceIndex + 1}`}
                                value={choice.text}
                                onChange={(event) =>
                                  setEditDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          choices: prev.choices.map((c, idx) =>
                                            idx === choiceIndex
                                              ? {
                                                  ...c,
                                                  text: event.target.value,
                                                }
                                              : c,
                                          ),
                                        }
                                      : prev,
                                  )
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <button
                                  className="rounded-full border border-zinc-200 px-2 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                                  type="button"
                                  disabled={choiceIndex === 0}
                                  onClick={() =>
                                    setEditDraft((prev) => {
                                      if (!prev) return prev;
                                      const next = [...prev.choices];
                                      [
                                        next[choiceIndex - 1],
                                        next[choiceIndex],
                                      ] = [
                                        next[choiceIndex],
                                        next[choiceIndex - 1],
                                      ];
                                      const nextCorrect =
                                        prev.correctIndex === choiceIndex
                                          ? choiceIndex - 1
                                          : prev.correctIndex ===
                                              choiceIndex - 1
                                            ? choiceIndex
                                            : prev.correctIndex;
                                      return {
                                        ...prev,
                                        choices: next,
                                        correctIndex: nextCorrect,
                                      };
                                    })
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  className="rounded-full border border-zinc-200 px-2 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:opacity-60"
                                  type="button"
                                  disabled={
                                    !draft ||
                                    choiceIndex === draft.choices.length - 1
                                  }
                                  onClick={() =>
                                    setEditDraft((prev) => {
                                      if (!prev) return prev;
                                      const next = [...prev.choices];
                                      [
                                        next[choiceIndex],
                                        next[choiceIndex + 1],
                                      ] = [
                                        next[choiceIndex + 1],
                                        next[choiceIndex],
                                      ];
                                      const nextCorrect =
                                        prev.correctIndex === choiceIndex
                                          ? choiceIndex + 1
                                          : prev.correctIndex ===
                                              choiceIndex + 1
                                            ? choiceIndex
                                            : prev.correctIndex;
                                      return {
                                        ...prev,
                                        choices: next,
                                        correctIndex: nextCorrect,
                                      };
                                    })
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-60"
                                  type="button"
                                  disabled={
                                    draft.choices.length <= 2 || !choice.isNew
                                  }
                                  onClick={() =>
                                    setEditDraft((prev) => {
                                      if (!prev) return prev;
                                      const nextChoices = prev.choices.filter(
                                        (item) => item.id !== choice.id,
                                      );
                                      const nextCorrect =
                                        prev.correctIndex === choiceIndex
                                          ? null
                                          : prev.correctIndex != null &&
                                              prev.correctIndex > choiceIndex
                                            ? prev.correctIndex - 1
                                            : prev.correctIndex;
                                      return {
                                        ...prev,
                                        choices: nextChoices,
                                        correctIndex: nextCorrect,
                                      };
                                    })
                                  }
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                              Explicación (opcional)
                            </label>
                            <textarea
                              className="min-h-[90px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                              placeholder="Se usa para explicar por qué la respuesta correcta es la correcta."
                              value={draft?.explanation ?? ''}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        explanation: event.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {isEditing && draft?.errors.length ? (
                      <ul className="mt-3 space-y-1 text-xs text-rose-600">
                        {draft.errors.map((err) => (
                          <li key={err}>• {err}</li>
                        ))}
                      </ul>
                    ) : null}
                    {isEditing && editError ? (
                      <div className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                        {editError}
                      </div>
                    ) : null}
                    {isEditing && editNotice ? (
                      <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                        {editNotice}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
