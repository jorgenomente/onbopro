# Screen Data Contract — v_lesson_player

## Resumen de la pantalla

Lesson Player para Aprendiz. Muestra contenido de una leccion, estado de completado y navegacion (prev/next) dentro del curso.

## Rol y Scope

- Rol: aprendiz
- Scope: LOCAL + LESSON
- auth.uid() implícito

## Input

- local_id (uuid) — requerido desde UI
- lesson_id (uuid) — requerido desde UI
- auth.uid() — implícito (RLS)

## Output (una fila)

- local_id uuid
- course_id uuid
- course_title text
- unit_id uuid
- unit_title text
- unit_position int
- lesson_id uuid
- lesson_title text
- lesson_position int
- content_type text
- content jsonb
- is_completed boolean
- completed_at timestamptz null
- can_mark_complete boolean
- prev_lesson_id uuid null
- next_lesson_id uuid null

## Reglas de calculo

- Seguridad y asignacion:
  - La fila solo existe si local_courses tiene (local_id, course_id) con status = 'active'
- Estado de completado:
  - is_completed = true si existe lesson_completions del auth.uid() para local_id + lesson_id
  - completed_at = lesson_completions.completed_at si existe
- can_mark_complete:
  - true si no esta completada y la asignacion al local esta activa
  - false si ya esta completada
- Navegacion:
  - Orden global: course_units.position asc, lessons.position asc
  - prev_lesson_id: leccion anterior en ese orden
  - next_lesson_id: leccion siguiente en ese orden

## Reglas de seguridad

- Hereda RLS de las tablas base
- Solo contenido asignado al local
- Sin bypass (no SECURITY DEFINER)

## Estados UI obligatorios

- Leccion no encontrada
- Curso no asignado al local
- Leccion completada vs pendiente
- Primera/ultima leccion (prev/next null)

## Query usage

```sql
select *
from public.v_lesson_player
where local_id = :local_id
  and lesson_id = :lesson_id;
```
