# ONBO — RLS Cheatsheet (Supabase Postgres)

Este documento es una guía operativa para implementar y auditar **Row Level Security (RLS)** en ONBO.  
Objetivo: policies **simples, legibles y consistentes**, con helpers `SECURITY DEFINER` y sin lógica “oculta” en la app.

---

## 0) Principios de diseño

1. **La DB es la fuente de verdad** de permisos.
2. Evitar policies con joins complejos; preferir helpers `SECURITY DEFINER` + `org_id` redundante.
3. Prohibir `DELETE` en tablas de negocio: usar `archived_at` / `status`.
4. Progreso (`lesson_completions`, `quiz_attempts`, `quiz_answers`, `quiz_attempt_questions`) es **own-only write**.
5. Lectura de progreso:
   - aprendiz: OWN
   - referente: LOCAL
   - org_admin: ORG
   - superadmin: GLOBAL

---

## 1) Helpers (SECURITY DEFINER)

> Recomendación: concentrar todos los helpers en `public.rls_*` y usar `set search_path = public`.

### Identidad y roles

- `rls_is_superadmin() -> boolean`
- `rls_is_org_admin(p_org_id uuid) -> boolean`
- `rls_is_org_member(p_org_id uuid) -> boolean`
- `rls_is_local_member(p_local_id uuid) -> boolean`
- `rls_is_local_referente(p_local_id uuid) -> boolean`

### Helpers de acceso a contenido asignado

- `rls_local_has_course(p_local_id uuid, p_course_id uuid) -> boolean`
- `rls_user_has_course_in_local(p_local_id uuid, p_course_id uuid) -> boolean`
  - implica: user es miembro activo del local + local_courses activo para course

### Helpers de consistencia para progreso

- `rls_user_can_write_progress(p_org_id uuid, p_local_id uuid) -> boolean`
  - implica: user es miembro activo del local (y el local pertenece al org)

---

## 2) Habilitar RLS (todas las tablas)

> Recomendación: habilitar RLS por defecto y luego ir abriendo por policies.

Tablas:

- `profiles`
- `organizations`
- `locals`
- `org_memberships`
- `local_memberships`
- `invitations`
- `courses`
- `course_units`
- `lessons`
- `quizzes`
- `quiz_questions`
- `quiz_options`
- `local_courses`
- `lesson_completions`
- `quiz_attempts`
- `quiz_answers`
- `quiz_attempt_questions`
- `lesson_blocks` (planned)
- `course_template_lesson_blocks` (planned)

---

## 3) Matriz de acceso (resumen)

| Tabla                  | Select                                                               | Insert                 | Update                        | Delete |
| ---------------------- | -------------------------------------------------------------------- | ---------------------- | ----------------------------- | ------ |
| profiles               | self + superadmin                                                    | (service role)         | self (limitado)               | ❌     |
| organizations          | member(org) + superadmin                                             | superadmin             | org_admin(org) + superadmin   | ❌     |
| locals                 | local_member + org_admin(org) + superadmin                           | org_admin + superadmin | org_admin + superadmin        | ❌     |
| org_memberships        | self + org_admin + superadmin                                        | org_admin + superadmin | org_admin + superadmin        | ❌     |
| local_memberships      | self + referente(local) + org_admin + superadmin                     | org_admin + superadmin | org_admin + superadmin        | ❌     |
| invitations            | org*admin + superadmin *(y opcional lookup por token via endpoint)\_ | org_admin + superadmin | org_admin + superadmin        | ❌     |
| courses/content        | assigned-local members + org_admin(org) + superadmin                 | org_admin + superadmin | org_admin + superadmin        | ❌     |
| local_courses          | local members + org_admin + superadmin                               | org_admin + superadmin | org_admin + superadmin        | ❌     |
| lesson_completions     | own + referente(local) + org_admin + superadmin                      | own-only               | ❌ (o own-only)               | ❌     |
| quiz_attempts          | own + referente(local) + org_admin + superadmin                      | own-only               | ❌ (o own-only before submit) | ❌     |
| quiz_answers           | own + referente(local) + org_admin + superadmin                      | own-only               | ❌                            | ❌     |
| quiz_attempt_questions | own + referente(local) + org_admin + superadmin                      | own-only               | ❌                            | ❌     |
| lesson_blocks          | org*admin + superadmin *(player lee por view)\_ (planned)            | org_admin + superadmin | org_admin + superadmin        | ❌     |
| template_blocks        | superadmin only (planned)                                            | superadmin only        | superadmin only               | ❌     |

