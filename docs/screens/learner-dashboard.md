# Screen Data Contract — Learner Dashboard

## Route

- /l/[localId]/dashboard

## View

- public.v_learner_dashboard_courses

## Params

- localId (uuid)

## Columns (name, type, meaning)

- local_id uuid — local del curso (scoped por la vista)
- course_id uuid — curso
- course_title text — titulo del curso (courses.title)
- course_image_url text — siempre null por ahora
- course_status text — pending | in_progress | completed (derivado de progreso del usuario)
- total_lessons bigint — total de lecciones del curso
- completed_lessons bigint — lecciones completadas por el usuario
- progress_percent integer — progreso 0-100
- last_activity_at timestamptz — ultimo completed_at del usuario en el curso
- completed_at timestamptz — ultimo completed_at si el curso esta completo, sino null
- current_unit_id uuid — primera unidad con pendientes (por position)
- current_unit_title text — titulo de esa unidad
- estimated_minutes_left integer — siempre null por ahora

## Sorting

- No definido por la vista. La UI puede ordenar por:
  - course_status (pending/in_progress/completed)
  - last_activity_at desc
  - course_title asc

## Estados UI obligatorios

- loading
- error
- empty (0 filas)
- all-completed (todas las filas con course_status = 'completed' y total_lessons > 0)

## Missing / Gaps

- local_name no existe en la vista. UI debe usar solo el titulo de curso o resolver el nombre de local con otra vista si se agrega a futuro.

## Example response (mock)

```json
[
  {
    "local_id": "2580e080-bf31-41c0-8242-7d90b070d060",
    "course_id": "2c8e263a-e835-4ec8-828c-9b57ce5c7156",
    "course_title": "Seguridad y salud",
    "course_image_url": null,
    "course_status": "in_progress",
    "total_lessons": 12,
    "completed_lessons": 5,
    "progress_percent": 42,
    "last_activity_at": "2026-01-05T12:10:00Z",
    "completed_at": null,
    "current_unit_id": "809b8e44-d6b1-4478-80b5-af4dbf53dd91",
    "current_unit_title": "Modulo 2",
    "estimated_minutes_left": null
  }
]
```
