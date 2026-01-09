'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

export default function OrgCourseNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('El titulo es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('rpc_create_course', {
      p_title: trimmedTitle,
      p_description: description.trim() || null,
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (!data) {
      setError('No se pudo crear el curso.');
      return;
    }

    router.push(`/org/courses/${data}/outline`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Link
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            href="/org/courses"
          >
            ← Volver a cursos
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">Crear curso</h1>
        </header>

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Opciones
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">
                Crear desde cero
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Configurá el curso manualmente.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 opacity-70">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-700">
                  Importar desde librería
                </p>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                  Próximamente
                </Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Disponible cuando existan templates globales.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Detalles del curso
          </p>
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-700">Titulo</label>
            <input
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
              placeholder="Ej: Seguridad en planta"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-700">
              Descripcion (opcional)
            </label>
            <textarea
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
              rows={4}
              placeholder="Resumen breve del curso"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Creando...' : 'Crear curso'}
          </button>
        </section>
      </div>
    </div>
  );
}
