import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

async function login(email, password) {
  const client = createClient(supabaseUrl, supabaseKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err.message);
  }
}

const LOCAL_A = '2580e080-bf31-41c0-8242-7d90b070d060';
const LOCAL_B = '13cd2ffe-ee2b-46b3-8fd0-bb8a705dd1ef';

async function run() {
  const aprendiz = await login(
    process.env.TEST_APRENDIZ_EMAIL,
    process.env.TEST_APRENDIZ_PASSWORD,
  );

  await test('Aprendiz ve SOLO su local', async () => {
    const { data, error } = await aprendiz.from('locals').select('id,name');

    if (error) throw error;

    const ids = data.map((r) => r.id);

    if (!ids.includes(LOCAL_A)) {
      throw new Error('No ve su propio local');
    }
    if (ids.includes(LOCAL_B)) {
      throw new Error('Ve un local que NO le pertenece');
    }
  });

  await test('Aprendiz ve SOLO su local_membership', async () => {
    const { data, error } = await aprendiz
      .from('local_memberships')
      .select('local_id,user_id');

    if (error) throw error;

    const ok = data.some((r) => r.local_id === LOCAL_A);
    if (!ok) {
      throw new Error('No ve su local_membership');
    }
  });
}

run();
