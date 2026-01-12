'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { JSONContent } from '@tiptap/core';
import { RichLessonEditor } from '@/components/editor/RichLessonEditor';

type LessonType =
  | 'text'
  | 'html'
  | 'richtext'
  | 'video'
  | 'video_url'
  | 'file'
  | 'link';

type LessonBlock = {
  block_id: string;
  block_type: string;
  data: Record<string, unknown>;
  position: number;
};

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
  blocks: LessonBlock[] | null;
  is_required: boolean;
  estimated_minutes: number | null;
  position: number;
  updated_at: string;
};

const getRichtextDoc = (
  data: Record<string, unknown> | null | undefined,
): JSONContent | null => {
  if (!data) return null;
  const doc = data.doc;
  if (doc && typeof doc === 'object') {
    return doc as JSONContent;
  }
  if (typeof doc === 'string') {
    try {
      return JSON.parse(doc) as JSONContent;
    } catch {
      return null;
    }
  }
  return null;
};

function typeLabel(type: LessonType) {
  if (type === 'text') return 'Texto';
  if (type === 'html') return 'HTML';
  if (type === 'richtext') return 'Rich text';
  if (type === 'video' || type === 'video_url') return 'Video';
  if (type === 'file') return 'Archivo';
  return 'Enlace';
}

export default function OrgLessonEditorPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;

  if (!courseId || !lessonId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Lección no encontrada.
          </div>
        </div>
      </div>
    );
  }

  return (
    <OrgLessonEditorScreen
      courseId={courseId}
      lessonId={lessonId}
      basePath="/org/courses"
    />
  );
}

type LessonEditorScreenProps = {
  courseId: string;
  lessonId: string;
  basePath: string;
  detailView?: string;
  metadataRpc?: string;
  blockRpcConfig?: BlockRpcConfig;
};

type BlockRpcConfig = {
  createBlock: string;
  updateBlock: string;
  archiveBlock: string;
  reorderBlocks: string;
};

const DEFAULT_BLOCK_RPC: BlockRpcConfig = {
  createBlock: 'rpc_create_lesson_block',
  updateBlock: 'rpc_update_lesson_block',
  archiveBlock: 'rpc_archive_lesson_block',
  reorderBlocks: 'rpc_reorder_lesson_blocks',
};

