'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import { courseAnalyticsCrumbs } from '@/app/org/_lib/breadcrumbs';
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

type OrgQuizAnalyticsRow = {
  org_id: string;
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

type OrgQuizQuestionAnalyticsRow = {
  org_id: string;
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

type OrgQuizOptionAnalyticsRow = {
  org_id: string;
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

export default function OrgQuizAnalyticsPage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<OrgQuizAnalyticsRow[]>([]);
  const [questions, setQuestions] = useState<OrgQuizQuestionAnalyticsRow[]>([]);
  const [quizFilter, setQuizFilter] = useState<string>('all');

  const [optionOpen, setOptionOpen] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);
  const [optionError, setOptionError] = useState('');
  const [optionRows, setOptionRows] = useState<OrgQuizOptionAnalyticsRow[]>([]);
  const [selectedQuestion, setSelectedQuestion] =
    useState<OrgQuizQuestionAnalyticsRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!courseId) return;
      setLoading(true);
      setError('');

      const [summaryRes, questionRes] = await Promise.all([
        supabase
          .from('v_org_quiz_analytics')
          .select('*')
          .eq('course_id', courseId)
          .order('last_attempt_at', { ascending: false }),
        supabase
          .from('v_org_quiz_question_analytics')
          .select('*')
          .eq('course_id', courseId)
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

      setSummary((summaryRes.data as OrgQuizAnalyticsRow[]) ?? []);
      setQuestions((questionRes.data as OrgQuizQuestionAnalyticsRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

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
    question: OrgQuizQuestionAnalyticsRow,
  ) => {
    setSelectedQuestion(question);
    setOptionOpen(true);
    setOptionLoading(true);
    setOptionError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_quiz_option_analytics')
      .select('*')
      .eq('course_id', courseId)
      .eq('question_id', question.question_id)
      .order('picked_rate', { ascending: false });

    if (fetchError) {
      setOptionError(fetchError.message);
      setOptionRows([]);
      setOptionLoading(false);
      return;
    }

    setOptionRows((data as OrgQuizOptionAnalyticsRow[]) ?? []);
    setOptionLoading(false);
  };

  if (!courseId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Curso no encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          {/* TODO(gap): v_org_quiz_analytics does not expose course_title yet. */}
          <Breadcrumbs
            items={courseAnalyticsCrumbs({
              courseId,
              courseTitle: null,
            })}
          />
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Analytics
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Analytics del curso
            </h1>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
        </section>

        {loading && (
          <div className="space-y-4">
            <div className="h-12 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}

        {!loading && !error && activeTab === 'summary' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            {summary.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay datos suficientes para mostrar analytics.
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
          </section>
        )}

        {!loading && !error && activeTab === 'questions' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            {filteredQuestions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay datos suficientes para mostrar analytics.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-2">Pregunta</th>
                      <th className="px-2 py-2">Veces vista</th>
                      <th className="px-2 py-2">Respondida</th>
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
          </section>
        )}

        {!loading && !error && activeTab === 'options' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">
              Seleccioná “Ver distractores” desde la pestaña Preguntas para ver
              el detalle.
            </p>
          </section>
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
    </div>
  );
}
