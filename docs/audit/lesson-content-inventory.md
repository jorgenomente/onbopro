# Lesson Content Inventory (Legacy) — ONBO

Inventario factual del estado actual de lessons/templates, views y RPCs
relacionados a contenido. Este documento no propone cambios; sirve como
base para documentar el modelo PRO por bloques.

## 1) Schema (tablas y columnas)

### 1.1 public.lessons

Fuente: `supabase/migrations/20260104190300_content.sql`,
`supabase/migrations/20260106062000_034_create_content_core_tables.sql`

- `id` uuid pk
- `unit_id` uuid fk → `course_units(id)`
- `title` text
- `position` int
- `content_type` text
- `content` jsonb default `'{}'`
- `estimated_minutes` int (nullable)
- `is_required` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz
- `unique(unit_id, position)`
- Trigger `trg_lessons_updated_at` (set_updated_at)

Notas:

- No hay constraint/enumeración de `content_type` a nivel tabla.
- La validación real de `content_type` ocurre en RPCs.

### 1.2 public.course_template_lessons

Fuente: `supabase/migrations/20260109133000_070_create_course_templates_tables.sql`

- `lesson_id` uuid pk
- `unit_id` uuid fk → `course_template_units(unit_id)`
- `title` text
- `position` int
- `content_type` text
- `content` jsonb default `'{}'`
- `estimated_minutes` int (nullable)
- `is_required` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz
- `unique(unit_id, position)`
- Trigger `trg_course_template_lessons_updated_at` (set_updated_at)

Notas:

- Igual que org lessons: sin constraint/enumeración de `content_type`.

## 2) Views (lectura de contenido)

### 2.1 public.v_org_lesson_detail (editor org)

Fuente: `supabase/migrations/20260106095500_047_fix_org_lesson_editor_types.sql`

Campos relevantes:

- `lesson_type`: `l.content_type::text`
- `content_text`: solo cuando `content_type = 'text'`
- `content_html`: solo cuando `content_type = 'html'`
- `content_url`: solo cuando `content_type in ('video','file','link')`

Notas:

- No contempla `richtext`.

### 2.2 public.v_superadmin_template_lesson_detail (editor template)

Fuente: `supabase/migrations/20260109133200_072_create_course_template_views.sql`

Campos relevantes:

- `lesson_type`: `l.content_type::text`
- `content_text`: cuando `content_type = 'text'`
- `content_html`: cuando `content_type in ('html','richtext')`
  (coalesce html/text)
- `content_url`: cuando `content_type in ('video','file','link')`

Notas:

- Incluye `richtext` en `content_html`.

### 2.3 public.v_lesson_player (player aprendiz)

Fuente: `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql`

Campos relevantes:

- `content_type` (text)
- `content` (jsonb)

Notas:

- El player interpreta `content_type + content` directamente.

## 3) RPCs (escrituras de contenido)

### 3.1 public.rpc_create_unit_lesson (org)

Fuente: `supabase/migrations/20260106073000_037_rpc_course_units_lessons.sql`

Firma:

- `rpc_create_unit_lesson(p_unit_id uuid, p_title text, p_lesson_type text, p_is_required boolean)`

Validación de `p_lesson_type`:

- Permite: `'text' | 'video_url' | 'file' | 'link'`
- Rechaza cualquier otro valor (`errcode = '22023'`)

Inserta:

- `content_type = p_lesson_type`
- `content = '{}'::jsonb`

### 3.2 public.rpc_update_lesson_content (org)

Fuente: `supabase/migrations/20260106095500_047_fix_org_lesson_editor_types.sql`

Reglas:

- `content_type = 'text'` → requiere `p_content_text`
- `content_type = 'html'` → requiere `p_content_html`
- `content_type in ('video','file','link')` → requiere `p_content_url`
- Otros valores → error `Invalid lesson_type`

### 3.3 public.rpc_create_template_unit_lesson (templates)

Fuente: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`

Validación de `p_lesson_type`:

- Permite: `'text' | 'html' | 'richtext' | 'video' | 'file' | 'link'`
- Rechaza cualquier otro valor (`errcode = '22023'`)

Inserta:

- `content_type = p_lesson_type`
- `content = '{}'::jsonb`

### 3.4 public.rpc_update_template_lesson_content (templates)

Fuente: `supabase/migrations/20260109133300_073_course_template_builder_rpcs.sql`

Reglas:

- `content_type = 'text'` → `p_content_text`
- `content_type in ('html','richtext')` → `p_content_html`
- `content_type in ('video','file','link')` → `p_content_url`
- Otros valores → error `Invalid lesson_type`

## 4) Constraints / tipos reales de lesson_type

No existe enum ni check constraint en tabla para `content_type`.
Los valores reales dependen de RPCs y de datos existentes.

Validaciones observadas:

- Org create (`rpc_create_unit_lesson`):
  - `text`, `video_url`, `file`, `link`
- Org update (`rpc_update_lesson_content`):
  - `text`, `html`, `video`, `file`, `link`
- Template create (`rpc_create_template_unit_lesson`):
  - `text`, `html`, `richtext`, `video`, `file`, `link`
- Template update (`rpc_update_template_lesson_content`):
  - `text`, `html`, `richtext`, `video`, `file`, `link`

Implicación factual:

- Hay asimetría entre org create vs org update (ej. `video_url` vs `video`,
  `html`/`richtext` no contemplado en org create).

## 5) Legacy dependencies (UI/Player)

- Org editor (`v_org_lesson_detail`) consume `content_type` y expone
  `content_text/html/url` según reglas del view.
- Template editor (`v_superadmin_template_lesson_detail`) expone
  `content_text/html/url` con soporte `richtext`.
- Player (`v_lesson_player`) consume `content_type` + `content` directo.

## 6) Implicaciones para el modelo por blocks (PRO)

Hechos actuales a considerar en la migración:

- `content_type` y `content` son usados por el player y por el editor legacy.
- No hay constraints de tipo a nivel tabla; RPCs hacen la validación.
- Si se introduce `lesson_blocks`, deberá convivir con `content_type/content`
  hasta que el player y el editor consuman bloques.
- Cualquier transición debe mantener compatibilidad con:
  - `v_lesson_player` (player)
  - `v_org_lesson_detail` (editor org)
  - `v_superadmin_template_lesson_detail` (editor template)
