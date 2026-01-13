# Smoke Test — Quiz EXPLAIN in Player

## Objetivo

Verificar que explanation se expone y renderiza solo post-submit con show_correct_answers.

## Precondiciones

- Quiz con preguntas que tengan explanation.
- show_correct_answers = true en el quiz.
- Usuario aprendiz con acceso al quiz.

## Pasos

1. Abrir el quiz y verificar que explanation NO se muestra antes de enviar.
2. Contestar y enviar el quiz.
3. Confirmar que aparece el bloque "Explicación" en cada pregunta con explanation.
4. Repetir con show_correct_answers = false y confirmar que no se muestra.
