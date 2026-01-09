'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type OrgDetailRow = {
  org_id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
};

function statusLabel(status: OrgDetailRow['status']) {
  return status === 'archived' ? 'Archivada' : 'Activa';
}

function statusStyles(status: OrgDetailRow['status']) {
  if (status === 'archived') return 'bg-zinc-200 text-zinc-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function SuperadminCreateLocalPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.orgId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [org, setOrg] = useState<OrgDetailRow | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!orgId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_superadmin_organization_detail')
        .select('org_id, name, status, created_at')
        .eq('org_id', orgId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setOrg(null);
        setLoading(false);
        return;
      }

      setOrg((data as OrgDetailRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre del local es obligatorio.');
      return;
    }

    setSaving(true);
    setFormError('');

    const { data, error: rpcError } = await supabase.rpc('rpc_create_local', {
      p_org_id: orgId,
      p_name: trimmedName,
    });

    if (rpcError) {
      if (rpcError.code === '23505') {
        setFormError('Ya existe un local con ese nombre en esta organización.');
      } else if (rpcError.code === '42501') {
        setFormError('No autorizado.');
      } else {
        setFormError(rpcError.message);
      }
      setSaving(false);
      return;
    }

    if (!data) {
      setFormError('No se pudo crear el local.');
      setSaving(false);
      return;
    }

    router.push(`/superadmin/organizations/${orgId}`);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Link
            className="hover:text-zinc-700"
            href="/superadmin/organizations"
          >
            Organizaciones
          </Link>
          <span>/</span>
          <Link
            className="hover:text-zinc-700"
            href={`/superadmin/organizations/${orgId}`}
          >
            {org?.name ?? 'Organización'}
          </Link>
          <span>/</span>
          <span>Crear local</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Crear local</h1>
        {org ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span>Organización: {org.name}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
                org.status,
              )}`}
            >
              {statusLabel(org.status)}
            </span>
          </div>
        ) : null}
      </header>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Cargando...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Error: {error}</p>
          <Link
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            href={`/superadmin/organizations/${orgId}`}
          >
            Volver
          </Link>
        </div>
      )}

      {!loading && !error && !org && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            Organización no encontrada o sin acceso.
          </p>
        </div>
      )}

      {!loading && !error && org && (
        <form
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="name">
              Nombre del local
            </label>
            <input
              id="name"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Sucursal Palermo"
            />
            <p className="text-xs text-zinc-500">
              Debe ser único dentro de la organización.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="code">
              Código interno (opcional)
            </label>
            <input
              id="code"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-400"
              placeholder="Próximamente"
              disabled
            />
            <p className="text-xs text-zinc-500">
              Útil para integraciones o reporting.
            </p>
          </div>

          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Creando…' : 'Crear local'}
            </button>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              href={`/superadmin/organizations/${orgId}`}
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
