# Auditoria — Gating por entorno (dev/staging/prod)

## Contexto

Se busca habilitar hard delete de preguntas de quiz solo en entornos de prueba (local/dev/staging) y bloquearlo en production. Esta auditoria identifica como detectar el entorno hoy en ONBO para UI (Next.js) y DB/RPC (Postgres/Supabase).

## Hallazgos (evidencia)

### UI (Next.js)

- Uso de `process.env.NODE_ENV !== 'production'` como gating de debug:
  - `components/editor/RichLessonEditor.tsx`
  - `components/learner/LessonBlocksRenderer.tsx`
  - `app/superadmin/locals/[localId]/members/page.tsx`
- No hay `NEXT_PUBLIC_APP_ENV`, `APP_ENV` o similar en el repo.
- Env vars presentes en cliente para Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL`
  - `lib/supabase/client.ts`
  - `lib/invokeEdge.ts`

### Scripts / tooling

- Heuristica por URL para distinguir local vs hosted y bloquear seeds en hosted:
  - `scripts/dev-seed-alert-scenarios.mjs`
    - `isHosted = SUPABASE_URL.includes('supabase.co')`
    - `isLocal = SUPABASE_URL.includes('localhost' | '127.0.0.1')`
    - `ALLOW_PROD_SEED` para override
- Env vars usados por scripts:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### DB/RPC (Postgres)

- No hay `current_setting('app.env', ...)` ni GUC de entorno definido.
- Solo se usa `current_setting('request.headers', true)` para RLS token de invitaciones:
  - `supabase/migrations/20260107100000_061_invitations_schema.sql`
- No existe tabla/config o helper que exponga entorno en SQL.

### Docs / ops

- No se documenta un `APP_ENV` ni un setup explícito de staging/prod.
- Hay referencias a seeds DEV y uso de `SUPABASE_DB_URL` para tooling:
  - `docs/testing-reference.md` (dev-only)
  - `docs/ops-log.md` (SUPABASE_DB_URL)

## Tabla — Señales encontradas

| Señal                                | Ubicacion                                                       | Uso actual      | Valor esperado              | Observaciones                       |
| ------------------------------------ | --------------------------------------------------------------- | --------------- | --------------------------- | ----------------------------------- |
| `process.env.NODE_ENV`               | `components/editor/RichLessonEditor.tsx`                        | debug UI        | `production` en builds prod | No distingue staging vs prod        |
| `process.env.NODE_ENV`               | `components/learner/LessonBlocksRenderer.tsx`                   | debug blocks    | `production` en builds prod | No distingue staging vs prod        |
| `process.env.NODE_ENV`               | `app/superadmin/locals/[localId]/members/page.tsx`              | logging         | `production` en builds prod | No distingue staging vs prod        |
| `NEXT_PUBLIC_SUPABASE_URL`           | `lib/supabase/client.ts`                                        | supabase client | URL por entorno             | No es env flag; solo endpoint       |
| `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` | `lib/invokeEdge.ts`                                             | edge URL        | URL por entorno             | No es env flag                      |
| `SUPABASE_URL` + heuristica          | `scripts/dev-seed-alert-scenarios.mjs`                          | gating seeds    | `localhost`/`supabase.co`   | Heuristica no valida para SQL/UI    |
| `current_setting('request.headers')` | `supabase/migrations/20260107100000_061_invitations_schema.sql` | invite token    | N/A                         | Header es manipulable desde cliente |

## Recomendacion (señal de entorno)

### UI (Next.js)

- **Recomendado**: agregar `NEXT_PUBLIC_APP_ENV` (por ejemplo: `local`, `dev`, `staging`, `prod`) en `.env*` por entorno.
- Uso sugerido: `process.env.NEXT_PUBLIC_APP_ENV` para habilitar/deshabilitar UI.
- **No usar** solo `NODE_ENV` para diferenciar staging/prod (ambos suelen ser `production`).

### DB/RPC (Postgres)

- **Recomendado**: definir un GUC de base de datos `app.env` por entorno (ej: `ALTER DATABASE ... SET app.env = 'prod'`).
- Desde SQL/RPC usar `current_setting('app.env', true)`.
- **Evitar** gating por headers (`request.headers`) porque el cliente puede forzarlos.
- **Alternativa segura** si no hay GUC: permitir hard delete **solo** con service role (Edge/CI) y bloquear en RPCs expuestos a cliente. (Esto mantiene prod seguro, pero no permite hard delete desde UI).

## Recomendacion concreta para hard delete gating

### UI gating (boton/CTA)

- Condicion: `NEXT_PUBLIC_APP_ENV !== 'prod'`.
- Si no existe la variable, **ocultar** el boton por defecto.

### DB/RPC gating

- Implementar `if current_setting('app.env', true) = 'prod' then raise exception`.
- Combinar con rol: solo `rls_is_superadmin()` o service role.
- Si `app.env` no esta definido, tratar como prod (fail-closed).

## Checklist para implementar hard delete sin adivinanzas

1. Definir `NEXT_PUBLIC_APP_ENV` por entorno (local/dev/staging/prod).
2. Configurar `app.env` en la base de datos por entorno.
3. En UI, ocultar hard delete salvo `NEXT_PUBLIC_APP_ENV` no-prod.
4. En RPC, bloquear si `current_setting('app.env', true) = 'prod'` o si no es superadmin/service role.
5. Documentar la convención en `docs/schema-guide.md` o un doc de env.
