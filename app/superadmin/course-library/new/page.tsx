'use client';

import { UnderConstruction } from '@/components/UnderConstruction';

export default function SuperadminCourseLibraryNewPage() {
  return (
    <UnderConstruction
      title="Crear template global"
      description="Pantalla reservada para crear cursos base reutilizables."
      missing={[
        { label: 'RPC de creación de template global' },
        { label: 'Validaciones y versionado' },
        { label: 'UI de carga de contenido' },
      ]}
    />
  );
}
