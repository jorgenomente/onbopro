'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';

type OrgCourseRow = {
  org_id: string;
  course_id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
  published_at: string | null;
  units_count: number;
  lessons_count: number;
};

type OrgDetail = {
  org_id: string;
  name: string;
};

export default function SuperadminOrgCoursesPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<OrgCourseRow[]>([]);
  const [org, setOrg] = useState<OrgDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!orgId) return;
      setLoading(true);
      setError('');

      const { data: orgData } = await supabase
        .from('v_superadmin_organization_detail')
        .select('org_id,name')
        .eq('org_id', orgId)
        .maybeSingle<OrgDetail>();

      if (cancelled) return;
      setOrg(orgData ?? null);

      const { data, error: fetchError } = await supabase
        .from('v_org_courses')
        .select('*')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses((data as OrgCourseRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <SuperadminGuard>
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                className="text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
                href={`/superadmin/organizations/${orgId}`}
              >
                Volver a organización
              </Link>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                Cursos {org?.name ? `· ${org.name}` : ''}
              </h1>
            </div>
          </header>

          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`course-skeleton-${index}`}
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

          {!loading && !error && courses.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
              No hay cursos registrados para esta organización.
            </div>
          )}

          {!loading && !error && courses.length > 0 && (
            <div className="space-y-3">
              {courses.map((course) => (
                <Link
                  key={course.course_id}
                  href={`/superadmin/organizations/${orgId}/courses/${course.course_id}/outline`}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm transition hover:border-zinc-200 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {course.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {course.units_count} unidades · {course.lessons_count}{' '}
                      lecciones
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-600">
                      {course.status}
                    </span>
                    <span>
                      Actualizado:{' '}
                      {new Date(course.updated_at).toLocaleDateString()}
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
