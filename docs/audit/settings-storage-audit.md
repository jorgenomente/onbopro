# Auditoria — Settings storage (quiz prompt)

## Contexto

Se necesita persistir un prompt maestro editable (ONBO-QUIZ v1). Antes de crear tablas nuevas, se audito el repo para detectar settings/preferencias existentes (org/user/app) y convenciones.

## Hallazgos (evidencia)

### 1) No hay tabla de settings/preferencias en migraciones

- No aparecen tablas o columnas `settings`, `preferences`, `config` en `supabase/migrations/**`.
- Definicion de core tenancy sin campos de settings:
  - `supabase/migrations/20260104190000_core_tenancy.sql` (tablas `profiles`, `organizations`, `locals` sin columnas jsonb/setting).

### 2) No hay columnas jsonb de settings en `profiles` u `organizations`

- `profiles` solo tiene `user_id`, `email`, `full_name`, `is_superadmin`, `created_at`.
- `organizations` solo tiene `id`, `name`, `created_by_user_id`, `archived_at`, `created_at`.
- Evidencia: `supabase/migrations/20260104190000_core_tenancy.sql`.

### 3) No hay RPCs de settings

- No existen RPCs tipo `rpc_update_*_settings` o `rpc_get_*_settings` en `supabase/migrations/**`.
- Evidencia por ausencia en `supabase/migrations/**` y por contraste con RPCs existentes (ej: `supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql`).

### 4) Prompt actual esta hardcodeado en frontend

- Fuente del prompt: `lib/quiz/onboQuizPrompt.ts`.
- Se usa en el editor de quiz org admin (copy to clipboard):
  - `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.

### 5) Documentacion sugiere que settings de org no existen aun

- `docs/roles/org-admin-scope.md` indica que no hay settings de organizacion (seccion 4.1 y 5).
- `docs/audit/admin-scope-audit.md` menciona ausencia de UI `/org/settings`.

### 6) Contrato de pantalla actual del quiz editor

- La pantalla `/org/courses/[courseId]/quizzes/[quizId]/edit` lee `public.v_org_quiz_detail`.
- Evidencia: `docs/screens/org-quiz-editor.md` y `app/org/courses/[courseId]/quizzes/[quizId]/edit/page.tsx`.

## Recomendacion

No existe storage de settings en el repo. Si el prompt debe ser editable y persistido, el enfoque mas consistente es **crear un storage a nivel organizacion** (settings de org) y **exponerlo via una vista** que alimente la pantalla del quiz editor.

Motivo principal:

- El prompt es compartido entre quizzes de una org (no es del quiz en si), y las reglas de UI indican que una pantalla debe leer de una sola vista. Por lo tanto, la vista del quiz editor deberia exponer el prompt de org.

## Opciones

### Opcion A — Settings por organizacion (recomendada)

**Pros**

- Alinea el prompt con el scope natural (org).
- Facilita consistencia entre quizzes de la misma org.
- RLS y permisos se mantienen en scope ORG.

**Contras**

- Requiere nuevo storage (tabla o columna) y nuevos contratos (vista + RPC).

### Opcion B — Settings por usuario

**Pros**

- Facilita prompts personalizados por admin.

**Contras**

- Inconsistencia entre admins de la misma org.
- Mas complejo de explicar y gobernar (scope OWN para edicion, ORG para lectura?).
- No hay columna `profiles.settings` hoy.

## Si no existe nada adecuado (propuesta minima)

Crear una tabla `org_settings` (o equivalente) con:

- `org_id uuid primary key references organizations(id)`
- `quiz_prompt text not null`
- `updated_at timestamptz not null default now()`
- `updated_by uuid references auth.users(id)`

Notas de alineacion (para proximo prompt, no implementar ahora):

- RLS habilitado + helper SECURITY DEFINER para permisos org_admin/superadmin.
- Sin DELETE policy (usar soft patterns si se necesita).
- Indices para predicates de RLS (por `org_id`).
- View dedicada para la pantalla del quiz editor o extension de `v_org_quiz_detail` que incluya el prompt.

## Checklist de implementacion (para siguiente prompt)

- Definir storage target (A/B) y actualizar docs si se crea nuevo esquema.
- Crear migration de schema (tabla/columna) siguiendo `docs/migrations-playbook.md`.
- Crear migration de RLS (policies + helper SECURITY DEFINER).
- Crear migration de view para la pantalla del quiz editor (1 screen = 1 view).
- Crear RPC de update (org_admin/superadmin) con validaciones y audit fields.
- Actualizar UI para leer prompt desde la vista y guardar via RPC.
- Agregar entrada en `docs/ops-log.md`.

## Docs consultados

- `docs/schema-guide.md`
- `docs/rls-cheatsheet.md`
- `docs/integrity-rules.md`
- `docs/onboarding-provisioning.md`
- `docs/query-patterns.md`
- `docs/migrations-playbook.md`
- `docs/screens/org-quiz-editor.md`
- `docs/roles/org-admin-scope.md`
- `docs/audit/admin-scope-audit.md`
