# Content Model — ONBO (Lote 4)

## Scope

Este documento define el modelo de contenido (cursos, unidades, lecciones, quizzes) y sus reglas de visibilidad/publicación.
El objetivo es soportar:

- Course Builder (Org Admin / Superadmin)
- Course Player (Learner)
- Lectura para Referente (read-only, sin progreso)
- Asignación por Local

## Roles & Access

### Superadmin

- Puede leer/escribir contenido de todas las organizaciones.

### Org Admin

- Puede leer/escribir contenido de su organización.
- Puede publicar/archivar cursos.
- Tiene Preview read-only (no genera progreso).

### Referente (Local)

- Puede leer cursos **published** asignados a su Local.
- No puede completar cursos ni generar progreso (MVP).

### Learner (Local)

- Puede leer cursos **published** asignados a su Local.
- Puede escribir su propio progreso (own-only).

## Entities

### Course

- Pertenece a una Organization.
- Estructura: Course → Units → Lessons.
- Quizzes:
  - Unit Quiz (opcional, por unidad)
  - Final Quiz (opcional, por curso)

### Unit

- Pertenece a un Course.
- Ordenable dentro del course.

### Lesson

- Pertenece a una Unit.
- Tipos (MVP): text | video_url | file (pdf/link).
- Ordenable dentro de la unit.

### Quiz

- Puede ser:
  - unit_quiz (asociado a unit)
  - final_quiz (asociado a course)
- Config: pass_score_pct, time_limit_min, shuffle_questions, show_correct_answers.

### QuizQuestion / QuizChoice

- Preguntas y opciones (multiple choice).
- (MVP) 1 respuesta correcta por pregunta.

## Publishing workflow

Estados de Course:

- draft: visible solo para org_admin/superadmin
- published: visible para learners/referentes si está asignado al local
- archived: no visible para learners; histórico para admins

Reglas:

- Publicar solo cuando el curso está completo (MVP).
- No hay versionado (MVP). Editar un course publicado actualiza el mismo course.
- Preview de admin es read-only: no emite lesson_completions ni quiz_attempts.

## Assignment model (Local)

- Los cursos se asignan por Local: `local_id + course_id`.
- Learner ve solo cursos:
  - published
  - asignados a su local
- Cursos selectivos (ej. “Encargados”):
  - se resuelven por asignación (a locales específicos), no por rol global.

## Security model (RLS)

- Tablas de contenido deben incluir `org_id` (directo o redundante).
- Asignaciones por local deben permitir enforcement rápido del scope.
- Vistas SQL son el único origen de lectura para UI.
- Policies simples, helpers auditables (SECURITY DEFINER solo para helpers, no para vistas).
