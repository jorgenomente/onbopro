# Auditoría — Local status (Org Admin)

## 1. UI source of truth

- Route: `/org/dashboard`
- File: `app/org/dashboard/page.tsx`
- Data source:
  - `supabase.from('v_org_dashboard').select('*').single()`
- UI uses:
  - `local.status` for badge label + color
  - `local.completion_rate_pct` for progress bar
  - `local.risk_reason` for at_risk explanations
  - `risk_learners_count`, `in_progress_learners_count`, `completed_learners_count`, `not_started_learners_count`

## 2. Data contract and mapping

- The UI expects `locals` from the view with fields:
  - `local_id`, `local_code`, `local_name`
  - `status` (`at_risk` | `not_started` | `in_progress` | `completed` | `inactive`)
  - `learners_count`, `referentes_count`, `active_courses_count`
  - `completion_rate_pct`
  - `risk_reason` (`stalled_learners` | `no_activity_yet` | null)
  - `risk_learners_count`, `in_progress_learners_count`, `completed_learners_count`, `not_started_learners_count`

## 3. SQL definition (view)

- View: `public.v_org_dashboard`
- Latest definition: `supabase/migrations/20260110153000_089_update_v_org_dashboard_learner_statuses.sql`

## 4. Columns used in the status calculation

Computed in CTEs:

- `learners` from `local_memberships`
- `active_courses_count` from `local_courses` (status = active)
- `assigned_lessons` from `local_courses` + `course_units` + `lessons`
- `learner_completion` from `lesson_completions`
- `quiz_submits_per_learner` from `quiz_attempts`
- `learner_state` derived per learner

Base tables involved:

- `local_memberships`
- `local_courses`
- `course_units`
- `lessons`
- `lesson_completions`
- `quiz_attempts`
- `locals`

## 5. Current rule set (plain language)

Learner-level classification (per local):

- **completed**: completed_lessons >= total_lessons
- **not_started**: total_lessons > 0, completed_lessons = 0, last_activity_at is null
- **at_risk**: progress < 100% and last_activity_at < now() - 14 days
- **in_progress**: progress < 100% and last_activity_at >= now() - 14 days

Local status:

- **inactive** if the local is archived.
- **not_started** if learners > 0, active_courses > 0, and last_activity_at is null.
- **at_risk** if risk_learners_count > 0.
- **completed** if learners > 0, active_courses > 0, and completed_learners_count = learners_count.
- **in_progress** otherwise (including no learners or no assignments).

Risk reasons:

- `stalled_learners` when status = at_risk
- `no_activity_yet` when status = not_started

## 6. Why a local can look “At Risk”

Based on SQL:

- At least one learner is stale: last activity older than 14 days while not completed.
- The local can still have other learners progressing; the status is driven by the presence of any risk learners.

## 7. Change surface (where to modify)

- **SQL view**: `public.v_org_dashboard` (CTEs `learner_state` and `local_status`)
- **UI**: `app/org/dashboard/page.tsx` only maps `status` and counts
- **No RPCs** involved

## 8. Safe modification plan (no code yet)

1. Adjust learner-level thresholds (e.g., 14 days) inside `learner_state`.
2. Adjust local status precedence in `local_status` (e.g., completed vs at_risk ordering).
3. Update UI mapping if new labels or fields are introduced.

## 9. Evidence paths

- UI: `app/org/dashboard/page.tsx`
- View: `supabase/migrations/20260110153000_089_update_v_org_dashboard_learner_statuses.sql`
