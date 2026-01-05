# Screen Data Contract — v_course_outline

## Resumen

Indice del curso para Aprendiz. Muestra encabezado del curso, progreso total, modulos (units) con estado/progreso y lecciones con estado (completed/in_progress/pending/locked).

## Rol y Scope

- Rol: aprendiz
- Scope: LOCAL + COURSE
- auth.uid() implícito

## Input

- local_id (uuid) — requerido desde UI
- course_id (uuid) — requerido desde UI
- auth.uid() — implícito (RLS)

## Output (una fila por leccion)

- local_id uuid
- course_id uuid
- course_title text — campo equivalente en courses (title)
- course_image_url text null — null si no existe campo
- total_units int
- total_lessons int
- completed_lessons int
- progress_percent int (0-100)
- unit_id uuid
- unit_title text
- unit_position int
- unit_total_lessons int
- unit_completed_lessons int
- unit_progress_percent int (0-100)
- unit_status text: pending | in_progress | completed | locked
- lesson_id uuid
- lesson_title text
- lesson_position int
- lesson_duration_minutes int null — null si no existe metadata
- lesson_status text: completed | in_progress | pending | locked
- lesson_completed_at timestamptz null

## Reglas de calculo

- Filtro de asignacion:
  - Solo cursos asignados al local (local_courses.status = 'active')
- Progreso por leccion:
  - lesson_completed si existe lesson_completions para auth.uid() y el lesson_id
  - lesson_completed_at = lesson_completions.completed_at si existe
- Leccion in_progress:
  - Primera leccion no completada del curso
  - Orden: course_units.position asc, lessons.position asc
- Progreso por unidad:
  - unit_total_lessons = count de lessons en la unidad
  - unit_completed_lessons = count de completions del usuario en la unidad
  - unit_progress_percent = round((unit_completed_lessons / nullif(unit_total_lessons,0))\*100)
  - unit_status:
    - completed: unit_completed_lessons = unit_total_lessons AND unit_total_lessons > 0
    - pending: unit_completed_lessons = 0
    - in_progress: 0 < unit_completed_lessons < unit_total_lessons
    - locked: solo si hay gating formal (si no, usar pending/in_progress/completed)
- Progreso del curso:
  - total_units = count(distinct unit_id)
  - total_lessons = count de lessons del curso
  - completed_lessons = count de completions del usuario del curso
  - progress_percent = round((completed_lessons / nullif(total_lessons,0))\*100)

## Reglas de seguridad

- Hereda RLS de las tablas base
- Solo expone progreso del auth.uid()
- Aislamiento por local

## Estados UI obligatorios

- Curso sin lecciones
- Todo completado
- Curso no asignado al local
- Sin progreso (pending)

## Query usage

```sql
select *
from public.v_course_outline
where local_id = :local_id
  and course_id = :course_id
order by unit_position, lesson_position;
```
