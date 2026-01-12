# ONBO — Schema Guide (Core Data Model)

Este documento describe **cómo funciona el esquema de datos de ONBO**, cómo se interconectan las tablas y cómo se derivan permisos, flujos y reglas de integridad.  
Es la **fuente de verdad conceptual** para desarrolladores y para Codex CLI.

---

## Quick Mental Model (60 segundos)

- ONBO es **multi-tenant** por `organizations`.
- La **operación real** ocurre en `locals` (sucursales / áreas).
- Los usuarios existen globalmente (`auth.users`) y se enriquecen en `profiles`.
- Los **roles no se mezclan**:
  - Org level: `org_admin | member`
  - Local level: `referente | aprendiz`
- El contenido (**courses**) pertenece a la organización.
- Los cursos **no se asignan a usuarios**, se asignan a **locals**.
- El usuario ve contenido **solo si pertenece al local**.
- El progreso (**lesson_completions, quiz_attempts**) es **own-only**.
- Referentes ven progreso de su local; org_admin ve toda la org.
- No se borra nada: **soft delete** (`status`, `archived_at`).
- Invitaciones gobiernan el onboarding (email + token).
- RLS es la fuente de verdad de permisos.

---

## 1. Overview

El esquema de ONBO está diseñado para:

- Soportar **múltiples organizaciones** aisladas entre sí.
- Permitir **operación distribuida por locales**.
- Mantener permisos simples, auditables y seguros mediante **Supabase RLS**.
- Registrar progreso educativo sin posibilidad de escritura en nombre de terceros.
- Facilitar flujos de onboarding y offboarding sin borrar datos.

---

## 2. Multi-tenancy y scopes

### Scopes de acceso

| Scope  | Significado                     |
| ------ | ------------------------------- |
| GLOBAL | Todo el sistema (superadmin)    |
| ORG    | Todo dentro de una organización |
| LOCAL  | Todo dentro de un local         |
| OWN    | Solo filas del propio usuario   |

### Regla central

> **Toda tabla “scoped” incluye `org_id`** (aunque sea redundante) para simplificar RLS y evitar joins complejos.

---

## 3. Identidad: `auth.users` + `profiles`

### auth.users (Supabase)

- Tabla gestionada por Supabase Auth.
- Contiene credenciales y `id` global del usuario.

### profiles

Extiende al usuario con metadata de aplicación.

Campos clave:

- `user_id` (PK, FK a auth.users)
- `is_superadmin` → rol global fuera del tenant
- `email`, `full_name`

Reglas:

- Cada usuario tiene **un solo profile**.
- `is_superadmin` **no depende de ninguna organización**.

---

## 4. Tenants: organizations y locals

### organizations

Representa el tenant principal.

Campos clave:

- `id`
- `name`
- `created_by_user_id`
- `archived_at`

Reglas:

- Solo **superadmin** puede crear organizaciones.
- Nunca se elimina una organización (solo se archiva).
- RPC: `rpc_create_organization(name, description)` retorna `org_id`.
  - `description` es opcional y actualmente no se almacena (no hay columna).

### locals

Representa una sucursal / área operativa dentro de una organización.

Campos clave:

- `org_id`
- `name`
- `archived_at`

Reglas:

- Un local **siempre pertenece a una organización**.
- `unique(org_id, name)` para evitar duplicados.
- Todo acceso operativo pasa por locals.

---

## 5. Membresías y roles

### org_memberships

Define **pertenencia organizacional**, no operación diaria.

Campos:

- `org_id`
- `user_id`
- `role`: `org_admin | member`
- `status`: `active | inactive`
- `ended_at`

Reglas:

- `unique(org_id, user_id)`
- `org_admin` puede:
  - crear locales
  - invitar usuarios
  - asignar cursos
  - ver progreso de toda la org
- `member` es pertenencia base (lectura mínima).

---

### local_memberships

Define **operación real y visibilidad**.

Campos:

- `org_id`
- `local_id`
- `user_id`
- `role`: `referente | aprendiz`
- `is_primary` (UX)
- `status`
- `ended_at`

Reglas:

- `unique(local_id, user_id)`
- El `org_id` **debe coincidir** con el del local (trigger).
- Un usuario **puede ser referente y aprendiz en distintos locales**.
- `is_primary` indica el local por defecto para UX.

Roles:

- **referente**: ve progreso del local.
- **aprendiz**: consume contenido y escribe progreso propio.

---

## 6. Invitaciones (onboarding)

### invitations

Modela la **intención de acceso**, no el acceso en sí.

Campos clave:

- `org_id`
- `local_id` (nullable)
- `email`
- `invited_role`: `org_admin | referente | aprendiz`
- `status`: `pending | accepted | expired | revoked`
- `token_hash` (sha256 del token)
- `sent_at`
- `expires_at`

Flujo:

1. Org admin crea invitación.
2. Se envía email con link (token).
3. El invitado puede **ver org/local antes de aceptar**.
4. Al aceptar:
   - si el usuario no existe → se crea
   - se crean memberships correspondientes
   - status → `accepted`

Nota:

- La aceptación se maneja típicamente con **Edge Function + service role**.
- El token **no se almacena en texto plano**. La UI envía `x-invite-token` y se compara `sha256` en DB.

---

## 7. Contenido educativo

### courses

Cursos pertenecen a una organización.

Campos:

- `org_id`
- `title`
- `status`: `draft | published | archived`
- `archived_at`

Solo:

- superadmin / org_admin pueden crear y editar.

---

### course_units

Unidades dentro de un curso.

Reglas:

- `unique(course_id, position)`
- Orden explícito por `position`.

---

### lessons

Lecciones dentro de una unidad.

Campos:

