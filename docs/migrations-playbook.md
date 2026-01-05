# ONBO — Migrations Playbook

Este documento define **cómo se deben crear, ordenar y validar las migraciones**
del proyecto ONBO. Su objetivo es evitar mezclas de concerns, regresiones de RLS
y estados inconsistentes en producción.

Es un **manual operativo** para humanos y para Codex CLI.

---

## 1. Principios de migración

1. **Una migración = un bloque conceptual**.
2. No mezclar:
   - tablas
   - constraints
   - policies
   - vistas
     en la misma migración salvo que pertenezcan al mismo bloque.
3. Toda migración debe ser:
   - reproducible
   - idempotente (si aplica)
   - reversible conceptualmente (aunque no se haga down)
4. Nunca confiar en el orden implícito: todo debe declararse explícitamente.

---

## 2. Orden recomendado de migraciones

### M001 — Core Tenancy

- `profiles`
- `organizations`
- `locals`
- enums base
- FKs directas
- índices básicos

---

### M002 — Memberships

- `org_memberships`
- `local_memberships`
- constraints de unicidad
- triggers de coherencia org/local

---

### M003 — Invitations

- `invitations`
- índices por token y email
- sin RLS pública (solo admin)

---

### M004 — Content

- `courses`
- `course_units`
- `lessons`
- `quizzes`
- `quiz_questions`
- `quiz_options`
- constraints de orden y coherencia

---

### M005 — Assignment

- `local_courses`
- PK compuesta
- reglas de org/local

---

### M006 — Progress

- `lesson_completions`
- `quiz_attempts`
- `quiz_answers`
- constraints own-only y unicidad

---

### M007 — RLS Core

- enable RLS
- helpers `SECURITY DEFINER`
- policies para:
  - profiles
  - organizations
  - locals
  - memberships
  - invitations

---

### M008 — RLS Content & Progress

- policies de lectura de contenido
- policies own-only de progreso
- bloqueo de deletes

---

### M009 — Views & Reporting

- `v_visible_courses_by_local`
- `v_progress_summary_by_user_course`
- `v_roster_by_local`

---

## 3. Naming conventions

### Supabase Migration Naming Rule

Supabase CLI only picks up migrations that follow the timestamped pattern.
Always create new migrations with:

- `npx supabase migration new <name>`

If you create files manually, use:

- `YYYYMMDDHHMMSS_<name>.sql`
- Optional numbering: `YYYYMMDDHHMMSS_###_<name>.sql`

Examples:

- `20260104190000_001_core_tenancy.sql`
- `20260104190100_002_memberships.sql`
- `20260104190200_003_invitations.sql`

Rationale: migrations without a timestamp are skipped by Supabase CLI.

### Archivos

```

20260104190000_001_core_tenancy.sql
20260104190100_002_memberships.sql
20260104190200_003_invitations.sql
20260104190300_004_content.sql
20260104190400_005_local_courses.sql
20260104190500_006_progress.sql
20260104190600_007_rls_core.sql
20260104190700_008_rls_content_progress.sql
20260104190800_009_views.sql

```

---

### Objetos SQL

- tables: `snake_case`
- enums: `snake_case`
- policies: `<table>: <action> <scope>`
  - ejemplo: `lesson_completions: insert own`
- helpers: `rls_*`

---

## 4. Checklist por migración

Antes de dar una migración por válida:

### Estructura

- [ ] Todas las tablas tienen PK
- [ ] Todas las FKs necesarias están presentes
- [ ] Constraints de unicidad definidos
- [ ] Migration filename matches Supabase pattern (`YYYYMMDDHHMMSS_<name>.sql`)

### Integridad

- [ ] Triggers para coherencia cruzada (`org_id`, `local_id`, `course_id`)
- [ ] Reglas de soft delete claras

### Performance

- [ ] Índices para columnas usadas en RLS
- [ ] Índices para joins frecuentes

### Seguridad

- [ ] RLS habilitado
- [ ] Policies mínimas necesarias
- [ ] No existen policies DELETE
- [ ] Progreso own-only verificado

---

## 5. Qué NO hacer en migraciones

- ❌ Crear tablas sin RLS planificado
- ❌ Agregar policies sin índice correspondiente
- ❌ Usar `DELETE FROM` en lógica de negocio
- ❌ Mezclar auth logic con contenido/progreso
- ❌ Resolver integridad solo en frontend

---

## 6. Tests mínimos recomendados (manuales o automáticos)

Por cada bloque:

### Memberships

- usuario fuera del local no ve datos
- usuario inactivo no escribe progreso

### Content

- curso no asignado no es visible
- quiz incoherente falla al crear

### Progress

- escribir progreso de otro usuario falla
- referente puede leer progreso del local
- aprendiz no ve progreso de otros

---

## 7. Deploy & rollback mental

Aunque no haya `down.sql`:

- Toda migración debe:
  - fallar rápido si algo no existe
  - no romper datos existentes
- Archivar es preferible a borrar.
- En caso de error:
  - desactivar feature en app
  - corregir migración
  - volver a desplegar

---

## 8. Regla final

> **Si una migración rompe RLS o integridad, el problema es la migración, no la app.**  
> Las migraciones son contratos, no scripts temporales.

```

---

## ✔️ Estado final

Con estos **5 documentos**:

1. `docs/schema-guide.md`
2. `docs/rls-cheatsheet.md`
3. `docs/integrity-rules.md`
4. `docs/onboarding-provisioning.md`
5. `docs/query-patterns.md`
6. `docs/migrations-playbook.md`

tenés un **marco completo, robusto y consultable por Codex** para construir ONBO con:

* mínimo riesgo de permisos,
* mínima ambigüedad,
* y alta mantenibilidad a largo plazo.
```
