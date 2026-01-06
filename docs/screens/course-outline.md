# Screen Data Contract — Course Outline

## Route

- /l/[localId]/courses/[courseId]

## View

- public.v_course_outline

## Params

- localId (uuid)
- courseId (uuid)

## Columns (name, type, meaning, cardinality)

- local_id uuid — local del curso (per row) — multiple rows
- course_id uuid — curso (per row) — multiple rows
- course_title text — titulo del curso — repeated across rows
- course_image_url text — siempre null por ahora — repeated across rows
- total_units bigint — total de unidades del curso — repeated across rows
- total_lessons bigint — total de lecciones del curso — repeated across rows
- completed_lessons bigint — completadas por el usuario — repeated across rows
- progress_percent integer — progreso 0-100 — repeated across rows
- unit_id uuid — unidad actual de la fila — multiple rows
- unit_title text — titulo de la unidad — multiple rows
- unit_position integer — orden de unidad — multiple rows
- unit_total_lessons bigint — total de lecciones por unidad — repeated per unidad
- unit_completed_lessons bigint — completadas por el usuario en la unidad — repeated per unidad
- unit_progress_percent integer — progreso unidad 0-100 — repeated per unidad
- unit_status text — pending | in_progress | completed — repeated per unidad
- unit_quiz_id uuid — quiz por unidad (type=unit), null si no existe — repeated per unidad
- course_quiz_id uuid — quiz final del curso (type=final), null si no existe — repeated across rows
- lesson_id uuid — leccion de la fila — multiple rows
- lesson_title text — titulo de la leccion — multiple rows
- lesson_position integer — orden de leccion — multiple rows
- lesson_duration_minutes integer — siempre null por ahora — multiple rows
- lesson_status text — completed | in_progress | pending — multiple rows
- lesson_completed_at timestamptz — completado por el usuario, null si no — multiple rows

## Sorting

- Orden recomendado: unit_position asc, lesson_position asc

## UI derivable (solo desde columnas reales)

- Header del curso: course_title + progress_percent
- Lista de unidades: agrupando por unit_id + unit_title + unit_status
- Lecciones por unidad: ordenadas por lesson_position
- Progreso por unidad: unit_progress_percent
- Estado de leccion: lesson_status
- Boton de evaluacion por unidad: unit_quiz_id si no es null
- Boton de evaluacion final: course_quiz_id si no es null

## Estados UI

- loading
- error
- empty (0 rows: curso no asignado o sin contenido)

## Missing / Gaps

- No hay local_name ni org_name en la vista.
- course_image_url y lesson_duration_minutes son null literal.
- Si course_quiz_id es null, no hay evaluacion final disponible en el curso.

## Example response (mock)

```json
[
  {
    "local_id": "2580e080-bf31-41c0-8242-7d90b070d060",
    "course_id": "2c8e263a-e835-4ec8-828c-9b57ce5c7156",
    "course_title": "Seguridad y salud",
    "course_image_url": null,
    "total_units": 3,
    "total_lessons": 12,
    "completed_lessons": 5,
    "progress_percent": 42,
    "unit_id": "809b8e44-d6b1-4478-80b5-af4dbf53dd91",
    "unit_title": "Modulo 2",
    "unit_position": 2,
    "unit_total_lessons": 4,
    "unit_completed_lessons": 1,
    "unit_progress_percent": 25,
    "unit_status": "in_progress",
    "unit_quiz_id": "9d4c5d1a-7d8c-4f1d-9c66-84b1d42a4b8c",
    "course_quiz_id": "2d72f6f6-3ab7-4a54-9f3f-6b2dd7b4d9e1",
    "lesson_id": "30b3b16c-3b59-4eae-b8cf-c15194a2afdc",
    "lesson_title": "Uso de EPP",
    "lesson_position": 1,
    "lesson_duration_minutes": null,
    "lesson_status": "in_progress",
    "lesson_completed_at": null
  }
]
```