- `content_type` (video, texto, etc.) **legacy**
- `content` (jsonb) **legacy**
- `estimated_minutes`
- `is_required`

Bloques (planned):

- `lesson_blocks` (tabla separada)
- Cada bloque define `block_type`, `data`, `position` y `archived_at`.

Reglas:

- `unique(unit_id, position)`
- El aprendiz **no ve lecciones** si el curso no está asignado a su local.

Notas:

- El player actual lee `content_type + content`. El modelo por blocks debe
  convivir con legacy hasta migrar el player.

### lesson_blocks (planned)

Bloques de contenido para lecciones (modelo PRO).

Campos clave (plan):

- `lesson_id`
- `block_type`
- `data` (jsonb)
- `position`
- `archived_at`
- `org_id` (redundante para RLS)

Reglas (plan):

- Orden por `position`.
- Archivar en lugar de borrar.

---

### quizzes

Evaluaciones.

Tipos:

- `unit`: asociado a una unidad
- `final`: asociado al curso

Reglas críticas:

- `type='unit'` → `unit_id IS NOT NULL`
- `type='final'` → `unit_id IS NULL`
- `unique(unit_id) WHERE type='unit'`
- `unique(course_id) WHERE type='final'`
- `num_questions` limita la cantidad de preguntas por intento (nullable).
- `max_attempts` limita intentos por usuario (default 3).

RPCs relevantes:

- `rpc_update_quiz_metadata`
- `rpc_bulk_import_quiz_questions`
- `rpc_create_quiz_question_full`

---

### quiz_questions

Preguntas del quiz.

Campos:

- `prompt`
- `position`
- `archived_at` (soft delete para editor)

Reglas:

- `unique(quiz_id, position)`
- preguntas archivadas no se muestran en vistas del editor

---

### quiz_options

Opciones de respuesta por pregunta.

Campos:

- `option_text`
- `is_correct`
- `position`

Reglas:

- `unique(question_id, position)`

---

## 8. Asignación de cursos: `local_courses`

Define **qué cursos ve un local**.

Campos:

- `local_id`
- `course_id`
- `status`: `active | archived`
- `assigned_at`
- `assigned_by` (nullable)
- `archived_at` / `archived_by` (nullable)
- `created_at` / `created_by` (audit)
- `updated_at` / `updated_by` (audit)

Reglas:

- PK compuesta `(local_id, course_id)`
- Un aprendiz ve un curso **solo si existe esta fila activa**.
- Desasignar = `status='archived'` + `archived_at` (sin borrar).
- Batch assign:
  - El set final de cursos activos se aplica con `rpc_set_local_courses`.
  - El RPC archiva removidos y reactiva/crea los deseados.

---

## 9. Progreso y evaluaciones

### lesson_completions

Registra lecciones completadas.

Campos redundantes:

- `org_id`, `local_id`, `course_id`, `unit_id`

Motivo:

- Simplificar RLS y queries de dashboard.

Reglas:

- `unique(user_id, lesson_id)`
- Solo el propio usuario puede insertar.
- Referente y org_admin pueden leer.

---

### quiz_attempts

Registra intentos de quiz.

Campos:

- `attempt_no`
- `score`
- `passed`

Reglas:

- `unique(user_id, quiz_id, attempt_no)`
- `attempt_limit` se valida a nivel app o trigger.

---

### quiz_answers

Respuestas por intento.

Reglas:

- `unique(attempt_id, question_id)`
- Nunca se edita; solo se inserta.

---

### quiz_attempt_questions

Set de preguntas asignado a cada intento.

Reglas:

- `unique(attempt_id, question_id)`
- `unique(attempt_id, position)`
- Todas las preguntas deben pertenecer al mismo quiz del intento.

---

## 10. Flujos end-to-end

### A) Invitar usuario nuevo

1. Insert en `invitations`
2. Email con token
3. Usuario acepta
4. Edge Function:
   - crea auth.users (si no existe)
   - crea profile
   - crea org_membership / local_membership
   - marca invitación como accepted

---

### B) Agregar usuario existente a un local

1. Org admin inserta `local_memberships`
2. Usuario ve nuevo local en dashboard

---

### C) Login: 1 local vs multi-local

- 1 local → entra directo
- > 1 local → selector (usa `is_primary` o estado UX)

---

### D) Asignar curso a local

1. Insert en `local_courses`
2. Todos los miembros del local ven el curso

---

### E) Completar lección / rendir quiz

- Insert own-only en `lesson_completions`
- Insert own-only en `quiz_attempts` y `quiz_answers`

---

### F) Offboarding

- `status='inactive'`, `ended_at=now()`
- El usuario deja de ver contenido/progreso
- No se borra historial

---

## 11. Integridad y auto-defensa

Invariantes clave:

- local pertenece a org
- unit pertenece a course
- lesson pertenece a unit
- quiz pertenece a course y coherente con unit/type
- progreso solo en locales donde el usuario es miembro activo

Se recomienda:

- Triggers de validación para relaciones cruzadas
- Índices por `org_id`, `local_id`, `user_id`

---

## 12. Implicancias para RLS

Principios:

- Policies simples y legibles
- Helpers `SECURITY DEFINER`:
  - `is_superadmin()`
  - `is_org_admin(org_id)`
  - `is_local_referente(local_id)`
- Nunca permitir DELETE
- Progreso: **insert own-only**

---

## 13. Convenciones

- `archived_at` para entidades
- `status + ended_at` para memberships
- `created_at` siempre presente
- PKs UUID
- FK explícitos + validación lógica

---

Este documento define **cómo funciona ONBO a nivel de datos**.  
Cualquier cambio estructural debe actualizar **este archivo primero**.
