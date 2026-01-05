create or replace view v_course_outline as
-- cursos asignados al local (status activo)
with assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  where lc.status = 'active'
),
-- unidades + lecciones del curso
units_lessons as (
  select
    a.local_id,
    a.course_id,
    c.title as course_title,
    cu.id as unit_id,
    cu.title as unit_title,
    cu.position as unit_position,
    l.id as lesson_id,
    l.title as lesson_title,
    l.position as lesson_position
  from assigned a
  join courses c on c.id = a.course_id
  join course_units cu on cu.course_id = a.course_id
  join lessons l on l.unit_id = cu.id
),
-- completions del usuario autenticado por leccion
user_completions as (
  select
    lcpl.local_id,
    lcpl.course_id,
    lcpl.unit_id,
    lcpl.lesson_id,
    max(lcpl.completed_at) as completed_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
  group by lcpl.local_id, lcpl.course_id, lcpl.unit_id, lcpl.lesson_id
),
-- marca la primera leccion no completada del curso
course_order as (
  select
    ul.local_id,
    ul.course_id,
    ul.unit_id,
    ul.lesson_id,
    row_number() over (
      partition by ul.local_id, ul.course_id
      order by ul.unit_position, ul.lesson_position
    ) as rn,
    case when uc.lesson_id is null then 1 else 0 end as is_pending
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.lesson_id = ul.lesson_id
),
first_pending as (
  select ranked.local_id, ranked.course_id, ranked.lesson_id
  from (
    select
      co.local_id,
      co.course_id,
      co.lesson_id,
      row_number() over (
        partition by co.local_id, co.course_id
        order by co.rn
      ) as pending_rn
    from course_order co
    where co.is_pending = 1
  ) ranked
  where ranked.pending_rn = 1
),
-- agregados por unidad
unit_agg as (
  select
    ul.local_id,
    ul.course_id,
    ul.unit_id,
    count(ul.lesson_id) as unit_total_lessons,
    count(uc.lesson_id) as unit_completed_lessons
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.unit_id = ul.unit_id
   and uc.lesson_id = ul.lesson_id
  group by ul.local_id, ul.course_id, ul.unit_id
),
-- agregados por curso
course_agg as (
  select
    ul.local_id,
    ul.course_id,
    count(distinct ul.unit_id) as total_units,
    count(ul.lesson_id) as total_lessons,
    count(uc.lesson_id) as completed_lessons
  from units_lessons ul
  left join user_completions uc
    on uc.local_id = ul.local_id
   and uc.course_id = ul.course_id
   and uc.lesson_id = ul.lesson_id
  group by ul.local_id, ul.course_id
)
select
  ul.local_id,
  ul.course_id,
  ul.course_title,
  null::text as course_image_url,
  ca.total_units,
  ca.total_lessons,
  ca.completed_lessons,
  case
    when coalesce(ca.total_lessons, 0) = 0 then 0
    else round((ca.completed_lessons::numeric / nullif(ca.total_lessons, 0)) * 100)::int
  end as progress_percent,
  ul.unit_id,
  ul.unit_title,
  ul.unit_position,
  ua.unit_total_lessons,
  ua.unit_completed_lessons,
  case
    when coalesce(ua.unit_total_lessons, 0) = 0 then 0
    else round((ua.unit_completed_lessons::numeric / nullif(ua.unit_total_lessons, 0)) * 100)::int
  end as unit_progress_percent,
  case
    when ua.unit_total_lessons > 0 and ua.unit_completed_lessons = ua.unit_total_lessons then 'completed'
    when ua.unit_completed_lessons = 0 then 'pending'
    when ua.unit_completed_lessons < ua.unit_total_lessons then 'in_progress'
    else 'pending'
  end as unit_status,
  ul.lesson_id,
  ul.lesson_title,
  ul.lesson_position,
  null::int as lesson_duration_minutes,
  case
    when uc.lesson_id is not null then 'completed'
    when fp.lesson_id is not null then 'in_progress'
    else 'pending'
  end as lesson_status,
  uc.completed_at as lesson_completed_at
from units_lessons ul
left join user_completions uc
  on uc.local_id = ul.local_id
 and uc.course_id = ul.course_id
 and uc.lesson_id = ul.lesson_id
left join first_pending fp
  on fp.local_id = ul.local_id
 and fp.course_id = ul.course_id
 and fp.lesson_id = ul.lesson_id
left join unit_agg ua
  on ua.local_id = ul.local_id
 and ua.course_id = ul.course_id
 and ua.unit_id = ul.unit_id
left join course_agg ca
  on ca.local_id = ul.local_id
 and ca.course_id = ul.course_id;
