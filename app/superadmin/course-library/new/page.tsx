'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';

export default function SuperadminCourseLibraryNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('El titulo es obligatorio.');
      return;
    }
    setSaving(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc(
      'rpc_create_template',
      {
        p_title: trimmedTitle,
        p_description: description.trim() || null,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    if (data) {
      router.push(`/superadmin/course-library/${data}/outline`);
    }
  };

  return (
    <SuperadminGuard>
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-2">
            <Link
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
              href="/superadmin/course-library"
            >
              ← Volver a librería
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900">
                Crear template global
              </h1>
              <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                TEMPLATE GLOBAL
              </span>
            </div>
          </header>

          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Titulo
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Template de seguridad industrial"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Descripcion
              </label>
              <textarea
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex items-center gap-3">
              <button
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                type="button"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? 'Creando...' : 'Crear template'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </SuperadminGuard>
  );
}
