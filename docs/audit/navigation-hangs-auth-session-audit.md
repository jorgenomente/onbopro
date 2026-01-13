# Auditoria — Navigation Hangs / Auth Session Staleness

## Resumen ejecutivo

Los “hangs” reportados (navegacion que no carga hasta refrescar, acciones que quedan colgadas) son consistentes con una combinacion de: (1) ausencia de timeouts/abort en fetches (Supabase + Edge), (2) manejo incompleto de sesiones caducadas y 401 (no hay redirect ni reauth en la mayoria de pantallas), y (3) dependencia de un cliente Supabase singleton con refresh token en background que puede quedar desincronizado tras idle/sleep o multiples tabs. No hay middleware ni server client que mantenga cookies sincronizadas; toda la app opera via Client Components con `supabase-js` y `useEffect` locales.

Este documento mapea la arquitectura actual, enumera puntos concretos donde se puede “colgar” el flujo, y propone un plan de mitigacion por fases.

## Arquitectura actual (auth + data fetching)

### Cliente Supabase (browser)

- `lib/supabase/client.ts` crea un singleton con `createClient(...)` usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- No hay configuracion explicita de `auth` (autoRefresh/persistSession se dejan en defaults).
- Todas las pantallas en `app/*` son Client Components y hacen queries en `useEffect`.

### Auth bootstrap / routing

- `/` (`app/page.tsx`) usa `supabase.auth.getSession()` y `v_my_context` para redireccionar.
- No existe `middleware.ts` ni `createServerClient` para sesiones server-side.
- `Header` (`app/components/Header.tsx`) usa:
  - `supabase.auth.getUser()` al montar
  - `supabase.auth.onAuthStateChange` con `router.refresh()` en cada cambio.
  - fetches secuenciales a `profiles` y `v_my_context`.

### Edge functions

- Wrapper central: `lib/invokeEdge.ts`.
  - Hace `supabase.auth.getSession()` para obtener access token.
  - Usa `fetch()` directo sin timeout ni AbortController.
  - Si falla la red, devuelve `FETCH_FAILED` pero el UI puede estar en estado “submitting”.

### Views / queries

- La mayoria de las pantallas org/local/quiz usan `supabase.from(...).select()` en `useEffect` y setean loading/error local.
- No hay un “global auth guard” en rutas `/org/*` o `/l/*`.

## Hallazgos con evidencia

### H1 — Sin timeouts en fetch (Edge y REST)

Evidencia:

- `lib/invokeEdge.ts` hace `fetch(endpoint, ...)` sin timeout ni abort.
- `app/auth/accept-invitation/page.tsx` hace `fetch(restUrl)` sin timeout.
  Impacto:
- En redes inestables o sleep/wake, requests pueden quedar pendientes.
- UI permanece en `loading`/`submitting` y no se recupera sin reload.

### H2 — Sesion caducada sin manejo global

Evidencia:

- `app/page.tsx` resuelve contexto solo al entrar por `/`.
- Rutas `/org/*` y `/l/*` no verifican session antes de hacer queries.
- `lib/invokeEdge.ts` usa `getSession()` pero no maneja 401/expired tokens.
  Impacto:
- Si access token expira en background, las queries fallan con 401/empty y la UI puede quedar en estado intermedio.
- El usuario “recupera” al refrescar, porque la pagina re-ejecuta auth bootstrap.

### H3 — Refreshes globales desde Header

Evidencia:

- `Header` llama `router.refresh()` en `onAuthStateChange` y luego de completar profile.
  Impacto:
- Puede provocar refresh en momentos no esperados y dejar pantallas en un estado de carga si hay requests pendientes.
- En multiples tabs, los eventos de auth pueden disparar refreshes cruzados.

### H4 — Fetches secuenciales en Header sin manejo de errores visibles

Evidencia:

- `Header` encadena `getUser` -> `profiles` -> `v_my_context` y ahora `organizations` + `v_org_local_context`.
  Impacto:
- Si alguno queda colgado, el header queda en estado parcial sin feedback.
- No bloquea toda la UI, pero puede contribuir a un “estado incompleto” visual.

## Flows con mayor riesgo (segun codigo)

- `/org/courses` (varios fetches + UI basada en estado local).
- `/org/courses/[courseId]/outline` y `/org/courses/[courseId]/quizzes/[quizId]/edit`:
  - multiples RPCs; re-fetches inmediatos.
  - sin timeout ni retry.
