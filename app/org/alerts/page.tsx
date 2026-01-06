'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type AlertType = 'inactive' | 'low_progress' | 'quiz_failed';
type AlertSeverity = 'at_risk' | 'critical';

type OrgAlertRow = {
  org_id: string;
  learner_id: string;
  learner_name: string;
  local_id: string;
  local_name: string;
  alert_type: AlertType;
  alert_severity: AlertSeverity;
  alert_label: string;
  alert_description: string;
  days_inactive: number | null;
  progress_pct: number | null;
  failed_quiz_count: number | null;
  last_activity_at: string | null;
};

type FilterKey = 'all' | AlertType;

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

function severityClass(severity: AlertSeverity) {
  if (severity === 'critical') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function typeLabel(type: AlertType) {
  if (type === 'quiz_failed') return 'Quiz Issues';
  if (type === 'low_progress') return 'Low Progress';
  return 'Inactive';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default function OrgAlertsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<OrgAlertRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [localFilter, setLocalFilter] = useState('all');

  const fetchAlerts = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_alerts')
      .select('*');

    if (fetchError) {
      setError(fetchError.message);
      setAlerts([]);
      setLoading(false);
      return;
    }

    setAlerts((data as OrgAlertRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_alerts')
        .select('*');

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setAlerts([]);
        setLoading(false);
        return;
      }

      setAlerts((data as OrgAlertRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const locals = useMemo(() => {
    const unique = new Map<string, string>();
    alerts.forEach((row) => {
      if (!unique.has(row.local_id)) {
        unique.set(row.local_id, row.local_name);
      }
    });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts]);

  const counts = useMemo(() => {
    const inactive = alerts.filter(
      (row) => row.alert_type === 'inactive',
    ).length;
    const lowProgress = alerts.filter(
      (row) => row.alert_type === 'low_progress',
    ).length;
    const quizFailed = alerts.filter(
      (row) => row.alert_type === 'quiz_failed',
    ).length;

    return {
      total: alerts.length,
      inactive,
      lowProgress,
      quizFailed,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return alerts.filter((row) => {
      if (filter !== 'all' && row.alert_type !== filter) {
        return false;
      }
      if (localFilter !== 'all' && row.local_id !== localFilter) {
        return false;
      }
      if (!normalized) return true;
      return (
        row.learner_name.toLowerCase().includes(normalized) ||
        row.local_name.toLowerCase().includes(normalized)
      );
    });
  }, [alerts, filter, localFilter, query]);

  const sortedAlerts = useMemo(() => {
    const typeRank: Record<AlertType, number> = {
      quiz_failed: 0,
      inactive: 1,
      low_progress: 2,
    };
    const severityRank: Record<AlertSeverity, number> = {
      critical: 0,
      at_risk: 1,
    };

    return filteredAlerts
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const severityDiff =
          severityRank[a.row.alert_severity] -
          severityRank[b.row.alert_severity];
        if (severityDiff !== 0) return severityDiff;

        const typeDiff =
          typeRank[a.row.alert_type] - typeRank[b.row.alert_type];
        if (typeDiff !== 0) return typeDiff;

        const daysA = a.row.days_inactive ?? -1;
        const daysB = b.row.days_inactive ?? -1;
        if (daysA !== daysB) return daysB - daysA;

        const progressA = a.row.progress_pct ?? Number.POSITIVE_INFINITY;
        const progressB = b.row.progress_pct ?? Number.POSITIVE_INFINITY;
        if (progressA !== progressB) return progressA - progressB;

        const nameDiff = a.row.learner_name.localeCompare(b.row.learner_name);
        if (nameDiff !== 0) return nameDiff;

        return a.index - b.index;
      })
      .map(({ row }) => row);
  }, [filteredAlerts]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Org Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Alerts &amp; Risks
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Learners that need attention across your organization.
            </p>
          </div>
        </header>

        {loading && (
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-20 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchAlerts}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-6 text-sm text-emerald-700 shadow-sm">
            All learners are on track. No alerts at the moment.
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  At Risk Learners
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {counts.total}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Inactive &gt; 14 days
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {counts.inactive}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Low Progress
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {counts.lowProgress}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Quiz Issues
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  {counts.quizFailed}
                </p>
              </div>
            </section>

            <section className="mt-8 space-y-4">
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
                placeholder="Search learners or locals..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'inactive', label: 'Inactive' },
                  { key: 'low_progress', label: 'Low Progress' },
                  { key: 'quiz_failed', label: 'Quiz Issues' },
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

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span>By local</span>
                <select
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 focus:outline-none"
                  value={localFilter}
                  onChange={(event) => setLocalFilter(event.target.value)}
                >
                  <option value="all">All locals</option>
                  {locals.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">Alerts</h2>
              {sortedAlerts.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                  No alerts match the current filters.
                </div>
              )}
              {sortedAlerts.map((alert) => (
                <button
                  key={`${alert.learner_id}-${alert.alert_type}`}
                  type="button"
                  onClick={() =>
                    router.push(`/org/learners/${alert.learner_id}`)
                  }
                  className="w-full rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                        {initials(alert.learner_name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {alert.learner_name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <Link
                            href={`/org/locals/${alert.local_id}`}
                            className="font-semibold text-zinc-700 hover:text-zinc-900"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {alert.local_name}
                          </Link>
                          <span>•</span>
                          <span>{typeLabel(alert.alert_type)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${severityClass(
                          alert.alert_severity,
                        )}`}
                      >
                        {alert.alert_severity === 'critical'
                          ? 'Critical'
                          : 'At Risk'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">
                      {alert.alert_label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {alert.alert_description}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
                    {alert.alert_type === 'inactive' && (
                      <span>Days inactive: {alert.days_inactive ?? '—'}</span>
                    )}
                    {alert.alert_type === 'low_progress' && (
                      <span>Progress: {formatPercent(alert.progress_pct)}</span>
                    )}
                    {alert.alert_type === 'quiz_failed' && (
                      <span>
                        Failed attempts: {alert.failed_quiz_count ?? '—'}
                      </span>
                    )}
                    <span>
                      Last activity: {formatDate(alert.last_activity_at)}
                    </span>
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
