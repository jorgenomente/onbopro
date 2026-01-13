# Diagnostics How-To — Tab Switch Hangs

## Reproduccion

1. Abrir `/org/dashboard`.
2. Cambiar de pestaña 2–5 minutos.
3. Volver y hacer click en “Cursos”.
4. Observar consola y overlay `Diag`.

## Eventos clave a observar

- `visibility` + `focus` seguidos de `auth_session`.
- `nav_click` y luego `path_change`.
- `fetch_start` y `fetch_end` para `/rest/v1/*`.
- `fetch_slow` o `fetch_error` (especialmente `Failed to fetch`).
- `query_start` y `query_end` para queries etiquetadas.
- `courses_render` / `courses_effect` / `courses_load` para el lifecycle de /org/courses.

## Lectura rapida

- `auth_session secondsLeft < 0` → token expirado al volver.
- `fetch_start` sin `fetch_end` → request zombie.
- `fetch_end status 401` → auth stale real.
- `fetch_error` + `Failed to fetch` → conectividad rota en tab resume.
- `query_start` sin `fetch_start` → client mismatch o error antes de ejecutar fetch.
- `courses_effect` ausente → la pagina no esta ejecutando el effect al navegar.

## Copiar logs

Abrir overlay `Diag` y copiar las ultimas 10–20 entradas que incluyan:

- `focus` / `visibility`
- `auth_session`
- `nav_click`
- `path_change`
- `fetch_start` / `fetch_end`
