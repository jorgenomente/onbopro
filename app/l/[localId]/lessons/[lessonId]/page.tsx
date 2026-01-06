'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/learner/Card';
import { InlineNotice } from '@/components/learner/InlineNotice';
import { LearnerShell } from '@/components/learner/LearnerShell';
import { StateBlock } from '@/components/learner/StateBlock';
import { formatStatusLabel } from '@/lib/learner/formatters';

type LessonRow = {
  local_id: string;
  course_id: string;
  course_title: string;
  course_image_url: string | null;
  unit_id: string;
  unit_title: string;
  unit_position: number;
  lesson_id: string;
  lesson_title: string;
  lesson_position: number;
  content_type: string;
  content: Record<string, unknown> | null;
  is_completed: boolean;
  completed_at: string | null;
  can_mark_complete: boolean;
  prev_lesson_id: string | null;
  next_lesson_id: string | null;
};

export default function LessonPlaceholderPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const lessonId = params?.lessonId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [markSuccess, setMarkSuccess] = useState('');

  const fetchLesson = async () => {
    if (!localId || !lessonId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_lesson_player')
      .select('*')
      .eq('local_id', localId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLesson(null);
      setLoading(false);
      return;
    }

    setLesson((data as LessonRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId || !lessonId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_lesson_player')
        .select('*')
        .eq('local_id', localId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLesson(null);
        setLoading(false);
        return;
      }

      setLesson((data as LessonRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [lessonId, localId]);

  const statusLabel = useMemo(() => {
    if (!lesson) return '';
    return formatStatusLabel(lesson.is_completed ? 'completed' : 'pending');
  }, [lesson]);

  const renderContent = () => {
    if (!lesson) return null;
    const content = lesson.content ?? {};

    if (lesson.content_type === 'video' && typeof content.url === 'string') {
      return (
        <video className="w-full rounded-2xl" controls>
          <source src={content.url} />
        </video>
      );
    }

    if (lesson.content_type === 'html' && typeof content.html === 'string') {
      return (
        <div
          className="prose max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      );
    }

    if (lesson.content_type === 'text' && typeof content.text === 'string') {
      return <p className="text-sm text-zinc-700">{content.text}</p>;
    }

    if (typeof content.url === 'string') {
      return (
        <a className="text-sm text-zinc-900 underline" href={content.url}>
          Abrir contenido
        </a>
      );
    }

    return (
      <pre className="rounded-2xl bg-zinc-100 p-4 text-xs text-zinc-600">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  const handleBack = () => {
    if (lesson?.course_id) {
      router.push(`/l/${localId}/courses/${lesson.course_id}`);
      return;
    }
    router.back();
  };

  const handlePrev = () => {
    if (!lesson?.prev_lesson_id) return;
    router.push(`/l/${localId}/lessons/${lesson.prev_lesson_id}`);
  };

  const handleNext = () => {
    if (!lesson?.next_lesson_id) return;
    router.push(`/l/${localId}/lessons/${lesson.next_lesson_id}`);
  };

  const handleMarkComplete = async () => {
    if (!lesson) return;
    setMarkError('');
    setMarkSuccess('');
    setMarking(true);

    const { error: rpcError } = await supabase.rpc(
      'rpc_mark_lesson_completed',
      {
        p_local_id: lesson.local_id,
        p_lesson_id: lesson.lesson_id,
      },
    );

    setMarking(false);

    if (rpcError) {
      setMarkError(rpcError.message);
      return;
    }

    setMarkSuccess('Lección marcada como completada.');
    await fetchLesson();
  };

  return (
    <LearnerShell maxWidthClass="max-w-3xl" paddedBottom>
      {loading && (
        <div className="space-y-4">
          <Card className="h-8 w-2/3 animate-pulse" />
          <Card className="h-48 animate-pulse" />
          <Card className="h-24 animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <StateBlock
          tone="error"
          title="No pudimos cargar la información."
          description={`Error: ${error}`}
          actions={
            <>
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                onClick={fetchLesson}
                type="button"
              >
                Reintentar
              </button>
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                onClick={() => router.back()}
                type="button"
              >
                Volver
              </button>
            </>
          }
        />
      )}

      {!loading && !error && !lesson && (
        <StateBlock
          tone="empty"
          title="No tenés acceso a esta lección."
          description="Puede que el contenido todavía no esté disponible."
          actions={
            <button
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={() => router.back()}
              type="button"
            >
              Volver
            </button>
          }
        />
      )}

      {!loading && !error && lesson && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  {lesson.course_title} · {lesson.unit_title}
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                  {lesson.lesson_title}
                </h1>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {statusLabel}
              </span>
            </div>
          </Card>

          <Card>{renderContent()}</Card>

          {marking ? (
            <InlineNotice tone="info">Guardando cambios…</InlineNotice>
          ) : null}
          {markError ? (
            <InlineNotice tone="error">{markError}</InlineNotice>
          ) : null}
          {markSuccess ? (
            <InlineNotice tone="success">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{markSuccess}</span>
                {lesson.next_lesson_id ? (
                  <button
                    className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                    type="button"
                    onClick={handleNext}
                  >
                    Ir a la siguiente
                  </button>
                ) : null}
              </div>
            </InlineNotice>
          ) : null}
        </div>
      )}

      {!loading && !error && lesson && (
        <div className="fixed right-0 bottom-0 left-0 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={handleBack}
              type="button"
            >
              Volver al curso
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                  onClick={handlePrev}
                  type="button"
                  disabled={!lesson.prev_lesson_id}
                >
                  Anterior
                </button>
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                  onClick={handleNext}
                  type="button"
                  disabled={!lesson.next_lesson_id}
                >
                  Siguiente
                </button>
              </div>
              <button
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                type="button"
                onClick={handleMarkComplete}
                disabled={!lesson.can_mark_complete || marking}
              >
                {marking ? 'Guardando…' : 'Marcar como completada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </LearnerShell>
  );
}
