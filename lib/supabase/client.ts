import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeoutAbort } from '@/lib/http/fetchWithTimeoutAbort';
import { instrumentedFetch } from '@/lib/diagnostics/instrumentedFetch';
import { diag } from '@/lib/diagnostics/diag';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

export const SUPABASE_CLIENT_INSTANCE_ID = Math.random()
  .toString(36)
  .slice(2, 10);
const fetchMode =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DIAG_FETCH_MODE === 'plain'
    ? 'plain'
    : 'timeout';

if (process.env.NODE_ENV !== 'production') {
  diag.log('supabase_client_init', {
    id: SUPABASE_CLIENT_INSTANCE_ID,
    url: supabaseUrl,
  });
  diag.log('fetch_mode', {
    mode: fetchMode,
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) =>
      instrumentedFetch(input, init, {
        label: 'supabase',
        instanceId: SUPABASE_CLIENT_INSTANCE_ID,
        fetchImpl:
          fetchMode === 'plain'
            ? fetch
            : (nextInput, nextInit) =>
                fetchWithTimeoutAbort(nextInput, nextInit, {
                  timeoutMs: 15000,
                  label: 'supabase',
                  retries: 1,
                }),
      }),
  },
});
