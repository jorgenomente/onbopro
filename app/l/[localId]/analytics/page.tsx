'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { LearnerShell } from '@/components/learner/LearnerShell';
import { Card } from '@/components/learner/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const tabs = [
  { key: 'summary', label: 'Resumen' },
  { key: 'questions', label: 'Preguntas' },
  { key: 'options', label: 'Distractores' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

type RefQuizAnalyticsRow = {
  local_id: string;
  course_id: string;
  quiz_id: string;
  quiz_title: string;
  attempt_count: number;
  submitted_count: number;
  pass_count: number;
  pass_rate: number | null;
  avg_score: number | null;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
};

type RefQuizQuestionAnalyticsRow = {
  local_id: string;
  course_id: string;
  quiz_id: string;
  question_id: string;
  prompt: string;
  seen_count: number;
  answered_count: number;
  correct_count: number;
  incorrect_count: number;
  correct_rate: number | null;
};

type RefQuizOptionAnalyticsRow = {
  local_id: string;
  course_id: string;
  quiz_id: string;
  question_id: string;
  option_id: string;
  option_text: string;
  is_correct: boolean;
  picked_count: number;
  picked_rate: number | null;
};

function formatPct(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function RefQuizAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;

  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<RefQuizAnalyticsRow[]>([]);
  const [questions, setQuestions] = useState<RefQuizQuestionAnalyticsRow[]>([]);
  const [quizFilter, setQuizFilter] = useState<string>('all');

  const [optionOpen, setOptionOpen] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);
  const [optionError, setOptionError] = useState('');
  const [optionRows, setOptionRows] = useState<RefQuizOptionAnalyticsRow[]>([]);
  const [selectedQuestion, setSelectedQuestion] =
    useState<RefQuizQuestionAnalyticsRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const [summaryRes, questionRes] = await Promise.all([
        supabase
          .from('v_ref_quiz_analytics')
          .select('*')
          .eq('local_id', localId)
          .order('last_attempt_at', { ascending: false }),
        supabase
          .from('v_ref_quiz_question_analytics')
          .select('*')
          .eq('local_id', localId)
          .order('correct_rate', { ascending: true })
          .order('seen_count', { ascending: false }),
      ]);

      if (cancelled) return;

      if (summaryRes.error) {
        setError(summaryRes.error.message);
        setSummary([]);
        setQuestions([]);
        setLoading(false);
        return;
      }

      if (questionRes.error) {
        setError(questionRes.error.message);
        setSummary([]);
        setQuestions([]);
        setLoading(false);
        return;
      }

      setSummary((summaryRes.data as RefQuizAnalyticsRow[]) ?? []);
      setQuestions((questionRes.data as RefQuizQuestionAnalyticsRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const quizOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of summary) {
      if (!map.has(row.quiz_id)) {
        map.set(row.quiz_id, row.quiz_title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [summary]);

  const filteredQuestions = useMemo(() => {
    if (quizFilter === 'all') return questions;
    return questions.filter((row) => row.quiz_id === quizFilter);
  }, [questions, quizFilter]);

  const handleOpenDistractors = async (
    question: RefQuizQuestionAnalyticsRow,
  ) => {
    setSelectedQuestion(question);
    setOptionOpen(true);
    setOptionLoading(true);
    setOptionError('');

    const { data, error: fetchError } = await supabase
      .from('v_ref_quiz_option_analytics')
      .select('*')
      .eq('local_id', localId)
      .eq('question_id', question.question_id)
      .order('picked_rate', { ascending: false });

    if (fetchError) {
      setOptionError(fetchError.message);
      setOptionRows([]);
      setOptionLoading(false);
      return;
    }

    setOptionRows((data as RefQuizOptionAnalyticsRow[]) ?? []);
    setOptionLoading(false);
  };

  if (!localId) {
    return (
      <LearnerShell maxWidthClass="max-w-5xl">
        <Card>
          <p className="text-sm text-zinc-600">Local no encontrado.</p>
        </Card>
      </LearnerShell>
    );
  }

  return (
    <LearnerShell maxWidthClass="max-w-5xl">
      <div className="space-y-6">
        <Card>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Analytics
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Analytics del local
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Te ayuda a detectar qué temas reforzar.
          </p>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeTab === tab.key
                      ? 'bg-zinc-900 text-white'
                      : 'border border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'questions' ? (
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 sm:max-w-xs"
                value={quizFilter}
                onChange={(event) => setQuizFilter(event.target.value)}
              >
                <option value="all">Todos los quizzes</option>
                {quizOptions.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </Card>

        {loading && (
          <div className="space-y-4">
            <Card className="h-12 animate-pulse" />
            <Card className="h-40 animate-pulse" />
          </div>
        )}

        {!loading && error && (
          <Card>
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              type="button"
              onClick={() => router.refresh()}
            >
              Reintentar
            </button>
          </Card>
        )}

        {!loading && !error && activeTab === 'summary' && (
          <Card>
            {summary.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay datos suficientes para mostrar analytics en este
                local.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-2">Quiz</th>
                      <th className="px-2 py-2">Intentos enviados</th>
                      <th className="px-2 py-2">% Aprobación</th>
                      <th className="px-2 py-2">Puntaje promedio</th>
                      <th className="px-2 py-2">Último intento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.quiz_id} className="border-t">
                        <td className="px-2 py-3 font-semibold text-zinc-900">
                          {row.quiz_title}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {row.submitted_count}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {formatPct(row.pass_rate)}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {formatScore(row.avg_score)}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {formatDate(row.last_attempt_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {!loading && !error && activeTab === 'questions' && (
          <Card>
            {filteredQuestions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay datos suficientes para mostrar analytics en este
                local.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-2">Pregunta</th>
                      <th className="px-2 py-2">Vistas</th>
                      <th className="px-2 py-2">Respondidas</th>
                      <th className="px-2 py-2">% Correctas</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((row) => (
                      <tr key={row.question_id} className="border-t">
                        <td className="px-2 py-3 text-zinc-700">
                          <div className="line-clamp-2">
                            {row.prompt || '—'}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {row.seen_count}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {row.answered_count}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {formatPct(row.correct_rate)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                            type="button"
                            onClick={() => handleOpenDistractors(row)}
                          >
                            Ver distractores
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {!loading && !error && activeTab === 'options' && (
          <Card>
            <p className="text-sm text-zinc-500">
              Seleccioná “Ver distractores” desde la pestaña Preguntas para ver
              el detalle.
            </p>
          </Card>
        )}
      </div>

      <Dialog open={optionOpen} onOpenChange={setOptionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Distractores</DialogTitle>
            <DialogDescription>
              {selectedQuestion?.prompt || 'Pregunta seleccionada'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {optionLoading ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                Cargando distractores...
              </div>
            ) : null}
            {optionError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {optionError}
              </div>
            ) : null}
            {!optionLoading && optionRows.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                No hay datos de distractores para esta pregunta.
              </div>
            ) : null}
            {optionRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-2">Opción</th>
                      <th className="px-2 py-2">Elegida %</th>
                      <th className="px-2 py-2">Correcta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optionRows.map((row) => (
                      <tr key={row.option_id} className="border-t">
                        <td className="px-2 py-3 text-zinc-700">
                          {row.option_text}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {formatPct(row.picked_rate)}
                        </td>
                        <td className="px-2 py-3 text-zinc-700">
                          {row.is_correct ? '✔' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              type="button"
              onClick={() => setOptionOpen(false)}
            >
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LearnerShell>
  );
}
