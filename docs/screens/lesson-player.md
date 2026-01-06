# Screen Data Contract — Lesson Player

## Route

- /l/[localId]/lessons/[lessonId]

## View

- public.v_lesson_player

## Params

- localId (uuid)
- lessonId (uuid)

## Columns (name, type, meaning, cardinality)

- local_id uuid — local asignado — single row
- course_id uuid — curso de la leccion — single row
- course_title text — titulo del curso — single row
- course_image_url text — siempre null por ahora — single row
- unit_id uuid — unidad de la leccion — single row
- unit_title text — titulo de la unidad — single row
- unit_position integer — orden de la unidad — single row
- lesson_id uuid — leccion solicitada — single row
- lesson_title text — titulo de la leccion — single row
- lesson_position integer — orden de la leccion — single row
- content_type text — tipo de contenido (ej: video, texto)
- content jsonb — payload de contenido
- is_completed boolean — true si hay completion del usuario
- completed_at timestamptz — fecha de completion o null
- can_mark_complete boolean — true si no esta completada
- prev_lesson_id uuid — leccion anterior o null
- next_lesson_id uuid — leccion siguiente o null

## Cardinalidad esperada

- 0 o 1 fila por (local_id, lesson_id)

## UI derivable (solo desde columnas reales)

- Titulo de leccion: lesson_title
- Contenido: content_type + content
- Estado de progreso: is_completed + completed_at
- Navegacion: prev_lesson_id / next_lesson_id

## Sorting

- No aplica (una fila)

## Estados UI

- loading
- error
- empty (0 rows: leccion no asignada/no accesible o inexistente)

## Missing / Gaps

- No hay metadata de duracion de leccion.
- No hay nombre del local.
- Si prev/next es null, la UI debe mostrar fallback (volver al outline).

## Write paths

- RPC: rpc_mark_lesson_completed(p_local_id uuid, p_lesson_id uuid)
- Llamado desde frontend via supabase.rpc.
- Idempotente por unique(user_id, lesson_id) con upsert de completed_at.

## Example response (mock)

```json
{
  "local_id": "2580e080-bf31-41c0-8242-7d90b070d060",
  "course_id": "2c8e263a-e835-4ec8-828c-9b57ce5c7156",
  "course_title": "Seguridad y salud",
  "course_image_url": null,
  "unit_id": "809b8e44-d6b1-4478-80b5-af4dbf53dd91",
  "unit_title": "Modulo 2",
  "unit_position": 2,
  "lesson_id": "30b3b16c-3b59-4eae-b8cf-c15194a2afdc",
  "lesson_title": "Uso de EPP",
  "lesson_position": 1,
  "content_type": "video",
  "content": { "url": "https://cdn.example.com/video.mp4" },
  "is_completed": false,
  "completed_at": null,
  "can_mark_complete": true,
  "prev_lesson_id": null,
  "next_lesson_id": "11111111-1111-1111-1111-111111111111"
}
```
