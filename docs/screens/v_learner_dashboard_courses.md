# Screen Data Contract — v_learner_dashboard_courses

## Resumen de la pantalla

Learner Dashboard (por local) muestra el estado de avance del aprendiz en los cursos asignados a su local. La pantalla prioriza un curso destacado para continuar, una lista de cursos activos del local y un historial de cursos completados.

## Rol y Scope

- Rol: aprendiz
- Scope: LOCAL (filtrado por local_id)
- auth.uid() implícito

## Input del contrato

- local_id (uuid) — requerido desde UI
- auth.uid() — implícito (RLS)

## Output del contrato (por curso)

- local_id uuid
- course_id uuid
- course_title text — campo equivalente en courses (ej: title)
- course_image_url text null — campo equivalente si existe
- course_status text — enum logico: pending | in_progress | completed
- total_lessons int
- completed_lessons int
- progress_percent int (0-100)
- last_activity_at timestamptz null
- completed_at timestamptz null
- current_unit_id uuid null
- current_unit_title text null
- estimated_minutes_left int null

## Reglas de calculo

- status:
  - pending: completed_lessons = 0
  - in_progress: 0 < completed_lessons < total_lessons
  - completed: completed_lessons = total_lessons AND total_lessons > 0
- current_unit:
  - primera unidad (por orden) con al menos una leccion no completada por el usuario
  - si no hay pendientes, current*unit*\* = null
- progress_percent:
  - redondeo entero de (completed_lessons / nullif(total_lessons, 0)) \* 100
- last_activity_at:
  - ultima actividad del aprendiz sobre el curso (lesson_completions)
- completed_at:
  - max(lesson_completions.completed_at) solo si completed_lessons = total_lessons y total_lessons > 0
- estimated_minutes_left (opcional):
  - basado en estimaciones por leccion (si existe metadata)
- cursos sin lecciones:
- course_status = pending
- progress_percent = 0
- current*unit*\* = null

## Notas de consistencia

- course_status y completed_at derivan del progreso del usuario (no del status global del curso)

## Reglas de seguridad

- La vista debe respetar RLS y el aislamiento por local
- Solo filas del local solicitado y del usuario autenticado
- No exponer progreso de otros usuarios

## Estados UI obligatorios

- Sin cursos asignados
- Cursos pendientes sin avance
- Cursos en progreso
- Cursos completados (historial)
- Todos los cursos completados

## Notas de performance

- Agregaciones por local_id y course_id
- Indices a revisar: local_courses(local_id, status), course_units(course_id), lessons(unit_id), lesson_completions(user_id, lesson_id)
- Evitar joins no necesarios en runtime; preferir redundancia existente

## Referencia visual

- docs/ui/learner-dashboard.png (si existe)

## Query usage

```sql
select *
from v_learner_dashboard_courses
where local_id = :local_id;
```
