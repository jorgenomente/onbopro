# Learner Dashboard Mismatch Audit

## Context

Learner `info.cosmicst@gmail.com` sees courses as "COMPLETADO 100%" in `/l/[localId]/dashboard` despite being a new user. SQL checks show 0 progress rows.

## Identity

- Email: info.cosmicst@gmail.com
- user_id: c6601829-d56c-4f2c-bdef-d6c054897454
- local_id tested: ff25dced-0b32-4cb0-bfa4-7cf8b67448a9

## SQL (simulated auth.uid)

Executed with:

```
begin;
select set_config('request.jwt.claims', '{"sub":"c6601829-d56c-4f2c-bdef-d6c054897454","role":"authenticated"}', true);
select
  local_id,
  course_id,
  course_title,
  course_status,
  total_lessons,
  completed_lessons,
  progress_percent,
  last_activity_at,
  completed_at,
  current_unit_id,
  current_unit_title
from public.v_learner_dashboard_courses
where local_id = 'ff25dced-0b32-4cb0-bfa4-7cf8b67448a9'
order by course_title;
rollback;
```

Result:

```
local_id                              | course_id                               | course_title               | course_status | total_lessons | completed_lessons | progress_percent | last_activity_at | completed_at | current_unit_id                         | current_unit_title
--------------------------------------+-----------------------------------------+----------------------------+---------------+---------------+-------------------+------------------+------------------+--------------+------------------------------------------+-------------------
ff25dced-0b32-4cb0-bfa4-7cf8b67448a9 | d0411794-f012-4a16-b1b6-3a9bd9d594f7    | Curso de Camarero Prueba  | pending       | 2             | 0                 | 0                |                  |              | 538c73c3-6699-46f4-942c-832b953e9779     | La empresa prueba
ff25dced-0b32-4cb0-bfa4-7cf8b67448a9 | e0e4215d-b316-4e90-8be1-97d820d346ac    | Prueba 1                  | pending       | 1             | 0                 | 0                |                  |              | 110dfa9f-11e7-4dba-ad02-249b375c3f37     | Bienvenida
```

## DB progress tables

- lesson_completions: 0 rows for user_id
- quiz_attempts: 0 rows for user_id

## Frontend mapping

- Page: `app/l/[localId]/dashboard/page.tsx`
  - Query: `supabase.from('v_learner_dashboard_courses').select('*').eq('local_id', localId)`
  - UI uses:
    - `course.course_status` -> `formatStatusLabel` (`lib/learner/formatters.ts`)
    - `course.progress_percent` to render progress bar + "{progress}% completado"
  - No fallback that forces 100% or completed when progress_percent is null.

## Conclusion

- The view returns `pending` and `progress_percent = 0` for the specified user and local.
- The UI reads the view output directly with no override logic.

### Most likely causes (not confirmed in DB)

- The frontend session user is not the expected user_id.
- The local_id in the route is different from the tested local_id.
- The client is rendering stale data from a different local/session.

## Next check (recommended)

- Inspect the Network response for `/rest/v1/v_learner_dashboard_courses?local_id=...` while logged in as the learner to confirm real payload.
- Verify `session.user.id` in the browser matches `c6601829-d56c-4f2c-bdef-d6c054897454`.
- Confirm the local selector is using the intended local_id.
