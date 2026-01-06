'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type OrgLocal = {
  local_id: string;
  local_code: string;
  local_name: string;
  status: 'on_track' | 'at_risk' | 'inactive';
  learners_count: number;
  completion_rate_pct: number | null;
  risk_reason: 'low_completion' | 'inactivity' | null;
};

type OrgDashboardRow = {
  org_id: string;
  total_locals: number;
  active_locals: number;
  inactive_locals: number;
  avg_engagement_pct: number | null;
  locals_at_risk: number;
  locals: OrgLocal[];
};

type FilterKey = 'all' | 'on_track' | 'at_risk' | 'inactive';

function formatPercent(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value)}%`;
}

function statusLabel(status: OrgLocal['status']) {
  if (status === 'at_risk') return 'At Risk';
  if (status === 'inactive') return 'Inactive';
  return 'On Track';
}

function statusClass(status: OrgLocal['status']) {
  if (status === 'at_risk') return 'bg-red-100 text-red-700';
  if (status === 'inactive') return 'bg-zinc-200 text-zinc-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function OrgDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<OrgDashboardRow | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_dashboard')
        .select('*')
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

      setRow(data as OrgDashboardRow);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const locals = useMemo(() => row?.locals ?? [], [row]);

  const filteredLocals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return locals.filter((local) => {
      if (filter !== 'all' && local.status !== filter) {
        return false;
      }
      if (!normalized) return true;
      return (
        local.local_name.toLowerCase().includes(normalized) ||
        local.local_code.toLowerCase().includes(normalized)
      );
    });
  }, [filter, locals, query]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Org Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Org Overview
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border border-zinc-200 bg-white" />
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
              onClick={() => window.location.reload()}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (!row || locals.length === 0) && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No hay locales disponibles para esta organización.
            </p>
          </div>
        )}

        {!loading && !error && row && locals.length > 0 && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Total Locals
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.total_locals}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Avg Engagement
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {formatPercent(row.avg_engagement_pct)}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  At Risk
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {row.locals_at_risk}
                </p>
              </div>
            </section>

            <div className="mt-8 space-y-4">
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
                placeholder="Search locals..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All Status' },
                  { key: 'on_track', label: 'On Track' },
                  { key: 'at_risk', label: 'At Risk' },
                  { key: 'inactive', label: 'Inactive' },
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
            </div>

            <section className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Locals Performance
              </h2>
              {filteredLocals.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                  No locals match the current filters.
                </div>
              )}
              {filteredLocals.map((local) => (
                <button
                  key={local.local_id}
                  type="button"
                  onClick={() => router.push(`/org/locals/${local.local_id}`)}
                  className="w-full rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                        {local.local_code.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {local.local_name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {local.local_code}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        local.status,
                      )}`}
                    >
                      {statusLabel(local.status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>Completion</span>
                      <span>{formatPercent(local.completion_rate_pct)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-zinc-900"
                        style={{
                          width: `${Math.round(local.completion_rate_pct ?? 0)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500">
                    Learners: {local.learners_count ?? '—'}
                  </div>
                </button>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
