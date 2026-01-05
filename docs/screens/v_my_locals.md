# Screen Data Contract — v_my_locals

## Resumen

Vista bootstrap para resolver a que local redirigir al usuario autenticado.

## Rol y Scope

- Rol: aprendiz / referente / org_admin
- Scope: OWN (auth.uid())

## Input

- auth.uid() implicito (RLS)

## Output (una fila por local)

- local_id uuid
- local_name text
- org_id uuid
- membership_role text
- membership_status text

## Reglas de calculo

- Solo memberships del usuario autenticado
- Solo memberships activas (status = 'active')
- Join con locals solo para obtener nombre

## Reglas de seguridad

- Hereda RLS
- No usa SECURITY DEFINER

## Query usage

```sql
select *
from public.v_my_locals;
```
