# Smoke Test — Org Quiz Prompt Settings

## Objetivo

Verificar que el prompt maestro ONBO se edita y persiste por organizacion.

## Precondiciones

- Usuario org_admin con acceso a un quiz.
- Acceso a `/org/courses/[courseId]/quizzes/[quizId]/edit`.

## Pasos

1. Abrir el modal "Prompt" desde el editor de quiz.
2. Editar el texto y guardar cambios.
3. Recargar la pagina y confirmar que el prompt persiste.
4. Usar "Restablecer al predeterminado" y verificar el valor por defecto.
