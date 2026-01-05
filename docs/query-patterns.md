# ONBO — Query Patterns & Canonical Views

Este documento define **patrones de consulta canónicos** para ONBO.
Su objetivo es evitar SQL incorrecto, joins inseguros o filtrados incompletos,
especialmente en dashboards y reportes.

Regla central:

> **Nunca confiar en el frontend para filtrar por org/local.**  
> Toda query debe estar correctamente “scoped” a nivel DB (RLS + WHERE).

---

## 1. Principios generales de queries

1. Toda query debe incluir explícitamente:
   - `org_id`
   - y, si aplica, `local_id`
2. Nunca asumir “el usuario ya pertenece al local”.
3. Preferir **vistas SQL** para queries repetidas.
4. Evitar joins innecesarios en tiempo de request; usar redundancia (`org_id`, `local_id`) cuando existe.
5. Las vistas deben ser **read-only**.

---

## 2. Visibilidad de cursos (aprendiz / referente)

### Caso de uso

Listar cursos visibles para un usuario en un local.

### Regla

Un curso es visible si:

- el usuario es miembro activo del local
- existe `local_courses` activa para ese local y curso
- el curso no está archivado

---

### Query canónica (base)

```sql
select c.*
from courses c
join local_courses lc
  on lc.course_id = c.id
 and lc.status = 'active'
where
  lc.local_id = :local_id
  and c.status = 'published';
```

> RLS garantiza:
>
> - el usuario pertenece al local
> - el local pertenece a su org

---

### Vista recomendada

```sql
create view v_visible_courses_by_local as
select
  c.id as course_id,
  c.org_id,
  lc.local_id,
  c.title,
  c.status,
  lc.assigned_at
from courses c
join local_courses lc
  on lc.course_id = c.id
where
  c.status = 'published'
  and lc.status = 'active';
```

---

## 3. Contenido interno de un curso

### Unidades por curso

```sql
select *
from course_units
where
  course_id = :course_id
order by position;
```

### Lecciones por unidad

```sql
select *
from lessons
where
  unit_id = :unit_id
order by position;
```

> RLS debe permitir lectura solo si el curso está asignado a un local del usuario o si es admin.

---

## 4. Progreso del aprendiz (dashboard personal)

### Caso

Mostrar progreso del usuario autenticado por curso.

### Query base

```sql
select
  lc.course_id,
  count(distinct l.id) as total_lessons,
  count(distinct lcpl.lesson_id) as completed_lessons
from local_courses lc
join course_units u on u.course_id = lc.course_id
join lessons l on l.unit_id = u.id
left join lesson_completions lcpl
  on lcpl.lesson_id = l.id
 and lcpl.user_id = auth.uid()
where
  lc.local_id = :local_id
  and lc.status = 'active'
group by lc.course_id;
```

---

### Vista recomendada

```sql
create view v_progress_summary_by_user_course as
select
  lc.local_id,
  lc.course_id,
  lcpl.user_id,
  count(distinct l.id) as total_lessons,
  count(distinct lcpl.lesson_id) as completed_lessons,
  max(lcpl.completed_at) as last_activity_at
from local_courses lc
join course_units u on u.course_id = lc.course_id
join lessons l on l.unit_id = u.id
left join lesson_completions lcpl
  on lcpl.lesson_id = l.id
group by
  lc.local_id,
  lc.course_id,
  lcpl.user_id;
```

> RLS:
>
> - aprendiz: solo sus filas
> - referente: filas del local
> - org_admin: filas de la org

---

## 5. Progreso por local (referente)

### Caso

El referente ve el avance de los aprendices de su local.

### Query base

```sql
select
  u.user_id,
  p.full_name,
  ps.course_id,
  ps.completed_lessons,
  ps.total_lessons
from v_progress_summary_by_user_course ps
join profiles p on p.user_id = ps.user_id
where
  ps.local_id = :local_id;
```

---

## 6. Roster de un local

### Caso

Listar usuarios de un local con rol y estado.

```sql
select
  lm.user_id,
  p.full_name,
  lm.role,
  lm.status,
  lm.created_at
from local_memberships lm
join profiles p on p.user_id = lm.user_id
where
  lm.local_id = :local_id
  and lm.status = 'active';
```

---

### Vista recomendada

```sql
create view v_roster_by_local as
select
  lm.org_id,
  lm.local_id,
  lm.user_id,
  p.full_name,
  lm.role,
  lm.status,
  lm.created_at
from local_memberships lm
join profiles p on p.user_id = lm.user_id
where
  lm.status = 'active';
```

---

## 7. Dashboard organizacional (org_admin)

### Caso

Resumen global de progreso por organización.

```sql
select
  org_id,
  course_id,
  count(distinct user_id) as learners,
  avg(completed_lessons::float / nullif(total_lessons, 0)) as avg_completion_ratio
from v_progress_summary_by_user_course
group by org_id, course_id;
```

---

## 8. Queries que NO deben existir

- ❌ `select * from lesson_completions` sin filtros
- ❌ joins sin `org_id`/`local_id`
- ❌ queries que filtran por `user_id` pasado desde frontend sin RLS
- ❌ “traer todo y filtrar en JS”

---

## 9. Performance & índices esperados

Para soportar estas queries:

- `local_courses(local_id, status)`
- `course_units(course_id)`
- `lessons(unit_id)`
- `lesson_completions(user_id, lesson_id)`
- `lesson_completions(local_id)`
- `local_memberships(local_id, status)`
- `profiles(user_id)`

---

## 10. Regla de oro

> **Si una query no está documentada aquí, debe justificarse antes de usarse.**
> Las vistas son el contrato entre datos y UI.
