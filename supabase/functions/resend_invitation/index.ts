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

  let payload: { invitation_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const invitationId = payload?.invitation_id;
  if (!invitationId) {
    return jsonResponse({ error: 'invitation_id required' }, 400, corsHeaders);
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

  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from('invitations')
    .select('id, org_id, local_id, email, invited_role, status, expires_at')
    .eq('id', invitationId)
    .maybeSingle();

  if (error || !invitation?.id) {
    return jsonResponse({ error: 'Invitation not found' }, 404, corsHeaders);
  }

  const orgAllowed =
    authContext.isSuperadmin ||
    (await isOrgAdmin(authContext.userId, invitation.org_id));

  if (!orgAllowed) {
    return jsonResponse({ error: 'Not authorized' }, 403, corsHeaders);
  }

  if (invitation.status !== 'pending') {
    return jsonResponse({ error: 'Invitation not pending' }, 400, corsHeaders);
  }

  const now = new Date();
  const expired = new Date(invitation.expires_at) <= now;
  const token = generateToken();
  const tokenHash = await sha256Bytea(token);
  const expiresAt = new Date(
    now.getTime() + INVITE_DAYS * 86400000,
  ).toISOString();

  let targetInvitationId = invitation.id;

  if (expired) {
    const { error: expireError } = await admin
      .from('invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);

    if (expireError) {
      return jsonResponse({ error: expireError.message }, 500, corsHeaders);
    }

    const { data: newInvite, error: createError } = await admin
      .from('invitations')
      .insert({
        org_id: invitation.org_id,
        local_id: invitation.local_id,
        email: invitation.email,
        invited_role: invitation.invited_role,
        status: 'pending',
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by_user_id: authContext.userId,
      })
      .select('id')
      .maybeSingle();

    if (createError || !newInvite?.id) {
      return jsonResponse(
        { error: createError?.message ?? 'Failed' },
        500,
        corsHeaders,
      );
    }

    targetInvitationId = newInvite.id;
  } else {
    const { error: updateError } = await admin
      .from('invitations')
      .update({
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .eq('id', invitation.id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500, corsHeaders);
    }
  }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('name')
    .eq('id', invitation.org_id)
    .maybeSingle();

  let localName: string | undefined;
  if (invitation.local_id) {
    const { data: localRow, error: localError } = await admin
      .from('locals')
      .select('name')
      .eq('id', invitation.local_id)
      .maybeSingle();

    if (localError || !localRow?.name) {
      return jsonResponse({ error: 'Local not found' }, 404, corsHeaders);
    }

    localName = localRow.name;
  } else if (invitation.invited_role !== 'org_admin') {
    return jsonResponse(
      { error: 'local_id missing for invitation' },
      400,
      corsHeaders,
    );
  }

  try {
    await sendInviteEmail({
      toEmail: invitation.email,
      token,
      orgName: orgRow?.name,
      localName,
      invitedRole: invitation.invited_role,
      expiresAt,
      invitationId: targetInvitationId,
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
    .eq('id', targetInvitationId);

  if (sentAtError) {
    return jsonResponse({ error: sentAtError.message }, 500, corsHeaders);
  }

  const debugToken =
    Deno.env.get('INVITES_DEBUG_RETURN_TOKEN') === 'true' ? token : undefined;

  return jsonResponse(
    {
      ok: true,
      invitation_id: targetInvitationId,
      resent_at: now.toISOString(),
      debug_token: debugToken,
    },
    200,
    corsHeaders,
  );
});
