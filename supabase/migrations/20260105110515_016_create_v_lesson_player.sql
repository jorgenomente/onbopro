create or replace view v_lesson_player as
-- target lesson with unit + course
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
-- assigned courses for local
assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  where lc.status = 'active'
),
-- ordered lessons for navigation
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
-- previous/next ids by row number
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
-- completion state for auth user
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
 and comp.lesson_id = tl.lesson_id;
