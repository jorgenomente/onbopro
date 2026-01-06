'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function SuperadminCreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc(
      'rpc_create_organization',
      {
        p_name: trimmedName,
        p_description: description.trim() || null,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    if (data) {
      router.push(`/superadmin/organizations/${data}`);
      return;
    }

    setSaving(false);
    setError('No se pudo crear la organización.');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">
          Superadmin
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Crear organización
        </h1>
        <p className="text-sm text-zinc-500">
          La descripción estará disponible próximamente.
        </p>
      </header>

      <form
        className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Corp"
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-zinc-700"
            htmlFor="description"
          >
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Próximamente"
            rows={3}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Creando…' : 'Crear organización'}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
            href="/superadmin/organizations"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
