import { createAdminClient } from '../_shared/db.ts';
import { requireAuthUser, isOrgAdmin } from '../_shared/auth.ts';
import { generateToken, sha256Bytea } from '../_shared/crypto.ts';
import { sendInviteEmail } from '../_shared/email.ts';
import { buildCorsHeaders } from '../_shared/cors.ts';

const INVITE_DAYS = 7;

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

type ProvisionPayload = {
  org_id: string;
  local_id: string;
  email: string;
  role: 'aprendiz' | 'referente';
};

async function getAuthUserByEmail(email: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(
    email,
  )}`;
  const response = await fetch(url, {
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

  type AuthUser = { id: string; email?: string | null };
  type AuthResponse = { users?: AuthUser[] } | AuthUser[];
  const payload = (await response.json()) as AuthResponse;
  const users = Array.isArray(payload) ? payload : (payload.users ?? []);
  const matched = users.find(
    (user) => (user.email ?? '').toLowerCase() === email.toLowerCase(),
  );

  return matched ?? null;
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

  let payload: ProvisionPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const orgId = payload?.org_id;
  const localId = payload?.local_id;
  const role = payload?.role;
  const email = payload?.email?.trim().toLowerCase();

  if (!orgId || !localId || !email || !role) {
    return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders);
  }

  if (!['aprendiz', 'referente'].includes(role)) {
    return jsonResponse({ error: 'Invalid role' }, 400, corsHeaders);
  }

  const normalizedRole = role as 'aprendiz' | 'referente';

  let authContext;
  try {
    authContext = await requireAuthUser(req);
  } catch (err) {
    if (err instanceof Response) {
      const body = await err.text();
      return new Response(body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...corsHeaders },
      });
    }
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const admin = createAdminClient();
  const orgAllowed =
    authContext.isSuperadmin || (await isOrgAdmin(authContext.userId, orgId));

  if (!orgAllowed) {
    return jsonResponse({ error: 'Not authorized' }, 403, corsHeaders);
  }

  const { data: localRow, error: localError } = await admin
    .from('locals')
    .select('id, org_id, name')
    .eq('id', localId)
    .maybeSingle();

  if (localError || !localRow?.id) {
    return jsonResponse({ error: 'Local not found' }, 404, corsHeaders);
  }

  if (localRow.org_id !== orgId) {
    return jsonResponse(
      { error: 'Local does not belong to org' },
      400,
      corsHeaders,
    );
  }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  let authUserId: string | null = null;
  try {
    const authUser = await getAuthUserByEmail(email);
    authUserId = authUser?.id ?? null;
  } catch (err) {
    return jsonResponse(
      {
        error: 'Auth lookup failed',
        hint: err instanceof Error ? err.message : undefined,
      },
      500,
      corsHeaders,
    );
  }

  if (authUserId) {
    const { data: profileRow, error: profileError } = await admin
      .from('profiles')
      .select('user_id, email')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(
        {
          ok: false,
          error: 'Profile lookup failed',
          hint: profileError.message,
        },
        500,
        corsHeaders,
      );
    }

    if (!profileRow?.user_id) {
      const { error: profileInsertError } = await admin
        .from('profiles')
        .insert({
          user_id: authUserId,
          email,
          full_name: null,
          is_superadmin: false,
        });

      if (profileInsertError) {
        console.warn('[provision_local_member]', {
          mode: 'assigned_existing_user',
          user_id: authUserId,
          profile_upsert_failed: true,
        });
      }
    } else if (!profileRow.email) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ email })
        .eq('user_id', authUserId);

      if (profileUpdateError) {
        console.warn('[provision_local_member]', {
          mode: 'assigned_existing_user',
          user_id: authUserId,
          profile_upsert_failed: true,
        });
      }
    }

    const { error: membershipError } = await admin
      .from('local_memberships')
      .upsert(
        {
          org_id: orgId,
          local_id: localId,
          user_id: authUserId,
          role: normalizedRole,
          status: 'active',
          ended_at: null,
        },
        { onConflict: 'local_id,user_id' },
      );

    if (membershipError) {
      return jsonResponse(
        { error: 'Membership upsert failed' },
        500,
        corsHeaders,
      );
    }

    const { data: membership, error: membershipFetchError } = await admin
      .from('local_memberships')
      .select('id, user_id, org_id, local_id, role, status, created_at')
      .eq('user_id', authUserId)
      .eq('local_id', localId)
      .maybeSingle();

    if (membershipFetchError || !membership) {
      return jsonResponse(
        {
          error: 'Membership fetch failed',
          hint: membershipFetchError?.message,
        },
        500,
        corsHeaders,
      );
    }

    console.log('[provision_local_member]', {
      mode: 'assigned_existing_user',
      email,
      local_id: localId,
      user_id: authUserId,
      role: membership.role,
      status: membership.status,
    });

    return jsonResponse(
      {
        ok: true,
        mode: 'assigned_existing_user',
        result: 'member_added',
        email,
        user_id: authUserId,
        local_id: localId,
        membership,
      },
      200,
      corsHeaders,
    );
  }

  const { data: existingInvite } = await admin
    .from('invitations')
    .select('id, expires_at, status')
    .eq('org_id', orgId)
    .eq('local_id', localId)
    .eq('email', email)
    .eq('invited_role', role)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const token = generateToken();
  const tokenHash = await sha256Bytea(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + INVITE_DAYS * 86400000,
  ).toISOString();

  let invitationId = existingInvite?.id ?? null;
  const existingExpired =
    existingInvite?.expires_at && new Date(existingInvite.expires_at) <= now;

  if (existingInvite?.id && !existingExpired) {
    const { error: updateError } = await admin
      .from('invitations')
      .update({
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .eq('id', existingInvite.id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500, corsHeaders);
    }
  } else {
    if (existingInvite?.id && existingExpired) {
      await admin
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', existingInvite.id);
    }
    const { data: invite, error: inviteError } = await admin
      .from('invitations')
      .insert({
        org_id: orgId,
        local_id: localId,
        email,
        invited_role: role,
        status: 'pending',
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by_user_id: authContext.userId,
      })
      .select('id')
      .maybeSingle();

    if (inviteError || !invite?.id) {
      return jsonResponse(
        { error: inviteError?.message ?? 'Failed' },
        500,
        corsHeaders,
      );
    }

    invitationId = invite.id;
  }

  if (!invitationId) {
    return jsonResponse({ error: 'Invitation not created' }, 500, corsHeaders);
  }

  try {
    await sendInviteEmail({
      toEmail: email,
      token,
      orgName: orgRow?.name,
      localName: localRow.name,
      invitedRole: role,
      expiresAt,
      invitationId,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to send invite',
      },
      502,
      corsHeaders,
    );
  }

  const { error: sentAtError } = await admin
    .from('invitations')
    .update({ sent_at: now.toISOString() })
    .eq('id', invitationId);

  if (sentAtError) {
    return jsonResponse({ error: sentAtError.message }, 500, corsHeaders);
  }

  const debugToken =
    Deno.env.get('INVITES_DEBUG_RETURN_TOKEN') === 'true' ? token : undefined;

  console.log('[provision_local_member]', {
    mode: 'invited_new_user',
    email,
    local_id: localId,
  });

  return jsonResponse(
    {
      ok: true,
      mode: 'invited_new_user',
      result: 'invited',
      email,
      invitation_id: invitationId,
      sent_at: now.toISOString(),
      debug_token: debugToken,
    },
    200,
    corsHeaders,
  );
});