export function OrgLessonEditorScreen({
  courseId,
  lessonId,
  basePath,
  detailView,
  metadataRpc,
  blockRpcConfig,
}: LessonEditorScreenProps) {
  const router = useRouter();
  const viewName = detailView ?? 'v_org_lesson_detail';
  const metadataRpcName = metadataRpc ?? 'rpc_update_lesson_metadata';
  const blockRpc = blockRpcConfig ?? DEFAULT_BLOCK_RPC;
  const isTemplate = basePath.startsWith('/superadmin/course-library');
  const contextLabel = isTemplate ? 'Template global' : 'Org Admin';
  const backLabel = isTemplate ? 'Volver al template' : 'Volver a estructura';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LessonDetailRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [richSaving, setRichSaving] = useState(false);
  const [richtextBlockIdState, setRichtextBlockIdState] = useState<
    string | null
  >(null);

  const [title, setTitle] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  const applyRowToForm = useCallback(
    (data: LessonDetailRow) => {
      setTitle(data.lesson_title ?? '');
      setIsRequired(data.is_required ?? true);
      setEstimatedMinutes(
        data.estimated_minutes != null ? String(data.estimated_minutes) : '',
      );
      setSaveSuccess('');
      setSaveError('');

      if (!richtextBlockIdState) {
        const richtext = (data.blocks ?? []).find(
          (block) => block.block_type === 'richtext' && block.block_id,
        );
        if (richtext?.block_id) {
          setRichtextBlockIdState(richtext.block_id);
        }
      }
    },
    [richtextBlockIdState],
  );

  const refetchLesson = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from(viewName)
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
        .from(viewName)
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
  }, [lessonId, viewName, applyRowToForm]);

  const blocks = useMemo(() => row?.blocks ?? [], [row]);
  const richtextBlock = useMemo(
    () => blocks.find((block) => block.block_type === 'richtext'),
    [blocks],
  );
  const richtextBlockId = richtextBlock?.block_id ?? richtextBlockIdState;
  const richtextDoc = useMemo(
    () => getRichtextDoc(richtextBlock?.data),
    [richtextBlock],
  );
  const hasLegacyContent =
    !!row?.content_text || !!row?.content_html || !!row?.content_url;
  const legacyNotice =
    !richtextBlock && hasLegacyContent
      ? 'Esta leccion usa contenido legacy. Al guardar, se convertira a formato nuevo.'
      : '';

  const canSave = !!row && !loading && !isSaving && !richSaving;

  const handleSaveMetadata = async () => {
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

    setIsSaving(true);
    const { error: rpcError } = await supabase.rpc(metadataRpcName, {
      p_lesson_id: lessonId,
      p_title: trimmedTitle,
      p_is_required: isRequired,
      p_estimated_minutes: parsedMinutes,
    });

    if (rpcError) {
      setSaveError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setSaveSuccess('Cambios guardados.');
  };

  const handleSaveRichtext = async (doc: JSONContent) => {
    if (!lessonId || !row) return 'Leccion no encontrada.';
    setRichSaving(true);

    const payload = {
      doc,
      version: 1,
    };

    const { data: rpcData, error: rpcError } = richtextBlockId
      ? await supabase.rpc(blockRpc.updateBlock, {
          p_block_id: richtextBlockId,
          p_data: payload,
        })
      : await supabase.rpc(blockRpc.createBlock, {
          p_lesson_id: lessonId,
          p_block_type: 'richtext',
          p_data: payload,
        });

    if (rpcError) {
      setRichSaving(false);
      return rpcError.message;
    }

    if (!richtextBlockId && rpcData) {
      setRichtextBlockIdState(String(rpcData));
    }
    setRichSaving(false);
    return null;
  };

  const headerSubtitle = useMemo(() => {
    if (!row) return '';
    return `${typeLabel(row.lesson_type)} • Unidad ${row.position}`;
  }, [row]);

  const handleBack = () => {
    if (courseId) {
      router.push(`${basePath}/${courseId}/outline`);
      return;
    }
    router.back();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.2em] text-zinc-400 uppercase">
              <span>{contextLabel}</span>
              {isTemplate ? (
                <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                  TEMPLATE GLOBAL
                </span>
              ) : null}
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
            {backLabel}
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Link className="hover:text-zinc-900" href={basePath}>
            {isTemplate ? 'Templates' : 'Cursos'}
          </Link>
          <span>·</span>
          {courseId ? (
            <Link
              className="hover:text-zinc-900"
              href={`${basePath}/${courseId}/outline`}
            >
              {isTemplate ? 'Template' : 'Outline'}
            </Link>
          ) : (
            <span>{isTemplate ? 'Template' : 'Outline'}</span>
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
              <RichLessonEditor
                initialDoc={richtextDoc}
                onSave={handleSaveRichtext}
                disabled={!row || loading || richSaving}
                legacyNotice={legacyNotice}
              />
            </div>

            {hasLegacyContent && blocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                <h3 className="text-sm font-semibold">
                  Contenido legado (solo lectura)
                </h3>
                <p className="mt-2 text-xs text-amber-800">
                  Esta lección usa el formato anterior. Próximamente podrás
                  migrarla a bloques.
                </p>
                <div className="mt-4 space-y-2 text-xs text-amber-900">
                  {row.content_text && <p>{row.content_text}</p>}
                  {row.content_html && (
                    <p className="whitespace-pre-wrap">{row.content_html}</p>
                  )}
                  {row.content_url && (
                    <p className="break-all">{row.content_url}</p>
                  )}
                </div>
                <button
                  className="mt-4 rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-800"
                  type="button"
                  disabled
                >
                  Migrar a bloques (próximamente)
                </button>
              </div>
            )}

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
                onClick={handleSaveMetadata}
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
