# ONBO — Integrity Rules & Data Invariants

Este documento define las **reglas de integridad** del modelo de datos de ONBO.
Su objetivo es que la base de datos se **auto-defienda** contra estados inválidos,
reduciendo bugs lógicos, errores de permisos y casos borde difíciles de detectar.

Estas reglas son complementarias a RLS:

- **RLS controla quién puede acceder**
- **Integrity Rules controlan qué estados son válidos**

Cada regla indica:

- Qué garantiza
- Por qué existe
- Cómo se impone (constraint, trigger, RLS o lógica de provisioning)
- Qué índice la soporta

---

## 1. Reglas de Tenancy (Organization / Local)

### IR-1: Un local siempre pertenece a una organización válida

**Regla**  
`locals.org_id` debe existir en `organizations.id`.

**Motivo**  
Evita locales huérfanos y rompe menos joins y RLS.

**Enforcement**

- FK directa `locals.org_id → organizations.id`

**Índices**

- `locals(org_id)`

---

### IR-2: Una membresía local no puede cruzar organizaciones

**Regla**  
En `local_memberships`, el `org_id` debe coincidir con el `org_id` del `local_id`.

**Motivo**  
Evita escalamiento de permisos y corrupción de scope.

**Enforcement**

- Trigger `BEFORE INSERT/UPDATE`:
  - validar `local_memberships.org_id = locals.org_id`

**Índices**

- `local_memberships(local_id)`
- `local_memberships(org_id)`

---

### IR-3: Asignaciones de cursos respetan la organización

**Regla**  
En `local_courses`:

- `local_courses.org_id = locals.org_id`
- `local_courses.org_id = courses.org_id`

**Motivo**  
Impide asignar cursos de otra organización a un local.

**Enforcement**

- Trigger de validación cruzada

**Índices**

- `local_courses(local_id)`
- `local_courses(course_id)`
- `local_courses(org_id)`

---

## 2. Reglas de Membresías

### IR-4: Un usuario no puede tener membresías duplicadas

**Regla**

- `org_memberships`: `unique(org_id, user_id)`
- `local_memberships`: `unique(local_id, user_id)`

**Motivo**
Evita ambigüedad de roles y errores de RLS.

**Enforcement**

- Unique constraints

**Índices**

- implícitos por unique

---

### IR-5: Solo una membresía primaria por usuario y organización

**Regla**  
Un usuario puede tener **un solo local primario activo por organización**.

**Motivo**  
Simplifica UX (login directo vs selector).

**Enforcement**

- Índice único parcial:
  ```sql
  unique (org_id, user_id)
  where is_primary = true and status = 'active'
  ```

```

**Índices**

* índice parcial anterior

---

### IR-6: Membresías inactivas no otorgan permisos

**Regla**

* `status='inactive'` implica:

  * no lectura
  * no escritura
  * no visibilidad

**Motivo**
Soporta offboarding sin borrar historial.

**Enforcement**

* Todas las policies RLS deben filtrar por `status='active'`

**Índices**

* `org_memberships(user_id, status)`
* `local_memberships(user_id, status)`

---

## 3. Reglas de Contenido

### IR-7: Una unidad pertenece a un único curso

**Regla**
`course_units.course_id` debe existir y ser coherente.

**Enforcement**

* FK directa
* `unique(course_id, position)`

---

### IR-8: Una lección pertenece a una única unidad

**Regla**
`lessons.unit_id` debe existir y ser coherente.

**Enforcement**

* FK directa
* `unique(unit_id, position)`

---

### IR-9: Tipos de quiz coherentes

**Regla**

* `type='unit'` → `unit_id IS NOT NULL`
* `type='final'` → `unit_id IS NULL`
* Máximo:

  * 1 quiz por unidad
  * 1 quiz final por curso

**Motivo**
Evita estados ambiguos y lógica compleja en frontend.

**Enforcement**

* CHECK constraints
* UNIQUE parciales:

  * `unique(unit_id) where type='unit'`
  * `unique(course_id) where type='final'`

---

## 4. Reglas de Asignación (local_courses)

### IR-10: Un curso se asigna una sola vez por local

**Regla**
`primary key (local_id, course_id)`

**Motivo**
Evita duplicados y progreso ambiguo.

**Enforcement**

* PK compuesta

---

### IR-11: Cursos archivados no deben ser visibles

**Regla**

* `local_courses.status='archived'` implica invisibilidad total

**Enforcement**

* RLS: filtrar por `status='active'`

---

## 5. Reglas de Progreso (CRÍTICAS)

### IR-12: El progreso es own-only

**Regla**
Solo el usuario dueño puede insertar progreso.

**Motivo**
Seguridad y trazabilidad.

**Enforcement**

* RLS `with check user_id = auth.uid()`

---

### IR-13: Progreso solo en locales donde el usuario es miembro activo

**Regla**
No se puede escribir progreso si:

* el usuario no pertenece al local
* la membresía está inactiva

**Enforcement**

* Helper RLS:

  * `rls_user_can_write_progress(org_id, local_id)`

---

### IR-14: Una lección se completa una sola vez

**Regla**
`unique(user_id, lesson_id)`

**Motivo**
Evita inflar progreso.

---

### IR-15: Intentos de quiz numerados y únicos

**Regla**
`unique(user_id, quiz_id, attempt_no)`

**Motivo**
Soporta límite de intentos y reporting correcto.

---

### IR-16: Respuestas coherentes con el intento

**Regla**
`quiz_answers.attempt_id` debe pertenecer al mismo usuario y quiz.

**Enforcement**

* Trigger o policy que valide ownership del attempt

---

## 6. Soft Delete (regla transversal)

### IR-17: Nunca borrar datos de negocio

**Regla**
Ninguna tabla core debe permitir DELETE.

**Motivo**
Auditoría, histórico y debugging.

**Enforcement**

* No crear policies DELETE
* Opcional: trigger `BEFORE DELETE RAISE EXCEPTION`

---

## 7. Resumen de enforcement por capa

| Capa         | Responsabilidad                       |
| ------------ | ------------------------------------- |
| Constraints  | unicidad, estructura básica           |
| Triggers     | coherencia cruzada (org/local/course) |
| RLS          | permisos y ownership                  |
| Provisioning | flujos complejos (invite/accept)      |

---

## 8. Regla de oro

> Si una regla no está en este documento, **no existe**.
> Cualquier cambio al modelo debe actualizar este archivo primero.
```
