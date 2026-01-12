'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type CourseMetadataRow = {
  org_id: string;
  course_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function OrgCourseEditPage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  if (!courseId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Curso no encontrado.
          </div>
        </div>
      </div>
    );
  }

  return <OrgCourseEditScreen courseId={courseId} basePath="/org/courses" />;
}

type CourseEditScreenProps = {
  courseId: string;
  basePath: string;
  metadataView?: string;
  updateRpc?: string;
};

export function OrgCourseEditScreen({
  courseId,
  basePath,
  metadataView,
  updateRpc,
}: CourseEditScreenProps) {
  const router = useRouter();
  const viewName = metadataView ?? 'v_org_course_metadata';
  const rpcName = updateRpc ?? 'rpc_update_course_metadata';
  const isTemplate = basePath.startsWith('/superadmin/course-library');
  const backLabel = isTemplate ? 'Volver al template' : 'Volver al outline';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [row, setRow] = useState<CourseMetadataRow | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    'draft',
  );
  const [success, setSuccess] = useState('');

  const refetch = async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from(viewName)
      .select('*')
      .eq('course_id', courseId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    const nextRow = (data as CourseMetadataRow) ?? null;
    setRow(nextRow);
    setTitle(nextRow?.title ?? '');
    setDescription(nextRow?.description ?? '');
    setStatus(nextRow?.status ?? 'draft');
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!courseId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from(viewName)
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      const nextRow = (data as CourseMetadataRow) ?? null;
      setRow(nextRow);
      setTitle(nextRow?.title ?? '');
      setDescription(nextRow?.description ?? '');
      setStatus(nextRow?.status ?? 'draft');
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [courseId, viewName]);

  const handleSave = async () => {
    if (!courseId) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('El titulo es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const { error: rpcError } = await supabase.rpc(rpcName, {
      p_course_id: courseId,
      p_title: trimmedTitle,
      p_description: description.trim() || null,
      p_status: status,
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess('Cambios guardados.');
    await refetch();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Link
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            href={`${basePath}/${courseId}/outline`}
          >
            ← {backLabel}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900">
              Editar curso (metadata)
            </h1>
            {isTemplate ? (
              <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                TEMPLATE GLOBAL
              </span>
            ) : null}
          </div>
        </header>

        {loading && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 h-24 animate-pulse rounded bg-zinc-100" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              type="button"
              onClick={refetch}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenés acceso a este curso o no existe.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="space-y-2 text-xs text-zinc-500">
              <span>Actualizado: {formatDate(row.updated_at)}</span>
              <span className="ml-3">
                Publicado: {formatDate(row.published_at)}
              </span>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">
                Titulo
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-3">
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
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700">
                Estado
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CourseMetadataRow['status'])
                }
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            {success ? (
              <p className="text-sm text-emerald-600">{success}</p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex items-center gap-3">
              <button
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                type="button"
                onClick={() => router.push(`${basePath}/${courseId}/outline`)}
              >
                Volver al outline
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
