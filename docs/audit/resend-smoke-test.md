# Resend Smoke Test — ONBO

## Env vars requeridas (Supabase Edge Secrets)

- `RESEND_API_KEY`
- `EMAIL_FROM` (ej: `ONBO <no-reply@onbo.space>`)
- `APP_URL` (ej: `https://app.onbo.space`)
- `SUPABASE_URL` (ej: `https://<PROJECT_REF>.supabase.co`)
- `SUPABASE_ANON_KEY`

## Verificacion JWT (manual)

- `verify_jwt = false` solo para `email_smoke_test` en `supabase/config.toml`.
- La funcion valida el JWT con `supabase.auth.getUser(token)` usando `SUPABASE_ANON_KEY`.

## Deploy

```bash
supabase functions deploy email_smoke_test
```

## Configurar secrets

```bash
supabase secrets set RESEND_API_KEY="REEMPLAZAR"
supabase secrets set EMAIL_FROM="ONBO <no-reply@onbo.space>"
supabase secrets set APP_URL="https://app.onbo.space"
supabase secrets set SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="REEMPLAZAR"
```

## Test (curl)

```bash
curl -sS -X POST "https://<PROJECT_REF>.functions.supabase.co/email_smoke_test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY_O_JWT_SI_CORRESPONDE>" \
  -d '{"to":"TU_EMAIL@DOMINIO.COM","subject":"ONBO — Smoke test","text":"Si recibiste esto, Resend está OK."}'
```

## Respuesta esperada

```json
{ "ok": true, "resend_id": "...", "to": "...", "from": "...", "subject": "..." }
```
