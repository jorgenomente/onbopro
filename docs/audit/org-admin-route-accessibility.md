# Org Admin Route Accessibility — Dev Mode UX

## Scope

Inventario de rutas `/org/**` con estado (operativa / en construcción) y entry points disponibles en UI.

## Rutas operativas

- `/org/dashboard`
  - Entry points: header nav (Org Admin)
- `/org/alerts`
  - Entry points: header nav
- `/org/courses`
  - Entry points: header nav
- `/org/courses/[courseId]/outline`
  - Entry points: card en `/org/courses`
- `/org/courses/[courseId]/lessons/[lessonId]/edit`
  - Entry points: outline (lista de lecciones)
- `/org/courses/[courseId]/quizzes/[quizId]/edit`
  - Entry points: outline (quiz por unidad/final)
- `/org/locals/[localId]`
  - Entry points: `/org/dashboard` (cards de locales)
- `/org/locals/[localId]/courses`
  - Entry points: `/org/locals/[localId]` (CTA asignaciones)
- `/org/locals/[localId]/members/invite`
  - Entry points: `/org/locals/[localId]` (CTA invitar)
- `/org/learners/[learnerId]`
  - Entry points: `/org/locals/[localId]` (roster) y `/org/alerts`
- `/org/invitations`
  - Entry points: header nav

## Rutas en construcción (navegables, no operativas)

- `/org/courses/new`
  - Entry points: header nav (Crear curso con badge), CTA en `/org/courses` (botón y FAB con badge)
- `/org/courses/[courseId]/edit`
  - Entry points: header de `/org/courses/[courseId]/outline` (link con badge)
- `/org/courses/[courseId]/preview`
  - Entry points: header de `/org/courses/[courseId]/outline` (link con badge)

## Cambios de entry points en este bloque

- Header org_admin ahora incluye CTA “Crear curso” con badge “En construcción”.
- `/org/courses` ahora muestra badge “En construcción” en el CTA de Crear curso (empty state) y en el FAB.
- `/org/courses/[courseId]/outline` ahora muestra badges “En construcción” en links a Preview/Edit.

## Rutas sin entry point (A validar)

- Ninguna detectada en `/org/**` tras los cambios anteriores.
