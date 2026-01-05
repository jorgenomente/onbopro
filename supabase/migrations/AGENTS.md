# Supabase migrations — AGENTS

Rules for this folder:

- Only SQL migration files live here.
- Naming is mandatory: `YYYYMMDDHHMMSS_<name>.sql`.
- Optional numbering: `YYYYMMDDHHMMSS_###_<name>.sql`.
- Do not use names like `M001_...` (timestamp is required).
- One migration = one concern (schema vs constraints vs RLS vs views).
- Never overwrite or rename existing migrations; always create a new one.

## Correcciones y consolidación de vistas

Cuando una vista SQL requiere ajustes iterativos (fixes, renames, cambios de output):

- Preferir **una migración final de tipo DROP VIEW IF EXISTS + CREATE VIEW**
  que represente el estado definitivo.
- Evitar cadenas largas de migraciones incrementales para la misma vista.
- Si existe una migración intermedia ya aplicada:
  - Consolidar en una migración posterior (“recreate”).
  - Neutralizar la migración intermedia (no-op documentado) o eliminarla
    si el historial aún no está compartido.
- Mantener **una vista = una migración efectiva** siempre que sea posible.
- Documentar la consolidación en `docs/ops-log.md`.

Este patrón mantiene el historial auditable, reduce ruido y facilita debugging.
