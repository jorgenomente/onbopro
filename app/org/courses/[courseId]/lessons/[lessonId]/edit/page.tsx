'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LessonType = 'text' | 'html' | 'richtext' | 'video' | 'file' | 'link';

type LessonDetailRow = {
  org_id: string;
  course_id: string;
  unit_id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_type: LessonType;
  content_text: string | null;
  content_html: string | null;
  content_url: string | null;
  is_required: boolean;
  estimated_minutes: number | null;
  position: number;
  updated_at: string;
};

function typeLabel(type: LessonType) {
  if (type === 'text') return 'Texto';
  if (type === 'html') return 'HTML';
  if (type === 'richtext') return 'Rich text';
  if (type === 'video') return 'Video';
  if (type === 'file') return 'Archivo';
  return 'Enlace';
}

export default function OrgLessonEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LessonDetailRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentUrl, setContentUrl] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  const applyRowToForm = (data: LessonDetailRow) => {
    setTitle(data.lesson_title ?? '');
    setContentText(data.content_text ?? '');
    setContentHtml(data.content_html ?? '');
    setContentUrl(data.content_url ?? '');
    setIsRequired(data.is_required ?? true);
    setEstimatedMinutes(
      data.estimated_minutes != null ? String(data.estimated_minutes) : '',
    );
    setSaveSuccess('');
    setSaveError('');
  };

  const refetchLesson = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_lesson_detail')
      .select('*')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    const nextRow = (data as LessonDetailRow) ?? null;
    setRow(nextRow);
    if (nextRow) {
      applyRowToForm(nextRow);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!lessonId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_lesson_detail')
        .select('*')
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      const nextRow = (data as LessonDetailRow) ?? null;
      setRow(nextRow);
      if (nextRow) {
        applyRowToForm(nextRow);
      }
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const lessonType = row?.lesson_type;
  const canSave = !!row && !loading && !isSaving;

  const handleSave = async () => {
    if (!row || !lessonId) return;
    setSaveError('');
    setSaveSuccess('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSaveError('El titulo es obligatorio.');
      return;
    }

    const parsedMinutes = estimatedMinutes.trim()
      ? Number(estimatedMinutes)
      : null;
    if (parsedMinutes != null && Number.isNaN(parsedMinutes)) {
      setSaveError('La duracion estimada debe ser un numero.');
      return;
    }
    if (parsedMinutes != null && parsedMinutes < 0) {
      setSaveError('La duracion estimada no puede ser negativa.');
      return;
    }

    if (lessonType === 'text' && !contentText.trim()) {
      setSaveError('El contenido de texto es obligatorio.');
      return;
    }
    if (
      (lessonType === 'html' || lessonType === 'richtext') &&
      !contentHtml.trim()
    ) {
      setSaveError('El contenido richtext es obligatorio.');
      return;
    }
    if (
      (lessonType === 'video' ||
        lessonType === 'file' ||
        lessonType === 'link') &&
      !contentUrl.trim()
    ) {
      setSaveError('La URL del contenido es obligatoria.');
      return;
    }

    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc(
      'rpc_update_lesson_content',
      {
        p_lesson_id: lessonId,
        p_title: trimmedTitle,
        p_content_text: contentText.trim() || null,
        p_content_html: contentHtml.trim() || null,
        p_content_url: contentUrl.trim() || null,
        p_is_required: isRequired,
        p_estimated_minutes: parsedMinutes,
      },
    );

    if (rpcError) {
      setSaveError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setSaveSuccess('Cambios guardados.');
  };

  const headerSubtitle = useMemo(() => {
    if (!row) return '';
    return `${typeLabel(row.lesson_type)} • Unidad ${row.position}`;
  }, [row]);

  const handleBack = () => {
    if (courseId) {
      router.push(`/org/courses/${courseId}/outline`);
      return;
    }
    router.back();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
              Org Admin
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Editar leccion
            </h1>
            {row && (
              <p className="text-sm text-zinc-500">
                {row.lesson_title} • {headerSubtitle}
              </p>
            )}
          </div>
          <button
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm"
            onClick={handleBack}
            type="button"
          >
            Volver a estructura
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Link className="hover:text-zinc-900" href="/org/courses">
            Cursos
          </Link>
          <span>·</span>
          {courseId ? (
            <Link
              className="hover:text-zinc-900"
              href={`/org/courses/${courseId}/outline`}
            >
              Outline
            </Link>
          ) : (
            <span>Outline</span>
          )}
          <span>·</span>
          <span>Editar leccion</span>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="h-6 w-1/2 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
            <div className="h-56 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            No tenes acceso a esta leccion o no existe.
          </div>
        )}

        {!loading && !error && row && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-700 uppercase">
                {typeLabel(row.lesson_type)}
              </span>
              {isSaving && (
                <span className="text-xs text-zinc-500">Guardando…</span>
              )}
              {saveSuccess && (
                <span className="text-xs text-emerald-600">{saveSuccess}</span>
              )}
              {saveError && (
                <span className="text-xs text-red-600">{saveError}</span>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Metadatos</h2>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Titulo
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Duracion estimada (min)
                    </label>
                    <input
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      type="number"
                      min="0"
                      value={estimatedMinutes}
                      onChange={(event) =>
                        setEstimatedMinutes(event.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                      type="checkbox"
                      checked={isRequired}
                      onChange={(event) => setIsRequired(event.target.checked)}
                    />
                    <span className="text-sm text-zinc-700">
                      Leccion obligatoria
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Contenido</h2>
              <div className="mt-4 space-y-4">
                {lessonType === 'text' && (
                  <textarea
                    className="min-h-[160px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                    value={contentText}
                    onChange={(event) => setContentText(event.target.value)}
                  />
                )}

                {(lessonType === 'html' || lessonType === 'richtext') && (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-[180px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      value={contentHtml}
                      onChange={(event) => setContentHtml(event.target.value)}
                    />
                    <p className="text-xs text-zinc-500">
                      El contenido richtext se guarda como HTML.
                    </p>
                  </div>
                )}

                {(lessonType === 'video' ||
                  lessonType === 'file' ||
                  lessonType === 'link') && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      URL
                    </label>
                    <input
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                      value={contentUrl}
                      onChange={(event) => setContentUrl(event.target.value)}
                      placeholder="https://"
                    />
                    <p className="text-xs text-zinc-500">
                      Usa un link directo al recurso (video, archivo o enlace).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
                onClick={handleBack}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleSave}
                type="button"
                disabled={!canSave}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
