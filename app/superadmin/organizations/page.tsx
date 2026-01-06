'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type OrgRow = {
  org_id: string;
  name: string;
  status: 'active' | 'archived';
  locals_count: number;
  users_count: number;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusStyles(status: OrgRow['status']) {
  if (status === 'archived') {
    return 'bg-zinc-200 text-zinc-700';
  }
  return 'bg-emerald-100 text-emerald-700';
}

export default function SuperadminOrganizationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_superadmin_organizations')
        .select('*');

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as OrgRow[]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(normalized));
  }, [query, rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Superadmin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Organizaciones
          </h1>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          href="/superadmin/organizations/new"
        >
          Crear organización
        </Link>
      </header>

      <input
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
        placeholder="Buscar por nombre de organización..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`org-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Error: {error}</p>
          <button
            className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            Todavía no hay organizaciones disponibles.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map((org) => (
            <div
              key={org.org_id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {org.name}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
                      org.status,
                    )}`}
                  >
                    {org.status === 'archived' ? 'Archivada' : 'Activa'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Creada el {formatDate(org.created_at)}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
                  <span>{org.locals_count} locales</span>
                  <span>{org.users_count} usuarios</span>
                </div>
              </div>
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                href={`/superadmin/organizations/${org.org_id}`}
              >
                Ver detalle
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
