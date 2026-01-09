drop view if exists public.v_org_lesson_detail;
drop view if exists public.v_superadmin_template_lesson_detail;
drop view if exists public.v_lesson_player;

create view public.v_org_lesson_detail as
select
  c.org_id,
  c.id as course_id,
  cu.id as unit_id,
  l.id as lesson_id,
  l.title as lesson_title,
  l.content_type::text as lesson_type,
  case
    when l.content_type = 'text' then l.content->>'text'
    else null
  end as content_text,
  case
    when l.content_type = 'html' then l.content->>'html'
    else null
  end as content_html,
  case
    when l.content_type in ('video', 'file', 'link') then l.content->>'url'
    else null
  end as content_url,
  coalesce(blocks.blocks, '[]'::jsonb) as blocks,
  l.is_required,
  l.estimated_minutes,
  l.position,
  l.updated_at
from public.lessons l
join public.course_units cu on cu.id = l.unit_id
join public.courses c on c.id = cu.course_id
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
  from public.lesson_blocks b
  where b.lesson_id = l.id
    and b.archived_at is null
) blocks on true
where
  public.rls_is_superadmin()
  or public.rls_is_org_admin(c.org_id);

create view public.v_superadmin_template_lesson_detail as
select
  null::uuid as org_id,
  ct.template_id as course_id,
  u.unit_id,
  l.lesson_id,
  l.title as lesson_title,
  l.content_type::text as lesson_type,
  case
    when l.content_type = 'text' then l.content->>'text'
    else null
  end as content_text,
  case
    when l.content_type in ('html', 'richtext')
      then coalesce(l.content->>'html', l.content->>'text')
    else null
  end as content_html,
  case
    when l.content_type in ('video', 'file', 'link') then l.content->>'url'
    else null
  end as content_url,
  coalesce(blocks.blocks, '[]'::jsonb) as blocks,
  l.is_required,
  l.estimated_minutes,
  l.position,
  l.updated_at
from public.course_template_lessons l
join public.course_template_units u on u.unit_id = l.unit_id
join public.course_templates ct on ct.template_id = u.template_id
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
  from public.course_template_lesson_blocks b
  where b.lesson_id = l.lesson_id
    and b.archived_at is null
) blocks on true
where public.rls_is_superadmin();

create view v_lesson_player as
with target_lesson as (
  select
    l.id as lesson_id,
    l.title as lesson_title,
    l.position as lesson_position,
    l.content_type,
    l.content,
    cu.id as unit_id,
    cu.title as unit_title,
    cu.position as unit_position,
    c.id as course_id,
    c.title as course_title
  from lessons l
  join course_units cu on cu.id = l.unit_id
  join courses c on c.id = cu.course_id
),
memberships as (
  select lm.local_id
  from local_memberships lm
  where lm.user_id = auth.uid()
    and lm.status = 'active'
    and lm.role = 'aprendiz'
),
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  join memberships m on m.local_id = lc.local_id
  where lc.status = 'active'
),
ordered_lessons as (
  select
    a.local_id,
    tl.course_id,
    tl.unit_id,
    tl.lesson_id,
    row_number() over (
      partition by a.local_id, tl.course_id
      order by tl.unit_position, tl.lesson_position
    ) as rn
  from assigned a
  join target_lesson tl on tl.course_id = a.course_id
),
nav as (
  select
    ol.local_id,
    ol.course_id,
    ol.lesson_id,
    prev.lesson_id as prev_lesson_id,
    nxt.lesson_id as next_lesson_id
  from ordered_lessons ol
  left join ordered_lessons prev
    on prev.local_id = ol.local_id
   and prev.course_id = ol.course_id
   and prev.rn = ol.rn - 1
  left join ordered_lessons nxt
    on nxt.local_id = ol.local_id
   and nxt.course_id = ol.course_id
   and nxt.rn = ol.rn + 1
),
completion as (
  select
    lcpl.local_id,
    lcpl.lesson_id,
    lcpl.completed_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
)
select
  a.local_id,
  tl.course_id,
  tl.course_title,
  null::text as course_image_url,
  tl.unit_id,
  tl.unit_title,
  tl.unit_position,
  tl.lesson_id,
  tl.lesson_title,
  tl.lesson_position,
  tl.content_type,
  tl.content,
  coalesce(blocks.blocks, '[]'::jsonb) as blocks,
  (comp.lesson_id is not null) as is_completed,
  comp.completed_at,
  (comp.lesson_id is null) as can_mark_complete,
  nav.prev_lesson_id,
  nav.next_lesson_id
from assigned a
join target_lesson tl
  on tl.course_id = a.course_id
join nav
  on nav.local_id = a.local_id
 and nav.course_id = tl.course_id
 and nav.lesson_id = tl.lesson_id
left join completion comp
  on comp.local_id = a.local_id
 and comp.lesson_id = tl.lesson_id
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
