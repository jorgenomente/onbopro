'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LearnerRow = {
  local_id: string;
  learner_id: string;
  learner_name: string;
  learner_email: string;
  membership_status: string;
  membership_created_at: string;
  last_activity_at: string | null;
  completed_lessons: number;
  total_lessons: number;
  completion_percent: number;
  avg_score: number | null;
  learner_state: 'active' | 'inactive' | 'graduated';
  risk_level: 'none' | 'warning' | 'danger';
  recent_flag: boolean;
  current_course_id: string | null;
  current_course_title: string | null;
};

type TabKey = 'all' | 'active' | 'risk' | 'graduated';

function formatTimestamp(value: string | null) {
  if (!value) return 'Sin actividad reciente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad reciente';
  return date.toLocaleString();
}

function getBadgeLabel(row: LearnerRow) {
  if (row.learner_state === 'graduated') return 'Graduado';
  if (row.risk_level === 'danger') return 'Riesgo';
  if (row.risk_level === 'warning') return 'Atención';
  return 'En progreso';
}

function getBadgeClass(row: LearnerRow) {
  if (row.learner_state === 'graduated') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (row.risk_level === 'danger') {
    return 'bg-red-100 text-red-700';
  }
  if (row.risk_level === 'warning') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-zinc-100 text-zinc-700';
}

export default function RefLearnersPage() {
  const params = useParams();
  const localId = params?.localId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const fetchLearners = async () => {
    if (!localId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_ref_learners')
      .select('*')
      .eq('local_id', localId)
      .order('recent_flag', { ascending: false })
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('learner_name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as LearnerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_ref_learners')
        .select('*')
        .eq('local_id', localId)
        .order('recent_flag', { ascending: false })
        .order('last_activity_at', { ascending: false, nullsFirst: false })
        .order('learner_name', { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as LearnerRow[]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const counts = useMemo(() => {
    const total = rows.length;
    const activos = rows.filter((row) => row.learner_state === 'active').length;
    const enRiesgo = rows.filter((row) =>
      ['warning', 'danger'].includes(row.risk_level),
    ).length;
    const graduados = rows.filter(
      (row) => row.learner_state === 'graduated',
    ).length;
    return { total, activos, enRiesgo, graduados };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeTab === 'active' && row.learner_state !== 'active') {
        return false;
      }
      if (
        activeTab === 'risk' &&
        !['warning', 'danger'].includes(row.risk_level)
      ) {
        return false;
      }
      if (activeTab === 'graduated' && row.learner_state !== 'graduated') {
        return false;
      }

      if (!normalized) return true;
      const name = row.learner_name.toLowerCase();
      const email = row.learner_email.toLowerCase();
      return name.includes(normalized) || email.includes(normalized);
    });
  }, [activeTab, query, rows]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-2">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Referente
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Mis Aprendices
          </h1>
          <p className="text-sm text-zinc-500">
            Seguimiento del progreso del local.
          </p>
        </header>

        <div className="mt-6">
          <input
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
            placeholder="Buscar por nombre o email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900">
              {counts.total}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Activos</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900">
              {counts.activos}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">En riesgo</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900">
              {counts.enRiesgo}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Graduados</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900">
              {counts.graduados}
            </p>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Activos' },
            { key: 'risk', label: 'Riesgo' },
            { key: 'graduated', label: 'Graduados' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600'
              }`}
              onClick={() => setActiveTab(tab.key as TabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-28 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchLearners}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No hay aprendices disponibles para este filtro.
            </p>
          </div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="mt-8 space-y-4">
            {filteredRows.map((row) => (
              <Link
                key={row.learner_id}
                href={`/l/${localId}/ref/learners/${row.learner_id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {row.learner_name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.learner_email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClass(
                      row,
                    )}`}
                  >
                    {getBadgeLabel(row)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Progreso</span>
                    <span>{row.completion_percent}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-zinc-900"
                      style={{ width: `${row.completion_percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                  <span>{formatTimestamp(row.last_activity_at)}</span>
                  {row.avg_score != null && (
                    <span>Score promedio: {row.avg_score.toFixed(1)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
