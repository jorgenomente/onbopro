# Auditoria — EXPLAIN en quizzes (parser + view + RPC)

## Hallazgos (evidencia)

### 1) Parser bulk import ya lee EXPLAIN

- `lib/quiz/bulkImport.ts` parsea `EXPLAIN` y lo expone como `explain` en `ParsedBulkQuestion`.

```ts
// lib/quiz/bulkImport.ts
const explain = parsed.fields.EXPLAIN?.trim() || null;
...
return {
  index,
  prompt,
  choices,
  correctIndex,
  explain,
  rawBlock: parsed.rawBlock,
  errors: dedupeErrors(errors),
};
```

### 2) RPC de bulk import no persiste EXPLAIN

- `rpc_bulk_import_quiz_questions(p_quiz_id uuid, p_items jsonb)` solo usa `prompt`, `choices`, `correct_index`.
- No hay manejo de `explain` en el payload ni insercion en DB.

```sql
-- supabase/migrations/20260112150500_101_bulk_import_quiz_questions.sql
v_prompt := trim(coalesce(v_item->>'prompt', ''));
...
v_choices := v_item->'choices';
...
v_correct_index := (v_item->>'correct_index')::int;
...
insert into public.quiz_questions (quiz_id, prompt, position)
values (p_quiz_id, v_prompt, v_position)
returning id into v_question_id;
```

### 3) v_org_quiz_detail retorna preguntas via JSON agregado

- `public.v_org_quiz_detail` arma `questions` con jsonb_agg.
- Campos actuales por pregunta: `question_id`, `prompt`, `position`, `choices`.
- No expone `explain`.

```sql
-- supabase/migrations/20260112170200_105_update_v_org_quiz_detail_add_quiz_prompt.sql
jsonb_build_object(
  'question_id', qq.id,
  'prompt', qq.prompt,
  'position', qq.position,
  'choices', coalesce(choices.choices, '[]'::jsonb)
)
```

### 4) RPCs actuales para create/update question no contemplan EXPLAIN

- `rpc_create_quiz_question(p_quiz_id uuid, p_prompt text) -> uuid`
- `rpc_update_quiz_question(p_question_id uuid, p_prompt text) -> void`
- Ambas solo validan `prompt`.

```sql
-- supabase/migrations/20260106103000_050_quiz_editor_rpcs.sql
create or replace function public.rpc_create_quiz_question(
  p_quiz_id uuid,
  p_prompt text
) returns uuid ...

create or replace function public.rpc_update_quiz_question(
  p_question_id uuid,
  p_prompt text
) returns void ...
```

### 5) Docs mencionan EXPLAIN en el formato, pero no en el contrato de datos

- `docs/screens/org-quiz-editor.md` incluye EXPLAIN en formato de import.

```md
EXPLAIN: (opcional)
```

## Resumen del delta

- **Parser**: ya soporta EXPLAIN (`ParsedBulkQuestion.explain`).
- **DB schema**: no hay columna `quiz_questions.explanation` (no aparece en migrations).
- **RPC bulk import**: no persiste explain.
- **View**: no expone explain.
- **RPC create/update**: no aceptan explain.

## Impacto para implementación futura

Para agregar soporte completo de EXPLAIN se requiere:

1. **Schema**: agregar columna `quiz_questions.explanation` (y template equivalente si aplica).
2. **Bulk import RPC**: leer `explain` del JSON y persistirlo.
3. **View**: exponer `explanation` dentro del JSON de preguntas.
4. **RPC create/update**: agregar parámetros para `explanation` (o RPC nuevo full).
5. **UI**: mostrar/editar explanation en el editor y en el player si aplica.
