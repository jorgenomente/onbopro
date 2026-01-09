# Screens → Views Map

## Lote 0 (Auth + bootstrap)

- / → public.v_my_context + public.v_my_locals
- /select-local → public.v_my_locals

## Lote 1 (Aprendiz)

- /l/[localId]/dashboard → public.v_learner_dashboard_courses
- /l/[localId]/courses/[courseId] → public.v_course_outline
- /l/[localId]/lessons/[lessonId] → public.v_lesson_player
- /l/[localId]/quizzes/[quizId] → public.v_quiz_state

## Referente (Lote 2)

- /l/[localId]/ref/dashboard → public.v_ref_dashboard
- /l/[localId]/ref/learners → public.v_ref_learners
- /l/[localId]/ref/learners/[learnerId] → public.v_ref_learner_detail

## Org Admin (Lote 3)

- /org/dashboard → public.v_org_dashboard
- /org/locals/[localId] → public.v_org_local_detail
- /org/learners/[learnerId] → public.v_org_learner_detail
- /org/alerts → public.v_org_alerts

## Org Admin — Course Builder (Lote 4)

- /org/courses → public.v_org_courses
- /org/courses/[courseId]/outline → public.v_org_course_outline
- /org/courses/[courseId]/lessons/[lessonId]/edit → public.v_org_lesson_detail
- /org/courses/[courseId]/quizzes/[quizId]/edit → public.v_org_quiz_detail
- /org/locals/[localId]/courses → public.v_org_local_courses

## Org Admin — Invitations

- /org/locals/[localId]/members/invite → public.v_org_local_context + Edge Function: provision_local_member
- /org/invitations → public.v_org_invitations + Edge Function: resend_invitation
- /auth/accept-invitation → public.v_invitation_public + Edge Function: accept_invitation

## Superadmin (MVP)

- /superadmin/organizations → public.v_superadmin_organizations
- /superadmin/organizations/[orgId] → public.v_superadmin_organization_detail
- /superadmin/organizations/[orgId] (org admins mgmt) → public.v_superadmin_organization_detail + Edge Function: provision_org_admin + rpc_superadmin_set_org_membership_status + Edge Function: resend_invitation
- /superadmin/organizations/new → rpc_create_organization
- /superadmin/organizations/[orgId]/locals/new → rpc_create_local
- /superadmin/locals/[localId]/members → public.v_superadmin_local_members + public.v_superadmin_local_invitations + rpc_superadmin_set_local_membership_status + Edge Function: resend_invitation
- /superadmin/locals/[localId]/members/new → public.v_superadmin_local_context + rpc_superadmin_add_local_member + Edge Function: provision_local_member (fallback)
