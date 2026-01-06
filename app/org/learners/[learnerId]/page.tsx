'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const NOW = Date.now();
const MS_IN_DAY = 1000 * 60 * 60 * 24;

type LocalChip = {
  local_id: string;
  local_name: string;
};

type IncorrectTopic = {
  topic: string;
  incorrect_count: number;
};

type CourseItem = {
  course_id: string;
  course_title: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress_pct: number | null;
  assigned_at: string | null;
  completed_at: string | null;
};

type QuizItem = {
  quiz_id: string;
  quiz_title: string;
  score_pct: number | null;
  passed: boolean;
  last_attempt_at: string | null;
};

type ActivityItem = {
  event_type: string;
  event_label: string;
  occurred_at: string;
};

type LearnerDetailRow = {
  org_id: string;
  learner_id: string;
  learner_name: string;
  learner_status: 'active' | 'at_risk' | 'completed';
  last_activity_at: string | null;
  locals: LocalChip[];
  overall_progress_pct: number | null;
  courses_assigned_count: number;
  courses_completed_count: number;
  quizzes_passed_count: number;
  quizzes_failed_count: number;
  top_incorrect_topics: IncorrectTopic[];
  courses: CourseItem[];
  quizzes: QuizItem[];
  recent_activity: ActivityItem[];
};

function formatPercent(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusLabel(status: LearnerDetailRow['learner_status']) {
  if (status === 'completed') return 'Completed';
  if (status === 'at_risk') return 'At Risk';
  return 'Active';
}

function statusClass(status: LearnerDetailRow['learner_status']) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'at_risk') return 'bg-red-100 text-red-700';
  return 'bg-zinc-100 text-zinc-700';
}

function courseStatusLabel(status: CourseItem['status']) {
  if (status === 'completed') return 'Completed';
  if (status === 'pending') return 'Pending';
  return 'In progress';
}

function courseStatusClass(status: CourseItem['status']) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'pending') return 'bg-zinc-100 text-zinc-700';
  return 'bg-amber-100 text-amber-700';
}

export default function OrgLearnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const learnerId = params?.learnerId as string;
  const localIdParam = searchParams?.get('localId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LearnerDetailRow | null>(null);

  const fetchDetail = async () => {
    if (!learnerId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_learner_detail')
      .select('*')
      .eq('learner_id', learnerId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    setRow((data as LearnerDetailRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!learnerId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_learner_detail')
        .select('*')
        .eq('learner_id', learnerId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow((data as LearnerDetailRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  const locals = useMemo(() => row?.locals ?? [], [row]);
  const topics = useMemo(() => row?.top_incorrect_topics ?? [], [row]);
  const courses = useMemo(() => row?.courses ?? [], [row]);
  const quizzes = useMemo(() => row?.quizzes ?? [], [row]);
  const recentActivity = useMemo(() => row?.recent_activity ?? [], [row]);

  const callout = useMemo(() => {
    if (!row || row.learner_status !== 'at_risk') return null;
    if (row.last_activity_at) {
      const last = new Date(row.last_activity_at).getTime();
      const days = Math.floor((NOW - last) / MS_IN_DAY);
      if (days >= 14) {
        return `No activity in the last ${days} days.`;
      }
    }
    if (topics.length > 0) {
      return 'Repeated quiz difficulties detected.';
    }
    return 'Needs attention.';
  }, [row, topics]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-3">
          <button
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            type="button"
            onClick={() => {
              if (localIdParam) {
                router.push(`/org/locals/${localIdParam}`);
                return;
              }
              router.push('/org/dashboard');
            }}
          >
            ← Back
          </button>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Learner Overview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              {row?.learner_name ?? 'Learner'}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {row && (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                    row.learner_status,
                  )}`}
                >
                  {statusLabel(row.learner_status)}
                </span>
              )}
              <span>
                Last activity: {formatTimestamp(row?.last_activity_at ?? null)}
              </span>
            </div>
          </div>
        </header>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-24 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchDetail}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenés acceso a este aprendiz o no existe.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <>
            {callout && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {callout}
              </div>
            )}

            {locals.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-700">
                  Assigned locals
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {locals.map((local) => (
                    <Link
                      key={local.local_id}
                      href={`/org/locals/${local.local_id}`}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600 hover:border-zinc-300"
                    >
                      {local.local_name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Overall Progress
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {formatPercent(row.overall_progress_pct)}
                </p>
                <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-900"
                    style={{
                      width: `${Math.round(row.overall_progress_pct ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Courses
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.courses_assigned_count}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Completed: {row.courses_completed_count}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Quizzes
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.quizzes_passed_count}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Failed: {row.quizzes_failed_count}
                </p>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Needs attention
              </h2>
              <div className="mt-4 space-y-3">
                {topics.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No issues detected yet.
                  </div>
                )}
                {topics.map((topic) => (
                  <div
                    key={topic.topic}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {topic.topic}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Incorrect answers: {topic.incorrect_count}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Courses</h2>
              <div className="mt-4 space-y-4">
                {courses.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No courses assigned.
                  </div>
                )}
                {courses.map((course) => (
                  <div
                    key={course.course_id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {course.course_title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Assigned: {formatTimestamp(course.assigned_at)}
                        </p>
                        {course.completed_at && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Completed: {formatTimestamp(course.completed_at)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${courseStatusClass(
                          course.status,
                        )}`}
                      >
                        {courseStatusLabel(course.status)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Progress</span>
                        <span>{formatPercent(course.progress_pct)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{
                            width: `${Math.round(course.progress_pct ?? 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Quiz performance
              </h2>
              <div className="mt-4 space-y-4">
                {quizzes.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No quiz attempts yet.
                  </div>
                )}
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.quiz_id}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {quiz.quiz_title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Last attempt: {formatTimestamp(quiz.last_attempt_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>Score: {formatPercent(quiz.score_pct)}</span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            quiz.passed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {quiz.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Recent activity
              </h2>
              <div className="mt-4 space-y-3">
                {recentActivity.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No recent activity.
                  </div>
                )}
                {recentActivity.map((item, index) => (
                  <div
                    key={`${item.event_type}-${index}`}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {item.event_label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatTimestamp(item.occurred_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
