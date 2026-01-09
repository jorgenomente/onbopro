import { createAdminClient } from '../_shared/db.ts';
import { sha256Bytea } from '../_shared/crypto.ts';
import { extractBearerToken } from '../_shared/auth.ts';
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

  let payload: { token?: string; password?: string; full_name?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const token = payload?.token?.trim();
  const password = payload?.password?.trim();
  const rawFullName =
    typeof payload?.full_name === 'string' ? payload.full_name : '';
  const fullName = rawFullName.trim();

  if (!token) {
    return jsonResponse({ error: 'token required' }, 400, corsHeaders);
  }

  if (fullName.length > 0 && (fullName.length < 2 || fullName.length > 100)) {
    return jsonResponse({ error: 'full_name invalid' }, 400, corsHeaders);
  }

  const admin = createAdminClient();
  const tokenHash = await sha256Bytea(token);

  const { data: invitation, error } = await admin
    .from('invitations')
    .select(
      'id, org_id, local_id, email, invited_role, status, expires_at, accepted_at',
    )
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !invitation?.id) {
    return jsonResponse(
      { error: 'invalid or expired token' },
      404,
      corsHeaders,
    );
  }

  const jwt = extractBearerToken(req);

  let userId: string | null = null;

  if (jwt) {
    const { data: userData } = await admin.auth.getUser(jwt);
    userId = userData?.user?.id ?? null;
  }

  if (!userId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('email', invitation.email)
      .maybeSingle();

    if (profile?.user_id) {
      return jsonResponse({ error: 'login required' }, 409, corsHeaders);
    }

    if (!password || password.length < 8) {
      return jsonResponse({ error: 'password required' }, 400, corsHeaders);
    }

    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      });

    if (createError || !newUser?.user?.id) {
      return jsonResponse(
        { error: createError?.message ?? 'failed to create user' },
        500,
        corsHeaders,
      );
    }

    userId = newUser.user.id;
  }

  const { data: profileRow, error: profileError } = await admin
    .from('profiles')
    .select('user_id, full_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: 'profile lookup failed' }, 500, corsHeaders);
  }

  const existingFullName = profileRow?.full_name?.trim() ?? '';
  const needsName = existingFullName.length === 0;

  if (needsName && fullName.length === 0) {
    return jsonResponse({ error: 'full_name required' }, 400, corsHeaders);
  }

  let profileUpdated = false;
  if (!profileRow?.user_id) {
    const { error: profileInsertError } = await admin.from('profiles').insert({
      user_id: userId,
      email: invitation.email,
      full_name: fullName || null,
      is_superadmin: false,
    });
    if (profileInsertError) {
      return jsonResponse(
        { error: profileInsertError.message },
        500,
        corsHeaders,
      );
    }
    profileUpdated = fullName.length > 0;
  } else if (fullName.length > 0 && fullName !== existingFullName) {
    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', userId);
    if (profileUpdateError) {
      return jsonResponse(
        { error: profileUpdateError.message },
        500,
        corsHeaders,
      );
    }
    profileUpdated = true;
  }

  let membershipId: string | null = null;

  if (invitation.invited_role === 'org_admin') {
    const { data: orgMembership, error: orgError } = await admin
      .from('org_memberships')
      .upsert(
        {
          org_id: invitation.org_id,
          user_id: userId,
          role: 'org_admin',
          status: 'active',
          ended_at: null,
        },
        { onConflict: 'org_id,user_id' },
      )
      .select('id')
      .maybeSingle();

    if (orgError || !orgMembership?.id) {
      return jsonResponse(
        { error: orgError?.message ?? 'failed to create org membership' },
        500,
        corsHeaders,
      );
    }

    membershipId = orgMembership.id;
  } else {
    if (!invitation.local_id) {
      return jsonResponse(
        { error: 'local_id missing for invitation' },
        400,
        corsHeaders,
      );
    }

    const { data: localMembership, error: localError } = await admin
      .from('local_memberships')
      .upsert(
        {
          org_id: invitation.org_id,
          local_id: invitation.local_id,
          user_id: userId,
          role: invitation.invited_role,
          status: 'active',
          ended_at: null,
        },
        { onConflict: 'local_id,user_id' },
      )
      .select('id')
      .maybeSingle();

    if (localError || !localMembership?.id) {
      return jsonResponse(
        { error: localError?.message ?? 'failed to create local membership' },
        500,
        corsHeaders,
      );
    }

    membershipId = localMembership.id;
  }

  const { error: updateError } = await admin
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500, corsHeaders);
  }

  return jsonResponse(
    {
      ok: true,
      org_id: invitation.org_id,
      local_id: invitation.local_id,
      role: invitation.invited_role,
      user_id: userId,
      membership_id: membershipId,
      profile_updated: profileUpdated,
    },
    200,
    corsHeaders,
  );
});
