# Auditoria — Tab switch → navigation hangs

## Resumen ejecutivo

No hay manejo de `visibilitychange`/`focus` ni revalidacion de sesion al volver a una pestaña. La app depende de un cliente Supabase singleton y de `onAuthStateChange` en `Header`, pero no hay un “session refresh on focus” ni un guard global en rutas `/org/*` o `/l/*`. Esto crea un escenario tipico: el token expira o queda stale mientras el tab esta en background; al volver, las queries arrancan con credenciales vencidas y la UI queda en `loading` o en error no recuperado hasta un hard refresh. La evidencia apunta a falta de revalidacion al volver + 401 no manejado en pantallas de lectura.

## Estado actual (evidencia)

### No hay listeners de visibilidad / focus

- Busqueda en repo no encontro `visibilitychange`, `focus`, `online`, `offline` (`rg -n "visibilitychange|focus|online|offline"`).
- No existe ningun “SessionRevalidateOnFocus” ni handler global para revalidar session al volver al tab.

### Supabase client (browser)

- `lib/supabase/client.ts` crea un singleton con `createClient(supabaseUrl, supabaseAnonKey)`.
- No hay configuracion explicita de `auth` (autoRefresh/persistSession se quedan en defaults).
- No hay server client ni middleware; todo es client-side.

### Auth refresh actual

- `app/components/Header.tsx` llama `supabase.auth.getUser()` y se suscribe a `onAuthStateChange`.
- `Header` hace `router.refresh()` en cambios de auth (debounced, pero sigue siendo global).
- No hay `getSession()` al volver a tab ni `setSession` explicito.

### Fetches / navigation tras tab resume

- Pantallas `/org/*` y `/l/*` hacen queries en `useEffect` sin manejo global de 401.
- Ejemplos: `/org/courses`, `/org/courses/[courseId]/outline`, `/org/courses/[courseId]/quizzes/[quizId]/edit`.
- Si el token expira, la UI puede quedarse en estado intermedio y no reintenta.

## Hipotesis principales (con evidencia)

### H1 — Token stale al volver al tab (sin revalidacion)

Evidencia:

- No hay listener de `visibilitychange` ni `focus`.
- `supabase.auth.getSession()` solo se invoca en rutas bootstrap (`/`, `select-local`, `set-password`, `accept-invitation`).
  Efecto probable:
- Access token expira en background; al volver, queries fallan con 401 y UI queda “colgada”.

### H2 — Auth listener no cubre el caso “tab resume”

Evidencia:

- `onAuthStateChange` esta en `Header`, pero depende de eventos internos de Supabase (no dispara en un tab que estuvo suspendido).
  Efecto probable:
- No hay refresh de auth state en resume; la UI usa estado stale.

### H3 — Navigation + data fetch sin recovery

Evidencia:

- La mayoria de pantallas hacen fetch en `useEffect` con `loading=true` y no reintentan por 401.
  Efecto probable:
- La navegacion ocurre, pero los datos nunca se completan porque el fetch falla y la UI no se recupera.

## Puntos sensibles en codigo

- `app/components/Header.tsx`: `onAuthStateChange` + `router.refresh()` global.
- `lib/supabase/client.ts`: singleton sin configuracion de revalidacion on focus.
- Pantallas con `useEffect` + `supabase.from().select()` sin manejo global de 401.

## Propuesta de instrumentacion DEV-only (minima)

Archivo recomendado: `app/components/Header.tsx` o un nuevo `app/components/SessionRevalidateOnFocus.tsx`.

Logs sugeridos (solo DEV):

- `document.visibilitychange` + `window.focus` con timestamp.
- `supabase.auth.getSession()` al volver a focus (log access_token y expires_at).
- `onAuthStateChange` con eventos y timestamp.
- Log de “route change” comparando `usePathname()` anterior vs actual.

Objetivo: confirmar si al volver el access_token esta expirado y si se dispara `onAuthStateChange`.

## Fix recomendado (bajo riesgo)

### F1 — Revalidate session on focus/visibility

- Agregar un componente global (p.ej. `SessionRevalidateOnFocus`) montado en `app/layout.tsx` o `Header`.
- En `visibilitychange` + `focus`:
  - `supabase.auth.getSession()`.
  - Si expirado o sin session: `supabase.auth.signOut()` + redirect `/login`.
  - Si hay session pero expira pronto: `supabase.auth.refreshSession()` (si disponible).
    Metrica esperada: elimina el estado “stale” tras volver al tab.

### F2 — Manejo explicito de 401 en queries criticos

- Para pantallas `/org/*` y `/l/*`, si `error.code` indica auth/401:
  - Mostrar UI “Sesion expirada” + CTA a login.
  - Evitar `loading` infinito.

### F3 — Debounce de refresh y evitar loops

- Ya existe debounce en `Header`, pero revisar si se dispara en resume.
- No ejecutar `router.refresh()` en cada focus; solo tras revalidar session si cambió.

## Smoke tests especificos

- Tab switch: abrir `/org/courses`, cambiar de pestaña 5–10 min, volver y navegar a otra ruta.
- Sleep/wake: suspender laptop, reanudar, navegar a `/org/courses/[courseId]/outline`.
- Multi-tab: logout/login en una tab, volver a la otra y navegar.

## Conclusión

El problema esta alineado con “session stale on tab resume” + ausencia de revalidacion on focus. Un fix de bajo riesgo es implementar un handler global de revalidacion al volver (visibility/focus) y mejorar el handling de 401 en pantallas clave. Esto evita la necesidad de hard refresh y transforma el hang en un estado recuperable.

## Fix implementado (2026-01-12)

- `SessionRevalidateOnFocus` (focus/visibility) revalida session y refresca solo si cambio el token.
- `Header` limita refresh a eventos SIGNED_IN / SIGNED_OUT.
- `/org/courses` y `/org/courses/[courseId]/outline` muestran CTA de login ante auth expired.

## Fix adicional (2026-01-12)

- `SessionRevalidateOnFocus` ahora fuerza `refreshSession()` al volver al tab (throttle 7s).
- `Header` ya no hace refresh global en SIGNED_IN; solo en SIGNED_OUT.
- Timeouts (15s) para `v_org_courses` y `v_org_course_outline` via `withTimeout`.
- `DevNavDiagnostics` agregado en dev para logs de navegación y errores.
