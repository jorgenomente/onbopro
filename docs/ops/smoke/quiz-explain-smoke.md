# Smoke Test — Quiz EXPLAIN

## Objetivo

Verificar que la explicación (EXPLAIN) se persiste y se muestra en el editor.

## Precondiciones

- Usuario org_admin con acceso a un quiz.
- Acceso a `/org/courses/[courseId]/quizzes/[quizId]/edit`.

## Pasos

1. Importar una pregunta con EXPLAIN desde el modal de import.
2. Verificar que la explicación aparece en modo view.
3. Editar la explicación en modo edit y guardar cambios.
4. Recargar la página y confirmar persistencia.
