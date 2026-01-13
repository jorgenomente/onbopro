# Quiz Analytics — Verification Checklist (2026-01-12)

## Objetivo

Validar estructura de vistas de analytics y scoping por rol.

## Queries de verificacion (estructura)

### Org Admin

```sql
select * from public.v_org_quiz_analytics limit 1;
select * from public.v_org_quiz_question_analytics limit 1;
select * from public.v_org_quiz_option_analytics limit 1;
```

Esperado: columnas y tipos segun docs/screens/quiz-analytics-org.md.

### Referente

```sql
select * from public.v_ref_quiz_analytics limit 1;
select * from public.v_ref_quiz_question_analytics limit 1;
select * from public.v_ref_quiz_option_analytics limit 1;
```

Esperado: columnas y tipos segun docs/screens/quiz-analytics-ref.md.

## Validaciones de scope

- Org admin solo ve org_id propio.
- Referente solo ve local_id propio.
