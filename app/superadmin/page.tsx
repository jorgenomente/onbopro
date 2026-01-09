'use client';

import Link from 'next/link';
import SuperadminGuard from '@/app/superadmin/_components/SuperadminGuard';

export default function SuperadminHomePage() {
  return (
    <SuperadminGuard>
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-zinc-900">
              Panel Superadmin
            </h1>
            <p className="text-sm text-zinc-500">
              Accesos principales para gestionar organizaciones y templates.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/superadmin/organizations"
              className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:border-zinc-200 hover:bg-zinc-50"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                Organizaciones
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Crear y administrar organizaciones, locales y miembros.
              </p>
              <span className="mt-4 inline-flex text-xs font-semibold text-indigo-600">
                Ir a organizaciones →
              </span>
            </Link>

            <Link
              href="/superadmin/course-library"
              className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:border-zinc-200 hover:bg-zinc-50"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                Librería de cursos
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Crear templates globales y copiarlos a organizaciones.
              </p>
              <span className="mt-4 inline-flex text-xs font-semibold text-indigo-600">
                Ir a librería →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </SuperadminGuard>
  );
}