---

## 4) Policies por tabla (canónico)

> Nota: los nombres de policies son ejemplos; mantener naming consistente.

### 4.1 profiles

**Select**

- self: `user_id = auth.uid()`
- superadmin: `rls_is_superadmin()`

**Update**

- self update limitado (ej: full_name)
- `with check user_id = auth.uid()`

No permitir insert por cliente (lo crea provisioning).

---

### 4.2 organizations

**Select**

- `rls_is_superadmin() OR rls_is_org_member(id)`

**Insert**

- `rls_is_superadmin()`

**Update**

- `rls_is_superadmin() OR rls_is_org_admin(id)`

**Delete**

- prohibido (solo archive mediante update)

---

### 4.3 locals

**Select**

- `rls_is_superadmin() OR rls_is_org_admin(org_id) OR rls_is_local_member(id)`

**Insert/Update**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Delete**

- prohibido

---

### 4.4 org_memberships

**Select**

- `rls_is_superadmin() OR rls_is_org_admin(org_id) OR user_id = auth.uid()`

**Insert/Update**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Delete**

- prohibido

---

### 4.5 local_memberships

**Select**

- `rls_is_superadmin() OR rls_is_org_admin(org_id) OR user_id = auth.uid() OR rls_is_local_referente(local_id)`

**Insert/Update**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Delete**

- prohibido

> Nota: si más adelante permitís que referente invite/gestione solo aprendices de su local, se agrega una policy acotada (no recomendada para core).

---

### 4.6 invitations

**Objetivo**

- Solo org_admin/superadmin pueden ver y gestionar invitaciones.
- “Ver invitación por token antes de aceptar” se recomienda vía **Edge Function pública** (no por RLS).

**Select**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Insert/Update**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Delete**

- prohibido (revocar = status)

**Aceptación**

- No por policy (service role / function).

---

## 5) Contenido (courses, units, lessons, quizzes, questions, options)

### Reglas de lectura de contenido

Un usuario puede leer contenido si cumple al menos una:

- `rls_is_superadmin()`
- `rls_is_org_admin(org_id)`
- Está en un local (miembro activo) que tiene asignado el curso (`local_courses.status='active'`) y el contenido pertenece al curso.

Para mantener policies simples:

- En `courses`: validar asignación por `course_id`.
- En `course_units/lessons/quizzes/...`: normalmente se permite read si:
  - org_admin/superadmin
  - o existe un `local_courses` activo para algún local del usuario que referencie el `course_id` correspondiente.

**Insert/Update**

- solo org_admin/superadmin.

**Delete**

- prohibido (archivar).

> Implementación práctica:
>
> - `courses` tiene `id` y `org_id`.
> - `course_units` y `lessons` NO tienen `course_id` directo (lessons solo unit_id). Si querés RLS más simple y rápida, es válido **redundar `course_id`** también en `course_units` y `lessons` (opcional, recomendado para performance).
> - Si no redundás, vas a depender de joins en helpers (igual válido pero más costoso).

### 5.1 Bloques de lección (planned)

**Select**

- Recomendado: solo org_admin/superadmin en tabla.
- Player debe leer por view (v_lesson_player o similar extendida).

**Insert/Update**

- `rls_is_superadmin()` o `can_manage_course(course_id)` según scope.

**Delete**

- prohibido (archivar).

---

## 6) local_courses

**Select**

- `rls_is_superadmin() OR rls_is_org_admin(org_id) OR rls_is_local_member(local_id)`

**Insert/Update**

- `rls_is_superadmin() OR rls_is_org_admin(org_id)`

**Delete**

