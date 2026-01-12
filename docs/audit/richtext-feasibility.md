# Richtext feasibility (lesson blocks)

## Conclusión

- **Richtext requiere migración:** **No** (a nivel DB/RPC). `block_type` es `text` sin enum/check, y los RPCs aceptan cualquier `p_block_type` no vacío.

## Evidencia: definición y restricciones de `block_type`

**Tabla `lesson_blocks`**: `block_type` es `text` sin `CHECK`/enum.

```sql
-- supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql:1-13
create table if not exists public.lesson_blocks (
  ...
  block_type text not null,
  data jsonb not null default '{}'::jsonb,
  ...
);
```

**Tabla `course_template_lesson_blocks`**: `block_type` también es `text` sin `CHECK`/enum.

```sql
-- supabase/migrations/20260109115804_075_create_lesson_blocks_tables.sql:52-64
create table if not exists public.course_template_lesson_blocks (
  ...
  block_type text not null,
  data jsonb not null default '{}'::jsonb,
  ...
);
```

**No** hay `CHECK` ni FK a tabla de tipos en este archivo ni en migraciones con `block_type`.

## Evidencia: RPCs de blocks

**RPC create (org)**: valida solo `block_type` no vacío, no hay whitelist.

```sql
-- supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql:1-59
create or replace function public.rpc_create_lesson_block(
  p_lesson_id uuid,
  p_block_type text,
  p_data jsonb default '{}'::jsonb
)
...
  v_block_type := trim(coalesce(p_block_type, ''));
  if v_block_type = '' then
    raise exception 'block_type required' using errcode = '22023';
  end if;
```

**RPC update (org)**: solo actualiza `data`, no toca `block_type`.

```sql
-- supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql:60-105
create or replace function public.rpc_update_lesson_block(
  p_block_id uuid,
  p_data jsonb
)
...
  update public.lesson_blocks
  set data = coalesce(p_data, data)
  where block_id = p_block_id;
```

**RPC create (template)**: misma validación (no empty) sin whitelist.

```sql
-- supabase/migrations/20260109115807_078_lesson_blocks_rpcs.sql:210-268
create or replace function public.rpc_create_template_lesson_block(
  p_lesson_id uuid,
  p_block_type text,
  p_data jsonb default '{}'::jsonb
)
...
  v_block_type := trim(coalesce(p_block_type, ''));
  if v_block_type = '' then
    raise exception 'block_type required' using errcode = '22023';
  end if;
```

## Respuesta directa a las preguntas

- **¿Podemos crear un block con `block_type='richtext'` hoy?** **Sí**: DB no restringe `block_type` y RPC create no valida whitelist (solo non-empty).
- **¿Existe enum/check/constraint?** **No**: `block_type` es `text` sin checks/FK.
- **¿RPCs validan `p_block_type`?** **No**: validan solo que no sea vacío.

## Recomendación de formato (diagnóstico)

- **Preferible**: `data` como **JSON estructurado** (schema de editor) + renderer seguro en cliente.
  - Evita `dangerouslySetInnerHTML` y reduce riesgos de XSS.
  - Permite evolutividad del editor (párrafos, headings, listas, links, embeds).
- **HTML**: solo si se incorpora **sanitización estricta** en backend o en cliente antes de render.
  - En el player actual se usa `dangerouslySetInnerHTML` para `content_type === 'html'`.
  - Si `richtext` fuera HTML, hay que agregar sanitización previa a render o usar una librería segura.

## Nota técnica mínima (sin implementación)

- Aunque DB/RPC permiten `richtext`, el **player actual no renderiza `blocks`**; requiere agregar renderer de blocks para que `richtext` se vea en learner.
