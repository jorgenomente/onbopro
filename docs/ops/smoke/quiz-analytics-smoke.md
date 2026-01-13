# Smoke Test — Quiz Analytics (Org + Referente)

## Objetivo

Verificar que las vistas de analytics devuelven datos y respetan scope por rol.

## Precondiciones

- Org con quizzes y attempts enviados (submitted).
- Usuario org_admin de esa org.
- Usuario referente con membership activa en un local.

## Pasos

1. Org admin: ejecutar
   - `select * from public.v_org_quiz_question_analytics limit 5;`
   - `select * from public.v_org_quiz_option_analytics limit 5;`
2. Verificar que las filas pertenecen a la org del usuario.
3. Referente: ejecutar
   - `select * from public.v_ref_quiz_question_analytics where local_id = :local_id limit 5;`
4. Verificar que no devuelve datos de otros locales.
5. Learner (si aplica): confirmar que no puede leer vistas org/ref por RLS base.
