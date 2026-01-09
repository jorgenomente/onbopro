import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createAdminClient } from '../_shared/db.ts';
import { buildCorsHeaders } from '../_shared/cors.ts';

function jsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function getAuthUserById(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Auth admin unauthorized');
  }

  if (!response.ok) {
    throw new Error(`Auth lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    id?: string;
    email?: string | null;
  };
  return payload;
}

Deno.serve(async (req) => {
  const { allowed, headers: corsHeaders } = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: allowed ? 204 : 403,
      headers: corsHeaders,
    });
  }

  if (!allowed) {
    return jsonResponse({ error: 'Not allowed' }, 403, corsHeaders);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(
      { error: 'Missing Supabase configuration' },
      500,
      corsHeaders,
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, corsHeaders);
  }

  let payload: { target_user_id?: string; full_name?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const targetUserId = payload?.target_user_id?.trim();
  const rawFullName =
    typeof payload?.full_name === 'string' ? payload.full_name : '';
  const fullName = rawFullName.trim();

  if (!targetUserId || !isValidUuid(targetUserId)) {
    return jsonResponse({ error: 'target_user_id required' }, 400, corsHeaders);
  }

  if (fullName.length < 2 || fullName.length > 100) {
    return jsonResponse({ error: 'full_name invalid' }, 400, corsHeaders);
  }

  const admin = createAdminClient();
  const { data: callerProfile, error: callerError } = await admin
    .from('profiles')
    .select('user_id, is_superadmin')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (callerError || !callerProfile?.user_id) {
    return jsonResponse({ error: 'Profile not found' }, 403, corsHeaders);
  }

  if (!callerProfile.is_superadmin) {
    return jsonResponse({ error: 'Not authorized' }, 403, corsHeaders);
  }

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('user_id, email')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetProfile?.user_id) {
    const authUser = await getAuthUserById(targetUserId);
    if (!authUser?.email) {
      return jsonResponse(
        { error: 'Target user email not found' },
        500,
        corsHeaders,
      );
    }

    const { error: insertError } = await admin.from('profiles').insert({
      user_id: targetUserId,
      email: authUser.email,
      full_name: fullName,
      is_superadmin: false,
    });

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500, corsHeaders);
    }

    return jsonResponse(
      { ok: true, user_id: targetUserId, full_name: fullName },
      200,
      corsHeaders,
    );
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('user_id', targetUserId);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500, corsHeaders);
  }

  return jsonResponse(
    { ok: true, user_id: targetUserId, full_name: fullName },
    200,
    corsHeaders,
  );
});
