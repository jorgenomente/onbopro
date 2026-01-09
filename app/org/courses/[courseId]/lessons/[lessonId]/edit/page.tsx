'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LessonType = 'text' | 'html' | 'richtext' | 'video' | 'file' | 'link';

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

function typeLabel(type: LessonType) {
  if (type === 'text') return 'Texto';
  if (type === 'html') return 'HTML';
  if (type === 'richtext') return 'Rich text';
  if (type === 'video') return 'Video';
  if (type === 'file') return 'Archivo';
  return 'Enlace';
}

const BLOCK_TYPES = [
  { value: 'heading', label: 'Título', description: 'Sección o heading.' },
  { value: 'text', label: 'Texto', description: 'Párrafo estándar.' },
  { value: 'link', label: 'Link', description: 'URL + etiqueta.' },
  { value: 'embed', label: 'Embed', description: 'URL embebida.' },
  { value: 'divider', label: 'Divisor', description: 'Separador visual.' },
] as const;

type BlockDraft = {
  text?: string;
  url?: string;
  label?: string;
};

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LessonDetailRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [blockError, setBlockError] = useState('');
  const [blockSuccess, setBlockSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [blockDrafts, setBlockDrafts] = useState<Record<string, BlockDraft>>(
    {},
  );

  const applyRowToForm = (data: LessonDetailRow) => {
    setTitle(data.lesson_title ?? '');
    setIsRequired(data.is_required ?? true);
    setEstimatedMinutes(
      data.estimated_minutes != null ? String(data.estimated_minutes) : '',
    );
    setSaveSuccess('');
    setSaveError('');
    setBlockError('');
    setBlockSuccess('');

    const nextDrafts: Record<string, BlockDraft> = {};
    (data.blocks ?? []).forEach((block) => {
      if (block.block_type === 'heading' || block.block_type === 'text') {
        nextDrafts[block.block_id] = {
          text: String(block.data?.text ?? ''),
        };
        return;
      }
      if (block.block_type === 'link') {
        nextDrafts[block.block_id] = {
          url: String(block.data?.url ?? ''),
          label: String(block.data?.label ?? ''),
        };
        return;
      }
      if (block.block_type === 'embed') {
        nextDrafts[block.block_id] = {
          url: String(block.data?.url ?? ''),
        };
      }
    });
    setBlockDrafts(nextDrafts);
  };

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
  }, [lessonId, viewName]);

  const blocks = useMemo(() => row?.blocks ?? [], [row]);
  const hasLegacyContent =
    !!row?.content_text || !!row?.content_html || !!row?.content_url;

  const canSave = !!row && !loading && !isSaving;

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

  const handleCreateBlock = async (blockType: string) => {
    if (!lessonId || !canSave) return;
    setIsSaving(true);
    setBlockError('');
    setBlockSuccess('');

    let data: Record<string, unknown> = {};
    if (blockType === 'heading' || blockType === 'text') {
      data = { text: '' };
    } else if (blockType === 'link') {
      data = { url: '', label: '' };
    } else if (blockType === 'embed') {
      data = { url: '' };
    }

    const { error: rpcError } = await supabase.rpc(blockRpc.createBlock, {
      p_lesson_id: lessonId,
      p_block_type: blockType,
      p_data: data,
    });

    if (rpcError) {
      setBlockError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setBlockSuccess('Bloque agregado.');
  };

  const handleUpdateBlock = async (blockId: string) => {
    if (!canSave) return;
    setIsSaving(true);
    setBlockError('');
    setBlockSuccess('');

    const draft = blockDrafts[blockId] ?? {};
    const { error: rpcError } = await supabase.rpc(blockRpc.updateBlock, {
      p_block_id: blockId,
      p_data: draft,
    });

    if (rpcError) {
      setBlockError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setBlockSuccess('Bloque guardado.');
  };

  const handleArchiveBlock = async (blockId: string) => {
    if (!canSave) return;
    setIsSaving(true);
    setBlockError('');
    setBlockSuccess('');

    const { error: rpcError } = await supabase.rpc(blockRpc.archiveBlock, {
      p_block_id: blockId,
    });

    if (rpcError) {
      setBlockError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setBlockSuccess('Bloque archivado.');
  };

  const handleReorderBlocks = async (
    blockId: string,
    direction: 'up' | 'down',
  ) => {
    if (!canSave) return;
    const index = blocks.findIndex((block) => block.block_id === blockId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;

    const order = blocks.map((block) => block.block_id);
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];

    setIsSaving(true);
    setBlockError('');
    setBlockSuccess('');

    const { error: rpcError } = await supabase.rpc(blockRpc.reorderBlocks, {
      p_lesson_id: lessonId,
      p_block_ids: next,
    });

    if (rpcError) {
      setBlockError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchLesson();
    setIsSaving(false);
    setBlockSuccess('Orden actualizado.');
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
          <Link className="hover:text-zinc-900" href={basePath}>
            Cursos
          </Link>
          <span>·</span>
          {courseId ? (
            <Link
              className="hover:text-zinc-900"
              href={`${basePath}/${courseId}/outline`}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900">Bloques</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {BLOCK_TYPES.map((block) => (
                    <button
                      key={block.value}
                      className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                      type="button"
                      disabled={!canSave}
                      onClick={() => void handleCreateBlock(block.value)}
                    >
                      + {block.label}
                    </button>
                  ))}
                </div>
              </div>

              {blockSuccess && (
                <p className="mt-3 text-xs text-emerald-600">{blockSuccess}</p>
              )}
              {blockError && (
                <p className="mt-3 text-xs text-red-600">{blockError}</p>
              )}

              <div className="mt-4 space-y-4">
                {blocks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                    Todavía no hay bloques en esta lección.
                  </div>
                )}

                {blocks.map((block, index) => {
                  const draft = blockDrafts[block.block_id] ?? {};
                  return (
                    <div
                      key={block.block_id}
                      className="rounded-xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-800">
                          {block.block_type}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <button
                            className="rounded-full border border-zinc-200 px-2 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                            type="button"
                            disabled={!canSave || index === 0}
                            onClick={() =>
                              void handleReorderBlocks(block.block_id, 'up')
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="rounded-full border border-zinc-200 px-2 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                            type="button"
                            disabled={!canSave || index === blocks.length - 1}
                            onClick={() =>
                              void handleReorderBlocks(block.block_id, 'down')
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="rounded-full border border-zinc-200 px-2 py-1 font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                            type="button"
                            disabled={!canSave}
                            onClick={() =>
                              void handleArchiveBlock(block.block_id)
                            }
                          >
                            Archivar
                          </button>
                        </div>
                      </div>

                      {(block.block_type === 'heading' ||
                        block.block_type === 'text') && (
                        <textarea
                          className="mt-3 min-h-[120px] w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                          value={draft.text ?? ''}
                          onChange={(event) =>
                            setBlockDrafts((prev) => ({
                              ...prev,
                              [block.block_id]: {
                                ...prev[block.block_id],
                                text: event.target.value,
                              },
                            }))
                          }
                          placeholder="Escribí el contenido..."
                        />
                      )}

                      {block.block_type === 'link' && (
                        <div className="mt-3 space-y-3">
                          <input
                            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                            value={draft.label ?? ''}
                            onChange={(event) =>
                              setBlockDrafts((prev) => ({
                                ...prev,
                                [block.block_id]: {
                                  ...prev[block.block_id],
                                  label: event.target.value,
                                },
                              }))
                            }
                            placeholder="Etiqueta del link"
                          />
                          <input
                            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                            value={draft.url ?? ''}
                            onChange={(event) =>
                              setBlockDrafts((prev) => ({
                                ...prev,
                                [block.block_id]: {
                                  ...prev[block.block_id],
                                  url: event.target.value,
                                },
                              }))
                            }
                            placeholder="https://"
                          />
                        </div>
                      )}

                      {block.block_type === 'embed' && (
                        <input
                          className="mt-3 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                          value={draft.url ?? ''}
                          onChange={(event) =>
                            setBlockDrafts((prev) => ({
                              ...prev,
                              [block.block_id]: {
                                ...prev[block.block_id],
                                url: event.target.value,
                              },
                            }))
                          }
                          placeholder="URL embebida"
                        />
                      )}

                      {block.block_type === 'divider' && (
                        <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                          Divisor visual.
                        </div>
                      )}

                      <div className="mt-3 flex justify-end">
                        <button
                          className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                          type="button"
                          disabled={!canSave}
                          onClick={() => void handleUpdateBlock(block.block_id)}
                        >
                          Guardar bloque
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
