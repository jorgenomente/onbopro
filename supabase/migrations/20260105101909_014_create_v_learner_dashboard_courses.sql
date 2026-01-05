create or replace view v_learner_dashboard_courses as
-- cursos asignados al local con status activo
with assigned as (
  select lc.local_id, lc.course_id
  from local_courses lc
  where lc.status = 'active'
),
-- total de lecciones por curso
course_lessons as (
  select cu.course_id, count(l.id) as total_lessons
  from course_units cu
  join lessons l on l.unit_id = cu.id
  group by cu.course_id
),
-- completions del usuario autenticado por local y curso
user_completions as (
  select lcpl.local_id,
         lcpl.course_id,
         count(*) as completed_lessons,
         max(lcpl.completed_at) as last_activity_at
  from lesson_completions lcpl
  where lcpl.user_id = auth.uid()
  group by lcpl.local_id, lcpl.course_id
),
-- primera unidad con al menos una leccion pendiente (por orden)
current_unit as (
  select ranked.local_id,
         ranked.course_id,
         ranked.unit_id,
         ranked.unit_title
  from (
    select lc.local_id,
           cu.course_id,
           cu.id as unit_id,
           cu.title as unit_title,
           row_number() over (
             partition by lc.local_id, cu.course_id
             order by cu.position
           ) as rn
    from local_courses lc
    join course_units cu on cu.course_id = lc.course_id
    join lessons l on l.unit_id = cu.id
    left join lesson_completions lcpl
      on lcpl.lesson_id = l.id
     and lcpl.user_id = auth.uid()
     and lcpl.local_id = lc.local_id
    where lc.status = 'active'
    group by lc.local_id, cu.course_id, cu.id, cu.title, cu.position
    having count(l.id) > count(lcpl.id)
  ) ranked
  where ranked.rn = 1
)
select
  a.local_id,
  a.course_id,
  c.title as course_title,
  null::text as course_image_url,
  case
    when coalesce(cl.total_lessons, 0) = 0 then 'pending'
    when coalesce(uc.completed_lessons, 0) = 0 then 'pending'
    when uc.completed_lessons < cl.total_lessons then 'in_progress'
    else 'completed'
  end as course_status,
  coalesce(cl.total_lessons, 0) as total_lessons,
  coalesce(uc.completed_lessons, 0) as completed_lessons,
  case
    when coalesce(cl.total_lessons, 0) = 0 then 0
    else round((coalesce(uc.completed_lessons, 0)::numeric / nullif(cl.total_lessons, 0)) * 100)::int
  end as progress_percent,
  uc.last_activity_at,
  case
    when coalesce(cl.total_lessons, 0) > 0
      and uc.completed_lessons = cl.total_lessons
      then uc.last_activity_at
    else null
  end as completed_at,
  cu.unit_id as current_unit_id,
  cu.unit_title as current_unit_title,
  null::int as estimated_minutes_left
from assigned a
join courses c on c.id = a.course_id
left join course_lessons cl on cl.course_id = a.course_id
left join user_completions uc
  on uc.local_id = a.local_id
 and uc.course_id = a.course_id
left join current_unit cu
  on cu.local_id = a.local_id
 and cu.course_id = a.course_id;
