# Quiz Contract Verification (2026-01-12)

## Hallazgos

- `rpc_quiz_submit` usa `pass_score_pct` y no referencia `pass_percent` en la migracion nueva.
- `v_quiz_state` expone `pass_score_pct` y `time_limit_min` y mantiene aliases `pass_percent` y `time_limit_minutes`.
- No hay literales `null::int` para esos campos en el view nuevo.
- Referencias legacy restantes aparecen solo en migraciones historicas y documentos; no en el runtime del player.

## Evidencias (paths + snippets cortos)

- RPC canonicamente alineado:
  - `supabase/migrations/20260112134500_090_update_rpc_quiz_submit_pass_score_pct.sql`

  ```sql
  select q.pass_score_pct::int
    into v_pass_score_pct
  from public.quizzes q
  where q.id = v_attempt.quiz_id;

  v_threshold := coalesce(v_pass_score_pct, 70);
  ```

- View con campos canonicos + aliases:
  - `supabase/migrations/20260112134600_091_update_v_quiz_state_canonical.sql`

  ```sql
  qa.time_limit_min,
  qa.pass_score_pct,
  qa.time_limit_min as time_limit_minutes,
  qa.pass_score_pct as pass_percent,
  ```

- Player consume canonicamente:
  - `app/l/[localId]/quizzes/[quizId]/page.tsx`

  ```ts
  time_limit_min: number | null;
  pass_score_pct: number | null;
  ```

- Referencias legacy detectadas (no runtime):
  - `supabase/migrations/20260105214555_019_recreate_v_quiz_state.sql` (null::int legacy)
  - `supabase/migrations/20260106120000_055_update_learner_views_assignment_enforcement.sql` (null::int legacy)
  - `supabase/migrations/20260106000520_022_rpc_quiz_start_answer_submit.sql` (pass_percent legacy)
  - Docs: `docs/screens/quiz-player.md`, `docs/ops/smoke/quiz-contract-smoke.md`, `docs/audit/quiz-system-context.md`, `docs/ops-log.md`

## Riesgos

- Migraciones historicas aun contienen `pass_percent`/`time_limit_minutes`; no afectan runtime pero pueden confundir auditorias futuras.
- Aliases legacy en `v_quiz_state` deben retirarse en fecha acordada para evitar deuda perpetua.

## Next steps

- Definir fecha de retiro de aliases `pass_percent` y `time_limit_minutes` (ya hay TODO en el view).
- (Opcional) documentar en `docs/ops-log.md` cuando se retire compat legacy.
