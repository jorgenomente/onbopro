import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_EMAIL = 'orgadmin@test.com';

async function findUserIdByEmail(email) {
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.user_id) return profile.user_id;

  let page = 1;
  const perPage = 200;
  while (page < 6) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const found = (data?.users ?? []).find((user) => user.email === email);
    if (found) return found.id;
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function main() {
  console.log(`Assigning local to ${TARGET_EMAIL}...`);

  const userId = await findUserIdByEmail(TARGET_EMAIL);
  if (!userId) {
    throw new Error(`User not found for ${TARGET_EMAIL}`);
  }

  const { data: orgMemberships, error: orgError } = await client
    .from('org_memberships')
    .select('org_id, role, status')
    .eq('user_id', userId)
    .eq('role', 'org_admin')
    .eq('status', 'active');

  if (orgError) throw orgError;
  if (!orgMemberships || orgMemberships.length === 0) {
    throw new Error('No active org_admin memberships found for this user.');
  }

  const orgId = orgMemberships[0].org_id;

  const { data: localRow, error: localError } = await client
    .from('locals')
    .select('id, org_id, name, archived_at, created_at')
    .eq('org_id', orgId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (localError) throw localError;
  if (!localRow?.id) {
    throw new Error('No active locals found for org. Create a local first.');
  }

  const { data: existingMemberships, error: localMembershipError } =
    await client
      .from('local_memberships')
      .select('id, local_id, status, is_primary')
      .eq('user_id', userId)
      .eq('local_id', localRow.id)
      .eq('status', 'active')
      .limit(1);

  if (localMembershipError) throw localMembershipError;

  if (existingMemberships && existingMemberships.length > 0) {
    console.log('Already assigned to local.');
    console.log({
      userId,
      orgId,
      localId: localRow.id,
      localName: localRow.name,
      membershipId: existingMemberships[0].id,
    });
    return;
  }

  const { data: primaryMemberships, error: primaryError } = await client
    .from('local_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('is_primary', true)
    .limit(1);

  if (primaryError) throw primaryError;

  const shouldBePrimary =
    !primaryMemberships || primaryMemberships.length === 0;

  const { data: membership, error: upsertError } = await client
    .from('local_memberships')
    .upsert(
      {
        org_id: orgId,
        local_id: localRow.id,
        user_id: userId,
        role: 'referente',
        status: 'active',
        ended_at: null,
        is_primary: shouldBePrimary,
      },
      { onConflict: 'local_id,user_id' },
    )
    .select('id')
    .maybeSingle();

  if (upsertError || !membership?.id) {
    throw upsertError ?? new Error('Failed to create local membership.');
  }

  console.log('Assigned local successfully.');
  console.log({
    userId,
    orgId,
    localId: localRow.id,
    localName: localRow.name,
    membershipId: membership.id,
  });
}

main().catch((error) => {
  console.error('Assignment failed:', error);
  process.exit(1);
});
