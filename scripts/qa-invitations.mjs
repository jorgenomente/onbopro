import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.TEST_ORGADMIN_EMAIL;
const password = process.env.TEST_ORGADMIN_PASSWORD;
const existing = process.env.TEST_APRENDIZ_EMAIL;

if (!url || !key || !email || !password || !existing) {
  console.error('Missing envs for QA');
  process.exit(1);
}

const orgId = '219c2724-033c-4f98-bc2a-3ffe12c5a618';
const localId = '2580e080-bf31-41c0-8242-7d90b070d060';

const client = createClient(url, key);
const { data: loginData, error: loginError } =
  await client.auth.signInWithPassword({
    email,
    password,
  });
if (loginError) {
  console.error('Login error', loginError);
  process.exit(1);
}

const token = loginData.session?.access_token;
if (!token) {
  console.error('Missing access token from login');
  process.exit(1);
}
console.log('Org admin token length', token.length);
const anonClient = createClient(url, key);

const newEmail = `invite-${Date.now()}@example.com`;
console.log('QA emails', { existing, newEmail });

let { data: body, error: provisionError } = await client.functions.invoke(
  'provision_local_member',
  {
    body: {
      org_id: orgId,
      local_id: localId,
      email: existing,
      role: 'aprendiz',
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
);
if (provisionError) {
  console.log('provision existing error', provisionError);
} else {
  console.log('provision existing', body);
}

({ data: body, error: provisionError } = await client.functions.invoke(
  'provision_local_member',
  {
    body: {
      org_id: orgId,
      local_id: localId,
      email: newEmail,
      role: 'aprendiz',
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
));
if (provisionError) {
  console.log('provision new error', provisionError);
} else {
  console.log('provision new', body);
}

let inviteToken = body?.debug_token ?? null;
const inviteId = body?.invitation_id ?? null;

if (inviteId) {
  const resendResult = await client.functions.invoke('resend_invitation', {
    body: { invitation_id: inviteId },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('resend pending', resendResult.data ?? resendResult.error);
  if (resendResult.data?.debug_token) {
    inviteToken = resendResult.data.debug_token;
  }
}

let acceptResult = await anonClient.functions.invoke('accept_invitation', {
  body: { token: inviteToken, password: 'TempPass123!' },
});
console.log('accept new', acceptResult.data ?? acceptResult.error);

({ data: body, error: provisionError } = await client.functions.invoke(
  'provision_local_member',
  {
    body: {
      org_id: orgId,
      local_id: localId,
      email: existing,
      role: 'referente',
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
));
if (provisionError) {
  console.log('provision existing for 409 error', provisionError);
} else {
  console.log('provision existing for 409', body);
}

const token409 = body?.debug_token ?? null;
if (!token409) {
  console.log('accept existing no jwt (skip: no invitation token)');
} else {
  acceptResult = await anonClient.functions.invoke('accept_invitation', {
    body: { token: token409 },
  });
  console.log(
    'accept existing no jwt',
    acceptResult.data ?? acceptResult.error,
  );
}
