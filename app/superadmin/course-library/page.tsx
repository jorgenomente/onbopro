'use client';

import { UnderConstruction } from '@/components/UnderConstruction';

export default function SuperadminCourseLibraryPage() {
  return (
    <UnderConstruction
      title="Librería global de cursos"
      description="Esta sección mostrará templates globales listos para copiar a organizaciones."
      missing={[
        { label: 'View/endpoint de templates globales' },
        { label: 'UI de catálogo y filtros' },
        { label: 'Acción “Copiar a org” con audit' },
      ]}
    />
  );
}
