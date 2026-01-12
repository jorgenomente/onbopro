# Smoke Test — Quiz Contract Canonical Fields

## Objetivo

Verificar que `v_quiz_state` y `rpc_quiz_submit` usan los campos canónicos:

- `pass_score_pct`
- `time_limit_min`

## Query 1 — columnas del view

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'v_quiz_state'
  and column_name in (
    'pass_score_pct',
    'time_limit_min',
    'pass_percent',
    'time_limit_minutes'
  )
order by column_name;
```

Esperado:

- `pass_score_pct` (integer)
- `time_limit_min` (integer)
- `pass_percent` y `time_limit_minutes` presentes solo como alias legacy

## Query 2 — shape basica del view

```sql
select quiz_id, pass_score_pct, time_limit_min
from public.v_quiz_state
limit 5;
```

## Query 3 — RPC compila y calcula umbral

Si hay datos disponibles para un aprendiz existente:

```sql
select public.rpc_quiz_start(:local_id, :quiz_id);
select public.rpc_quiz_submit(:attempt_id);
```

Notas:

- Usar IDs reales de entorno local o los definidos en `docs/testing-reference.md` si aplica.
- Esta prueba no valida UI; solo contrato DB/RPC.
