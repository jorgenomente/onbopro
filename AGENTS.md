# AGENTS.md — ONBO

Este archivo define las **reglas obligatorias de trabajo** para Codex CLI en el proyecto ONBO.
Debe leerse y cumplirse **antes de proponer o escribir** cualquier cambio.

---

## 1. Golden Rule (source of truth)

Before proposing or writing **any** of the following:

- SQL migrations
- RLS policies
- SECURITY DEFINER helpers
- Triggers / constraints
- Views / reporting queries
- Onboarding / provisioning logic

You MUST read and follow these documents (source of truth):

1. docs/schema-guide.md
2. docs/rls-cheatsheet.md
3. docs/integrity-rules.md
4. docs/onboarding-provisioning.md
5. docs/query-patterns.md
6. docs/migrations-playbook.md

If something conflicts:

- **Docs win**
- Update the docs first, then implement

Never implement behavior that is not described or compatible with these docs.

---

## 2. Scope & roles (DO NOT MIX)

Roles are strictly scoped:

### Global

- superadmin → `profiles.is_superadmin`

### Organization level (`org_memberships`)

- `org_admin`
- `member`

### Local level (`local_memberships`)

- `referente`
- `aprendiz`

Rules:

- Never mix org roles into local tables
- Never mix local roles into org tables
- Permissions are derived by scope, not by convenience

---

## 3. Security & RLS requirements

Mandatory rules:

- The database is the **source of truth** for permissions
- All business tables must have **RLS enabled**
- Use `SECURITY DEFINER` helpers for permission checks
- Policies must be:
  - simple
  - readable
  - auditable
- **NO DELETE policies** on business tables
  - Use `status`, `ended_at`, or `archived_at`

### Progress rules (critical)

- Progress tables are **own-only write**
- Never write progress on behalf of another user
- Read access:
  - aprendiz → OWN
  - referente → LOCAL
  - org_admin → ORG
  - superadmin → GLOBAL

---

## 4. Migration discipline (mandatory)

- One migration = one concern
- Do not mix:
  - schema
  - constraints
  - RLS
  - views
    in the same migration unless explicitly required

Always follow:

- docs/migrations-playbook.md

## Lockfile discipline

- The canonical lockfile is `onbopro/package-lock.json`.
- Do not create or commit lockfiles outside the repo root (e.g. `~/package-lock.json`).

For every migration:

- Add required constraints
- Add supporting indexes for RLS predicates
- Add integrity triggers when redundancy exists (`org_id`, `local_id`, etc.)
- Never rely on frontend filtering

---

## 5. Onboarding & provisioning

- Invitations represent **intention**, not access
- Memberships represent **actual access**
- Accepting invitations must be done via:
  - Edge Function
  - Service Role (bypass RLS)
- Invitation preview by token must NOT rely on RLS
- Provisioning must be **idempotent**

Follow:

- docs/onboarding-provisioning.md

---

## 6. Query & reporting rules

- Never invent ad-hoc queries without checking:
  - docs/query-patterns.md
- Prefer SQL views for dashboards
- Always scope queries by:
  - `org_id`
  - `local_id` (when applicable)
- Never “fetch all and filter in JS”

---

## 7. Operational log (MANDATORY)

For **every task** that modifies:

- schema
- migrations
- RLS
- helpers
- triggers
- views
- provisioning logic

You MUST append a log entry to:

- `docs/ops-log.md`

Rules:

1. Append only (never overwrite)
2. Use the existing template
3. Include:
   - timestamp (ISO 8601)
   - goal
   - files changed (exact paths)
   - summary of changes
   - docs consulted
   - validation checklist
   - notes / follow-ups

If a migration is created, the migration filename MUST be listed.

---

## 8. Expected response format

When producing work, prefer structured output.

For non-trivial tasks, use:

### PROMPT PARA CODEX CLI

- Contexto
- Objetivo
- Tareas
- Resultados esperados
- Restricciones
- Información adicional

Deliverables should be:

- copy-paste ready
- deterministic
- aligned with the docs

---

## 9. What NOT to do

- ❌ Do not bypass RLS “for convenience”
- ❌ Do not invent roles or permissions
- ❌ Do not delete business data
- ❌ Do not write SQL without constraints
- ❌ Do not modify the data model without updating docs
- ❌ Do not rely on UI to enforce security

---

## 10. Final rule

If a decision is not documented, **it is not allowed**.

Update the documentation first.
Then implement.

## Smoke Tests & RLS Data

ONBO utiliza **usuarios y datos reales de Supabase Auth** para validar
Row Level Security mediante smoke tests.

La **fuente de verdad** para estos datos es:

- `docs/testing-reference.md`

Antes de:

- modificar `scripts/rls-smoke-tests.mjs`
- crear seeds de desarrollo
- refactorizar tests RLS
- eliminar o recrear usuarios de test

👉 **Consultar obligatoriamente** `docs/testing-reference.md`.

No se deben:

- inventar UIDs
- hardcodear IDs fuera de testing
- mover estos datos a migraciones SQL

Rule of thumb:

- Every user-facing screen must be backed by a dedicated SQL view
- Frontend must not query base tables directly

SQL view naming convention:

- v*<role>*<screen>\_<purpose>
  Examples:
- v_learner_dashboard_courses
- v_referente_local_progress
- v_org_admin_roster

## Screen Wiring Rules (MANDATORY)

The following rules are mandatory for ONBO and apply to ALL agents
(ChatGPT, Codex CLI, humans):

### 1. One Screen = One View (READ)

- Each UI screen MUST read from exactly ONE SQL view.
- UI must NEVER join data logically or fetch from multiple sources.
- If navigation requires an ID (e.g. quiz_id), that ID MUST be exposed by the screen’s view.

### 2. Writes are Explicit

- All writes must be:
  - direct inserts/updates under strict RLS, OR
  - RPCs (SECURITY DEFINER) with server-side validation.
- UI must never “assume” write permissions.

### 3. Deterministic Navigation

- If a screen links to another screen, the linking ID must be:
  - deterministic
  - guaranteed by schema constraints (e.g. unique indexes)
- No frontend heuristics to “guess” targets.

### 4. Views Are Wiring Contracts

- Views are not only data providers but navigation contracts.
- If a screen needs to link elsewhere, the view must expose the necessary IDs.

### 5. No Hidden State in UI

- UI state must be derived exclusively from:
  - view columns
  - nullability
  - explicit enums (e.g. attempt_status)
- Never invent can\_\* flags in frontend.

Violations of these rules require updating the docs BEFORE implementation.

⚠️ Security note:
Scripts under /scripts load .env.local and may use SERVICE_ROLE keys.
They are intended for local dev / CI only and must never be executed
in client-side or production runtime contexts.