- prohibido (usar status)

---

## 7) Progreso (lesson_completions, quiz_attempts, quiz_answers)

### 7.1 lesson_completions

**Select**

- `rls_is_superadmin()`
- `rls_is_org_admin(org_id)`
- `rls_is_local_referente(local_id)`
- `user_id = auth.uid()`

**Insert (own-only)**

- `user_id = auth.uid()`
- y `rls_user_can_write_progress(org_id, local_id)` (user es miembro activo del local)
- y opcional: el curso debe estar asignado al local (`rls_user_has_course_in_local(local_id, course_id)`)

**Update**

- recomendado: NO update (si necesitás correcciones, hacerlo con service role)

**Delete**

- prohibido

---

### 7.2 quiz_attempts

**Select**

- igual que lesson_completions (own + referente/local + org_admin/org + superadmin)

**Insert (own-only)**

- `user_id = auth.uid()`
- `rls_user_can_write_progress(org_id, local_id)`
- opcional: validar que quiz pertenece al course y que el course está asignado al local.

**Update**

- si querés permitir “submit”:
  - permitir update solo si `user_id = auth.uid()` y `submitted_at is null` (estado draft)
  - una vez submitted, solo lectura

**Delete**

- prohibido

---

### 7.3 quiz_answers

**Select**

- propio attempt + visibilidad de referente/org_admin/superadmin por org/local (usando columnas redundantes)

**Insert (own-only)**

- Validar que el attempt pertenece al usuario:
- policy/hook: existe `quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()`

---

### 7.4 quiz_attempt_questions

**Select**

- own + referente(local) + org_admin + superadmin

**Insert**

- own-only (attempt del usuario)
- policy/hook: existe `quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()`
- y que `org_id` coincide (si lo redundás en answers)

**Update/Delete**

- prohibidos

> Recomendación fuerte: redundar `local_id` y `user_id` también en `quiz_answers` para evitar joins en select policies.
> Alternativa: mantener `org_id` y resolver resto vía join helper.

---

## 8) Reglas de “soft delete” (prohibir DELETE)

Para todas las tablas de negocio:

- NO crear policies `for delete`.
- Operaciones de baja/archivo se hacen por `update` (`status`, `ended_at`, `archived_at`).

Opcional (más estricto):

- trigger `BEFORE DELETE` que siempre lance excepción (defensa adicional).

---

## 9) Recomendación sobre invitación “preview” por token

**No implementar con RLS** salvo que sea imprescindible.  
Patrón recomendado:

- Edge Function pública:
  - `GET /invite/:token` → devuelve org_name, local_name, role, expiry, status
  - `POST /invite/:token/accept` → con auth o magic link, crea memberships y marca accepted (service role)

Ventaja:

- Evita policies con `token` (vector sensible).
- Reduce riesgo de filtración de invitaciones.

---

## 10) Checklist de auditoría RLS (rápido)

- [ ] Todas las tablas tienen RLS habilitado.
- [ ] Ninguna tabla tiene policy de `delete` (o delete bloqueado por trigger).
- [ ] `org_memberships.role` solo `org_admin|member`.
- [ ] `local_memberships.role` solo `referente|aprendiz`.
- [ ] Progreso: insert own-only (con check de membresía activa al local).
- [ ] Lectura de progreso: own + referente(local) + org_admin(org) + superadmin.
- [ ] Lectura de contenido: solo si curso asignado a algún local del usuario (o admin/superadmin).
- [ ] Invitaciones: acceso limitado a org_admin/superadmin; preview por token vía Edge Function.
- [ ] Helpers `SECURITY DEFINER` están en `search_path=public` y no exponen data accidental.

---

## 11) Notas operativas

- Helpers deben ser `stable` y preferiblemente solo `select exists(...)`.
- Indexar:
  - memberships por `(user_id, status)` y `(local_id, role, status)`
  - local_courses por `(local_id, status)`
  - progreso por `(user_id, local_id)` y `(local_id, course_id)`
- Mantener policies pequeñas y auditar con tests (SQL + supabase local).

---