- `/org/courses/[courseId]/analytics`:
  - doble fetch en paralelo; si uno falla, se marca error.
- Cualquier flujo con Edge (`invokeEdge`) que depende de access token vigente.

## Checklist de reproduccion (deterministica)

- Dejar la app abierta 30–60 minutos y volver a navegar sin recargar.
- Suspender laptop (sleep) 5–10 minutos y reanudar.
- Abrir dos tabs: hacer logout/login en una, navegar en la otra.
- Simular red lenta (DevTools: Slow 3G) y ejecutar un RPC (crear/editar quiz).
- Cambiar de ruta rapidamente entre `/org/courses` -> `/org/courses/[courseId]/outline`.

## Hipotesis priorizadas (con evidencia y fixes)

### H1: Requests sin timeout quedan pendientes

Evidencia:

- `lib/invokeEdge.ts` no usa AbortController.
- `app/auth/accept-invitation/page.tsx` usa `fetch` directo.
  Fix sugerido:
- Agregar timeout/abort (p.ej. 10–15s) en `invokeEdge`.
- Wrapper general de fetch con timeout para REST calls.
  Riesgo: bajo, UI-only.

### H2: Sesion caducada sin manejo global

Evidencia:

- No hay middleware ni guard; solo `/` hace redirect.
- `getSession()` se usa puntualmente, no hay reauth automatizada en vistas `/org/*`.
  Fix sugerido:
- Crear un “auth guard” simple en layout `/org` (o en un hook) que valide `getSession()` y redirija a `/login`.
- Manejar 401 en RPC/queries y disparar `supabase.auth.signOut()` + redirect.
  Riesgo: medio (cambia comportamiento global).

### H3: Refresh storms desde Header

Evidencia:

- `onAuthStateChange` llama `router.refresh()` sin debounce.
  Fix sugerido:
- Debounce/guard de refresh (solo cuando la pagina actual requiere refetch).
- Evitar refresh si ya hay `router.push` en curso.
  Riesgo: bajo-med (UX).

### H4: Queries sin retry o error states inconsistentes

Evidencia:

- Varios pages tienen `loading`/`error` locales, pero sin retry global ni backoff.
  Fix sugerido:
- Agregar botones “Reintentar” uniformes.
- Normalizar error handling en un hook (p.ej. `useSupabaseQuery`).
  Riesgo: bajo.

## Observabilidad (estado actual y propuesta)

### Estado actual

- Logs solo en `invokeEdge` (console.info en dev).
- Sin captura de `unhandledrejection` ni tiempos de request.

### Propuesta minima

- Instrumentar `invokeEdge` con timing y `console.warn` en tiempo excedido.
- Agregar listener global para `unhandledrejection` en dev.
- Registrar transiciones de auth (`onAuthStateChange`) con timestamps en dev.

## Plan de correccion por fases

### Fase 1 — Quick wins (bajo riesgo)

- Timeouts/abort en `invokeEdge` y fetch RESTs.
- Manejo explicito de 401/403: mostrar UI “Sesion expirada”.
- “Reintentar” estandar en pantallas criticas.

### Fase 2 — Robustez

- Guard global de sesion en `/org` y `/l` (hook/layout).
- Evitar refresh storms desde Header; reducir `router.refresh`.
- Consolidar fetch patterns en un helper.

### Fase 3 — Hardening

- Smoke tests manuales para reproduccion (idle/sleep/multi-tab).
- Scripts de QA con throttling.
- Logs de errores en consola (o futura telemetria).

## Antipatrones detectados (no-go)

- Requests sin timeout y sin cancelacion.
- Dependencia exclusiva de metadata para org/local context.
- Queries en `useEffect` sin handle 401/403 global.
- `router.refresh()` disparado desde auth listener sin control.

## Recomendaciones de smoke checks

- Navegar `/org/courses` -> `/org/courses/[courseId]/outline` tras 30 min idle.
- Editar quiz y guardar con red lenta (throttling).
- Multi-tab: logout en una tab, navegar en otra.
- Sleep/wake: ejecutar una RPC luego de reanudar.

## Fase 1 implementada

- Added `fetchWithTimeout` for REST and Edge requests (timeout 15s).
- Normalized `invokeEdge` errors with `AUTH_EXPIRED`, `TIMEOUT`, `NETWORK`.
- Added retry UI for `/auth/accept-invitation` and auth-expired CTAs for invite flows.
- Debounced `router.refresh()` in `Header` to reduce refresh storms.
