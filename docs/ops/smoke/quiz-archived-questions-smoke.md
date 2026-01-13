# Smoke Test — Quiz Archived Questions

## Objetivo

Verificar que las preguntas archivadas se listan, restauran y se pueden editar.

## Precondiciones

- Usuario org_admin con acceso a un quiz.
- Acceso a `/org/courses/[courseId]/quizzes/[quizId]/edit`.

## Pasos

1. Archivar una pregunta desde el editor.
2. Abrir "Archivadas (N)" y verificar que aparece en la lista.
3. Restaurar la pregunta y confirmar que vuelve a la lista activa.
4. Usar "Restaurar y editar" y verificar scroll/focus.
5. Editar la pregunta restaurada y guardar cambios.
