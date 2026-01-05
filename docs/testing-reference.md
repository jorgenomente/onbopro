# 🧪 Testing Reference — ONBO (Smoke Tests RLS)

Este documento contiene los **IDs reales de usuarios y entidades**
utilizados para **smoke tests de Row Level Security (RLS)** en ONBO.

⚠️ **IMPORTANTE**

- Estos datos existen **solo en entorno DEV**.
- No deben usarse en producción.
- No borrar ni modificar estos registros sin actualizar:
  - `scripts/rls-smoke-tests.mjs`
  - documentación asociada
- Este archivo es la **fuente de verdad** para testing de permisos.

---

## 1. Test Users (Supabase Auth)

Usuarios **reales**, creados en Supabase Auth,
utilizados para validar RLS usando `anon key`.

### 👤 Superadmin (global)

- **Email:** `superadmin@test.com`
- **UID:** `8bad48e8-e628-43a8-a48c-9a2eb066a0fb`
- **Rol efectivo:** `superadmin`
- **Implementación:** `profiles.is_superadmin = true`
- **Notas:** bypass lógico de permisos vía helpers SQL

---

### 👤 Org Admin

- **Email:** `orgadmin@test.com`
- **UID:** `4d4f7bd1-1f42-4fbc-9e9d-4aac8c92159b`
- **Rol efectivo:** `org_admin`
- **Scope:** Organization
- **Fuente de rol:** `org_memberships`

---

### 👤 Referente

- **Email:** `referente@test.com`
- **UID:** `893b28a1-331c-432a-bb45-e45700ba3d95`
- **Rol efectivo:** `referente`
- **Scope:** Local
- **Fuente de rol:** `local_memberships`
- **Restricción:** solo lectura (no escribe progreso)

---

### 👤 Aprendiz

- **Email:** `aprendiz@test.com`
- **UID:** `c877ae1f-f2be-4697-a227-62778565305e`
- **Rol efectivo:** `aprendiz`
- **Scope:** Local
- **Fuente de rol:** `local_memberships`
- **Restricción crítica:**
  - solo puede escribir progreso **own-only**
  - no puede escribir progreso de otros usuarios

---

## 2. Context IDs usados en Smoke Tests

Estos IDs se utilizan explícitamente en los smoke tests
para validar aislamiento por tenant y local.

### Organización

- **Org (Smoke Test):**  
  `219c2724-033c-4f98-bc2a-3ffe12c5a618`

---

### Locales

- **Local A:**  
  `2580e080-bf31-41c0-8242-7d90b070d060`

- **Local B:**  
  `13cd2ffe-ee2b-46b3-8fd0-bb8a705dd1ef`

> Usados para validar:
>
> - aislamiento entre locales
> - visibilidad correcta de cursos y membresías

---

## 3. Contenido mínimo para Smoke Tests

Contenido creado exclusivamente para testing de permisos.

### Curso

- **Course ID:**  
  `2c8e263a-e835-4ec8-828c-9b57ce5c7156`

- **Pertenece a:** Organization de smoke test
- **Asignación:** `local_courses` → Local A

---

### Unit

- **Unit ID:**  
  `809b8e44-d6b1-4478-80b5-af4dbf53dd91`

- **FK:** `course_units.course_id → courses.id`

---

### Lesson

- **Lesson ID:**  
  `30b3b16c-3b59-4eae-b8cf-c15194a2afdc`

- **FK:** `lessons.unit_id → course_units.id`

---

## 4. Uso correcto de estos IDs

Estos IDs **DEBEN** usarse solo en:

- `scripts/rls-smoke-tests.mjs`
- seeds de desarrollo
- documentación técnica
- debugging de RLS

🚫 **NO usar en:**

- migraciones SQL
- código de producción
- lógica de negocio permanente

---

## 5. Regla de mantenimiento

Si alguno de estos IDs cambia:

1. Actualizar este archivo
2. Actualizar los smoke tests
3. Re-ejecutar validaciones RLS
4. Registrar el cambio en `docs/ops-log.md`

---

## 6. Objetivo de este archivo

Garantizar que:

- los smoke tests sean reproducibles
- los permisos RLS se validen con usuarios reales
- cualquier desarrollador o asistente entienda
  **qué se está testeando y con qué datos**

Este archivo es parte del **contrato de seguridad** del proyecto.
