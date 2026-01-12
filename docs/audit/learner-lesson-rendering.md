# Learner lesson rendering audit

## 1) Conclusiones directas (Sí/No)

- **1. Renderiza `lesson_blocks` por tipo?** **No.** El learner usa `lesson.content_type` + `lesson.content` y **no** itera `lesson.blocks`.
- **2. Existe renderer reusable de blocks?** **No.** No hay `LessonBlocksRenderer` ni `renderBlock` en `app`/`components`.
- **3. Tipos `block_type` soportados por el learner?** **Ninguno en runtime** (no hay switch/map por `block_type`).
- **4. Fallback legacy?** **Sí.** Renderiza `content_type` (`video`/`html`/`text`) y fallback por `content.url`.
- **5. View usada por learner?** **Sí.** `v_lesson_player` se consulta directamente en la page.

## 2) Evidencia: fetch y render en el player

**Archivo**: `app/l/[localId]/lessons/[lessonId]/page.tsx`

```tsx
// app/l/[localId]/lessons/[lessonId]/page.tsx:45-81
const { data, error: fetchError } = await supabase
  .from('v_lesson_player')
  .select('*')
  .eq('local_id', localId)
  .eq('lesson_id', lessonId)
  .maybeSingle();
```

```tsx
// app/l/[localId]/lessons/[lessonId]/page.tsx:108-145
const renderContent = () => {
  if (!lesson) return null;
  const content = lesson.content ?? {};

  if (lesson.content_type === 'video' && typeof content.url === 'string') {
    return (
      <video className="w-full rounded-2xl" controls>
        <source src={content.url} />
      </video>
    );
  }

  if (lesson.content_type === 'html' && typeof content.html === 'string') {
    return (
      <div
        className="prose max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    );
  }

  if (lesson.content_type === 'text' && typeof content.text === 'string') {
    return <p className="text-sm text-zinc-700">{content.text}</p>;
  }

  if (typeof content.url === 'string') {
    return (
      <a className="text-sm text-zinc-900 underline" href={content.url}>
        Abrir contenido
      </a>
    );
  }

  return (
    <pre className="rounded-2xl bg-zinc-100 p-4 text-xs text-zinc-600">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
};
```

**Lectura**: no hay referencia a `lesson.blocks` ni a `block_type` en el player.

## 3) Evidencia: `v_lesson_player` expone `blocks` pero no se consume

**Archivo**: `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`

```sql
-- supabase/migrations/20260109115806_077_views_lesson_blocks.sql:164-206
select
  a.local_id,
  tl.course_id,
  tl.course_title,
  ...
  tl.content_type,
  tl.content,
  coalesce(blocks.blocks, '[]'::jsonb) as blocks,
  ...
from assigned a
join target_lesson tl on tl.course_id = a.course_id
...
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'block_id', b.block_id,
      'block_type', b.block_type,
      'data', b.data,
      'position', b.position
    )
    order by b.position, b.block_id
  ) as blocks
  from lesson_blocks b
  where b.lesson_id = tl.lesson_id
    and b.archived_at is null
) blocks on true;
```

**Lectura**: la view ya entrega `blocks`, pero el UI learner no los renderiza.

## 4) Block types soportados por el learner (hoy)

- **Ninguno**: no hay `switch/map` de `block_type` en `app/l` ni en `components`.
- Los únicos tipos renderizados son **legacy** por `lesson.content_type`: `video`, `html`, `text` (y fallback `content.url`).

## 5) Renderer reusable

- No se encontró `LessonBlocksRenderer`, `BlocksRenderer` ni función `renderBlock` en `app`/`components`.
- Todo el render de contenido está inline en `app/l/[localId]/lessons/[lessonId]/page.tsx`.

## 6) Fallback legacy

- Si no hay blocks, **siempre** se renderiza por `content_type` + `content`.
- Existe `dangerouslySetInnerHTML` para `content_type === 'html'`.

## 7) Viabilidad mínima para `richtext` (diagnóstico, sin implementar)

- **Hoy** el player ignora `blocks`; para soportar un nuevo `block_type` (ej. `richtext`) habría que:
  - Implementar un renderer para `lesson.blocks` (nuevo componente reusable recomendado en `components/learner/LessonBlocksRenderer.tsx`).
  - Mapear `block_type` a componentes (incluyendo `richtext` con `dangerouslySetInnerHTML` o render seguro).
  - Decidir fallback: si `blocks` está vacío, mantener el render legacy por `content_type`.
- Alternativa mínima (más limitada): extender `renderContent()` para `content_type === 'richtext'` (solo legacy), sin tocar blocks.

## 8) Archivos relevantes (paths verificables)

- `app/l/[localId]/lessons/[lessonId]/page.tsx`
- `supabase/migrations/20260109115806_077_views_lesson_blocks.sql`
