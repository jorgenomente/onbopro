'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';
import { OrgCourseOutlineScreen } from '@/app/org/courses/[courseId]/outline/page';
import { supabase } from '@/lib/supabase/client';

const TEMPLATE_OUTLINE_RPC = {
  createUnit: 'rpc_create_template_unit',
  reorderUnits: 'rpc_reorder_template_units',
  createLesson: 'rpc_create_template_unit_lesson',
  reorderLessons: 'rpc_reorder_template_unit_lessons',
  createUnitQuiz: 'rpc_create_template_unit_quiz',
  createFinalQuiz: 'rpc_create_template_final_quiz',
  courseParamKey: 'p_template_id',
  defaultLessonType: 'richtext',
  allowedLessonTypes: ['text', 'html', 'richtext', 'video', 'file', 'link'],
} as const;

export default function SuperadminTemplateOutlinePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params?.templateId as string;
  const [copyOpen, setCopyOpen] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copying, setCopying] = useState(false);

  if (!templateId) {
    return (
      <SuperadminGuard>
        <div className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Template no encontrado.
          </div>
        </div>
      </SuperadminGuard>
    );
  }

  const basePath = '/superadmin/course-library';

  const handleCopy = async () => {
    if (!selectedOrgId) {
      setCopyError('Seleccioná una organización.');
      return;
    }
    setCopying(true);
    setCopyError('');

    const { data, error } = await supabase.rpc('rpc_copy_template_to_org', {
      p_template_id: templateId,
      p_org_id: selectedOrgId,
    });

    if (error) {
      setCopyError(error.message);
      setCopying(false);
      return;
    }

    setCopying(false);
    setCopyOpen(false);
    if (data) {
      router.push(
        `/superadmin/organizations/${selectedOrgId}/courses/${data}/outline`,
      );
    }
  };

  return (
    <SuperadminGuard>
      <OrgCourseOutlineScreen
        courseId={templateId}
        basePath={basePath}
        outlineView="v_superadmin_course_template_outline"
        rpcConfig={TEMPLATE_OUTLINE_RPC}
        showPreview={false}
        extraActions={(row) => {
          const organizations = row?.organizations ?? [];
          const normalizedQuery = orgQuery.trim().toLowerCase();
          const filteredOrgs = normalizedQuery
            ? organizations.filter((org) => {
                const nameMatch = org.name
                  .toLowerCase()
                  .includes(normalizedQuery);
                const emailMatch = (org.admin_email ?? '')
                  .toLowerCase()
                  .includes(normalizedQuery);
                return nameMatch || emailMatch;
              })
            : organizations;
          const isLoading = !row;

          return (
            <>
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                type="button"
                onClick={() => {
                  setCopyOpen(true);
                  setCopyError('');
                  setOrgQuery('');
                  setSelectedOrgId(null);
                }}
              >
                Copiar a organización
              </button>

              {copyOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
                    <h2 className="text-lg font-semibold text-zinc-900">
                      Copiar a organización
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      Elegí la organización destino para crear un curso nuevo
                      basado en este template.
                    </p>

                    <div className="mt-4 space-y-2">
                      <label className="text-xs font-semibold text-zinc-600">
                        Buscar organización
                      </label>
                      <input
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                        value={orgQuery}
                        onChange={(event) => setOrgQuery(event.target.value)}
                        placeholder="Buscar organización..."
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      {isLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <div
                              key={`org-skeleton-${index}`}
                              className="h-14 animate-pulse rounded-xl bg-zinc-100"
                            />
                          ))}
                        </div>
                      ) : filteredOrgs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                          No hay organizaciones disponibles.
                        </div>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {filteredOrgs.map((org) => {
                            const isSelected = selectedOrgId === org.org_id;
                            return (
                              <button
                                key={org.org_id}
                                type="button"
                                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                                  isSelected
                                    ? 'border-zinc-900 bg-zinc-900/5 text-zinc-900'
                                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                                }`}
                                onClick={() => {
                                  setSelectedOrgId(org.org_id);
                                  setCopyError('');
                                }}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold">{org.name}</p>
                                    <p className="text-xs text-zinc-500">
                                      {org.admin_email ?? 'Sin admin asignado'}
                                    </p>
                                  </div>
                                  {org.status === 'archived' ? (
                                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500">
                                      Archivada
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {copyError ? (
                        <p className="text-sm text-red-600">{copyError}</p>
                      ) : null}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                      <button
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        type="button"
                        onClick={() => setCopyOpen(false)}
                        disabled={copying}
                      >
                        Cancelar
                      </button>
                      <button
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                        type="button"
                        onClick={handleCopy}
                        disabled={copying || !selectedOrgId || isLoading}
                      >
                        {copying ? 'Copiando...' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          );
        }}
      />
    </SuperadminGuard>
  );
}
