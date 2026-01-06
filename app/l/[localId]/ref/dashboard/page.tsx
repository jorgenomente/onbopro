'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type RefAlert = {
  type: 'overdue' | 'inactive';
  severity: 'warning' | 'danger';
  learner_id: string;
  learner_name: string;
  message: string;
  metric_value: number;
  last_activity_at: string | null;
};

type RefActivity = {
  occurred_at: string;
  learner_id: string;
  learner_name: string;
  event_type: 'lesson_completed' | 'quiz_submitted';
  label: string;
  course_id: string;
  course_title: string;
};

type RefDashboardRow = {
  local_id: string;
  local_name: string;
  as_of: string;
  health_percent: number;
  health_delta_percent: number | null;
  health_series: unknown;
  learners_count: number;
  learners_new_count: number | null;
  active_courses_count: number;
  completion_percent: number;
  completion_delta_percent: number | null;
  avg_score: number | null;
  avg_score_trend: string | null;
  alerts_count: number;
  alerts: RefAlert[];
  recent_activity: RefActivity[];
};

function formatTimestamp(value: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString();
}

export default function RefDashboardPage() {
  const params = useParams();
  const localId = params?.localId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<RefDashboardRow | null>(null);

  const fetchDashboard = async () => {
    if (!localId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_ref_dashboard')
      .select('*')
      .eq('local_id', localId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        setRow(null);
        setLoading(false);
        return;
      }
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    setRow(data as RefDashboardRow);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_ref_dashboard')
        .select('*')
        .eq('local_id', localId)
        .single();

      if (cancelled) return;

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setRow(null);
          setLoading(false);
          return;
        }
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data as RefDashboardRow);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const alerts = useMemo(() => row?.alerts ?? [], [row]);
  const recentActivity = useMemo(() => row?.recent_activity ?? [], [row]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-2">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Referente
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {row?.local_name ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-zinc-500">
            Actualizado: {formatTimestamp(row?.as_of ?? null)}
          </p>
        </header>

        {loading && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-28 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="h-4 w-1/2 rounded bg-zinc-200" />
                <div className="mt-4 h-6 w-1/3 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchDashboard}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No hay datos para este local.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Salud global
                </p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-3xl font-semibold text-zinc-900">
                    {row.health_percent}%
                  </span>
                  {row.health_delta_percent != null && (
                    <span className="text-xs text-zinc-500">
                      {row.health_delta_percent > 0 ? '+' : ''}
                      {row.health_delta_percent}%
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-900"
                    style={{ width: `${row.health_percent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Alertas
                </p>
                <div className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.alerts_count}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Casos en atencion esta semana.
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-4">
              <Link
                className="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
                href={`/l/${localId}/ref/learners`}
              >
                <p className="text-xs text-zinc-500">Aprendices</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {row.learners_count}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Ver todos los aprendices
                </p>
              </Link>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">Cursos activos</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {row.active_courses_count}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">Completitud</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {row.completion_percent}%
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">Score promedio</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {row.avg_score != null ? row.avg_score.toFixed(1) : 'N/A'}
                </p>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Alertas recientes
              </h2>
              <div className="mt-4 space-y-3">
                {alerts.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No hay alertas registradas.
                  </div>
                )}
                {alerts.map((alert) => (
                  <div
                    key={`${alert.learner_id}-${alert.type}`}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {alert.learner_name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {alert.message}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          alert.severity === 'danger'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {alert.severity === 'danger' ? 'Riesgo' : 'Atencion'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Actividad reciente
              </h2>
              <div className="mt-4 space-y-3">
                {recentActivity.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    Sin actividad reciente.
                  </div>
                )}
                {recentActivity.map((activity, index) => (
                  <div
                    key={`${activity.learner_id}-${activity.course_id}-${index}`}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {activity.learner_name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {activity.label} · {activity.course_title}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatTimestamp(activity.occurred_at)}
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
