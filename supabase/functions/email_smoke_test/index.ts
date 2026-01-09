import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SmokePayload = {
  to?: string;
  subject?: string;
  text?: string;
};

const DEFAULT_SUBJECT = 'ONBO — Smoke test';
const DEFAULT_TEXT = 'This is a smoke test from ONBO.';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: SmokePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const to = payload?.to?.trim();
  const subject = payload?.subject?.trim() || DEFAULT_SUBJECT;
  const text = payload?.text?.trim() || DEFAULT_TEXT;

  if (!to || !isValidEmail(to)) {
    return jsonResponse({ error: 'Invalid recipient email' }, 400);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');
  const appUrl = Deno.env.get('APP_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (
    !resendApiKey ||
    !emailFrom ||
    !appUrl ||
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return jsonResponse({ error: 'Missing required env vars' }, 500);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData?.user?.id) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject,
      text,
      tags: [
        { name: 'system', value: 'onbo' },
        { name: 'purpose', value: 'smoke_test' },
      ],
    }),
  });

  let responseBody: { id?: string; message?: string } | null = null;
  try {
    responseBody = (await response.json()) as { id?: string; message?: string };
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    return jsonResponse(
      { error: responseBody?.message ?? 'Resend request failed' },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    resend_id: responseBody?.id ?? null,
    to,
    from: emailFrom,
    subject,
  });
});
