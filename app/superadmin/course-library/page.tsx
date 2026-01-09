'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';

type TemplateRow = {
  template_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
};

export default function SuperadminCourseLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_superadmin_course_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setTemplates([]);
        setLoading(false);
        return;
      }

      setTemplates((data as TemplateRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SuperadminGuard>
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">
                Librería global de cursos
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Templates reutilizables para copiar a organizaciones.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
              href="/superadmin/course-library/new"
            >
              Nuevo template
            </Link>
          </header>

          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`template-skeleton-${index}`}
                  className="h-20 animate-pulse rounded-2xl bg-white shadow-sm"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-white p-6 text-sm text-red-600 shadow-sm">
              Error: {error}
            </div>
          )}

          {!loading && !error && templates.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Todavía no hay templates creados.
            </div>
          )}

          {!loading && !error && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((template) => (
                <Link
                  key={template.template_id}
                  href={`/superadmin/course-library/${template.template_id}/outline`}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm transition hover:border-zinc-200 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {template.title}
                    </p>
                    {template.description ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-600">
                      {template.status}
                    </span>
                    <span>
                      Actualizado:{' '}
                      {new Date(template.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperadminGuard>
  );
}
