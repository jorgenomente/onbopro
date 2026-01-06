'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LocalLearner = {
  learner_id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'active' | 'at_risk' | 'completed';
  progress_pct: number | null;
  last_activity_at: string | null;
};

type LocalDetailRow = {
  org_id: string;
  local_id: string;
  local_name: string;
  local_code: string | null;
  local_status: 'on_track' | 'at_risk' | 'inactive';
  learners_active_count: number;
  learners_at_risk_count: number;
  completion_rate_pct: number | null;
  learners: LocalLearner[];
};

type FilterKey = 'all' | 'active' | 'at_risk' | 'completed';

function formatPercent(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value)}%`;
}

function initials(value: string) {
  const parts = value.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'NA';
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

function localStatusLabel(status: LocalDetailRow['local_status']) {
  if (status === 'at_risk') return 'At Risk';
  if (status === 'inactive') return 'Inactive';
  return 'On Track';
}

function localStatusClass(status: LocalDetailRow['local_status']) {
  if (status === 'at_risk') return 'bg-red-100 text-red-700';
  if (status === 'inactive') return 'bg-zinc-200 text-zinc-700';
  return 'bg-emerald-100 text-emerald-700';
}

function learnerStatusLabel(status: LocalLearner['status']) {
  if (status === 'at_risk') return 'At Risk';
  if (status === 'completed') return 'Done';
  return 'Active';
}

function learnerStatusClass(status: LocalLearner['status']) {
  if (status === 'at_risk') return 'bg-red-100 text-red-700';
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  return 'bg-zinc-100 text-zinc-700';
}

export default function OrgLocalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LocalDetailRow | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchDetail = async () => {
    if (!localId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_local_detail')
      .select('*')
      .eq('local_id', localId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    setRow((data as LocalDetailRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_local_detail')
        .select('*')
        .eq('local_id', localId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow((data as LocalDetailRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const learners = useMemo(() => row?.learners ?? [], [row]);

  const filteredLearners = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return learners.filter((learner) => {
      if (filter !== 'all' && learner.status !== filter) {
        return false;
      }
      if (!normalized) return true;
      return learner.display_name.toLowerCase().includes(normalized);
    });
  }, [filter, learners, query]);

  const localCode =
    row?.local_code ??
    (row?.local_id ? `ID: ${row.local_id.slice(0, 8)}` : 'ID: —');

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-3">
          <button
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            type="button"
            onClick={() => router.push('/org/dashboard')}
          >
            ← Back to Org Overview
          </button>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Local Overview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              {row?.local_name ?? 'Local'}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span>{localCode}</span>
              {row && (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${localStatusClass(
                    row.local_status,
                  )}`}
                >
                  {localStatusLabel(row.local_status)}
                </span>
              )}
            </div>
          </div>
        </header>

        {loading && (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
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
              No tenés acceso a este local o no existe.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Active Learners
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.learners_active_count}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Completion
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {formatPercent(row.completion_rate_pct)}
                </p>
                <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-900"
                    style={{
                      width: `${Math.round(row.completion_rate_pct ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  At Risk
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.learners_at_risk_count}
                </p>
              </div>
            </section>

            <section className="mt-8 space-y-4">
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
                placeholder="Search learners..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'at_risk', label: 'At Risk' },
                  { key: 'completed', label: 'Completed' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      filter === tab.key
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 bg-white text-zinc-600'
                    }`}
                    onClick={() => setFilter(tab.key as FilterKey)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">Learners</h2>
              {learners.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                  No hay aprendices en este local.
                </div>
              )}
              {learners.length > 0 && filteredLearners.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                  No hay resultados para este filtro.
                </div>
              )}
              {filteredLearners.map((learner) => (
                <Link
                  key={learner.learner_id}
                  href={`/org/learners/${learner.learner_id}`}
                  className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {learner.avatar_url ? (
                      <Image
                        src={learner.avatar_url}
                        alt={learner.display_name}
                        className="h-12 w-12 rounded-full object-cover"
                        width={48}
                        height={48}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                        {initials(learner.display_name)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {learner.display_name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Last activity:{' '}
                        {learner.last_activity_at
                          ? new Date(
                              learner.last_activity_at,
                            ).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${learnerStatusClass(
                        learner.status,
                      )}`}
                    >
                      {learnerStatusLabel(learner.status)}
                    </span>
                    <div className="w-full max-w-[160px]">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Progress</span>
                        <span>{formatPercent(learner.progress_pct)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{
                            width: `${Math.round(learner.progress_pct ?? 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
