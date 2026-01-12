# Smoke Test — Quiz V2 Attempt Questions

## Objetivo

Verificar que cada intento fija su set de preguntas y que scoring/answer valida contra ese set.

## Precondiciones

- Quiz con banco de preguntas (> 1).
- num_questions definido (o null para usar bank_size).
- Usuario aprendiz asignado al curso.

## Queries

1. Ver set del attempt

```sql
select aq.attempt_id, aq.question_id, aq.position
from public.quiz_attempt_questions aq
where aq.attempt_id = :attempt_id
order by aq.position;
```

Esperado: cantidad = num_questions (o bank_size si null).

2. Respuesta fuera del set debe fallar

```sql
select public.rpc_quiz_answer(:attempt_id, :question_id_fuera_del_set, :option_id, null);
```

Esperado: error "Question not part of attempt".

3. Score sobre set del attempt

```sql
select public.rpc_quiz_submit(:attempt_id);
```

Esperado: score calculado sobre N preguntas del attempt.
