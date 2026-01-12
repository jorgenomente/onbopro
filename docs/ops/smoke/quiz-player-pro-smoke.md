# Smoke Test — Quiz Player Pro

## Objetivo

Validar retry, shuffle deterministico y correct answers post-submit.

## Precondiciones

- Usuario aprendiz con quiz asignado.
- Quiz con `shuffle_questions=true` y `show_correct_answers=true`.
- max_attempts por defecto (3) o definido.

## Casos

1. Retry

- Completar y enviar quiz con score insuficiente.
- UI muestra CTA “Reintentar”.
- Click en “Reintentar” crea nuevo intento (rpc_quiz_start) o error si max_attempts alcanzado.

2. Shuffle deterministico

- Iniciar intento (attempt_id asignado).
- Recargar la pagina: orden de preguntas no cambia.

3. Correct answers

- Antes de submit: no se muestran correctas.
- Despues de submit y con show_correct_answers=true:
  - opciones correctas resaltadas.
  - seleccion incorrecta marcada.

## Queries utiles

```sql
select id, shuffle_questions, show_correct_answers, max_attempts
from public.quizzes
order by created_at desc
limit 5;
```
