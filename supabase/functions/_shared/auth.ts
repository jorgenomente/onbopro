import { createAdminClient } from './db.ts';

type Profile = {
  user_id: string;
  email: string;
  is_superadmin: boolean;
};

export type AuthContext = {
  userId: string;
  email: string;
  isSuperadmin: boolean;
};

export function extractBearerToken(req: Request): string | null {
  const authHeader =
    req.headers.get('authorization') ??
    req.headers.get('x-supabase-authorization') ??
    req.headers.get('x-supabase-auth') ??
    '';
  const token = authHeader.replace('Bearer ', '').trim();

  return token ? token : null;
}

export async function requireAuthUser(req: Request): Promise<AuthContext> {
  const token = extractBearerToken(req);

  if (!token) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.getUser(token);

  if (error || !userData?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, email, is_superadmin')
    .eq('user_id', userData.user.id)
    .maybeSingle<Profile>();

  if (profileError || !profile?.user_id) {
    throw new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  return {
    userId: profile.user_id,
    email: profile.email,
    isSuperadmin: profile.is_superadmin,
  };
}

export async function isOrgAdmin(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('org_memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('role', 'org_admin')
    .eq('status', 'active')
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

export function requireOrgAccess(context: AuthContext, orgId: string): void {
  if (context.isSuperadmin) return;

  if (!orgId) {
    throw new Response(JSON.stringify({ error: 'org_id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}
