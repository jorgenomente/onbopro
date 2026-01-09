import { createAdminClient } from '../_shared/db.ts';
import { requireAuthUser } from '../_shared/auth.ts';
import { generateToken, sha256Bytea } from '../_shared/crypto.ts';
import { sendInviteEmail } from '../_shared/email.ts';
import { buildCorsHeaders } from '../_shared/cors.ts';

const INVITE_DAYS = 7;

type ProvisionPayload = {
  org_id?: string;
  email?: string;
};

type AuthUser = { id: string; email?: string | null };

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

async function getAuthUserByEmail(email: string): Promise<AuthUser | null> {
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

  const orgId = payload?.org_id?.trim();
  const email = payload?.email?.trim().toLowerCase();

  if (!orgId || !email) {
    return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders);
  }

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

  if (!authContext.isSuperadmin) {
    return jsonResponse({ error: 'Not authorized' }, 403, corsHeaders);
  }

  const admin = createAdminClient();
  const { data: orgRow, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !orgRow?.id) {
    return jsonResponse({ error: 'Organization not found' }, 404, corsHeaders);
  }

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
        { error: 'Profile lookup failed', hint: profileError.message },
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
        console.warn('[provision_org_admin]', {
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
        console.warn('[provision_org_admin]', {
          mode: 'assigned_existing_user',
          user_id: authUserId,
          profile_upsert_failed: true,
        });
      }
    }

    const { data: membershipRow, error: membershipError } = await admin
      .from('org_memberships')
      .upsert(
        {
          org_id: orgId,
          user_id: authUserId,
          role: 'org_admin',
          status: 'active',
          ended_at: null,
        },
        { onConflict: 'org_id,user_id' },
      )
      .select('id')
      .maybeSingle();

    if (membershipError || !membershipRow?.id) {
      return jsonResponse(
        {
          error: 'Membership upsert failed',
          hint: membershipError?.message,
        },
        500,
        corsHeaders,
      );
    }

    return jsonResponse(
      {
        ok: true,
        result: 'member_added',
        mode: 'assigned_existing_user',
        org_id: orgId,
        email,
        user_id: authUserId,
        membership_id: membershipRow.id,
      },
      200,
      corsHeaders,
    );
  }

  const now = new Date();
  const token = generateToken();
  const tokenHash = await sha256Bytea(token);
  const expiresAt = new Date(
    now.getTime() + INVITE_DAYS * 86400000,
  ).toISOString();

  const { data: invitationRow, error: inviteError } = await admin
    .from('invitations')
    .insert({
      org_id: orgId,
      local_id: null,
      email,
      invited_role: 'org_admin',
      status: 'pending',
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by_user_id: authContext.userId,
    })
    .select('id')
    .maybeSingle();

  if (inviteError || !invitationRow?.id) {
    return jsonResponse(
      { error: inviteError?.message ?? 'Failed to create invitation' },
      500,
      corsHeaders,
    );
  }

  try {
    await sendInviteEmail({
      toEmail: email,
      token,
      orgName: orgRow.name,
      invitedRole: 'org_admin',
      expiresAt,
      invitationId: invitationRow.id,
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
    .eq('id', invitationRow.id);

  if (sentAtError) {
    return jsonResponse({ error: sentAtError.message }, 500, corsHeaders);
  }

  const debugToken =
    Deno.env.get('INVITES_DEBUG_RETURN_TOKEN') === 'true' ? token : undefined;

  return jsonResponse(
    {
      ok: true,
      result: 'invited',
      mode: 'invited_new_user',
      org_id: orgId,
      email,
      invitation_id: invitationRow.id,
      resent_at: now.toISOString(),
      debug_token: debugToken,
    },
    200,
    corsHeaders,
  );
});
