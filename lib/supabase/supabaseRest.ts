/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Direct REST API wrapper for Supabase that bypasses the supabase-js client.
 *
 * WHY: The supabase-js client internally calls `getSession()` before making
 * HTTP requests to get the auth token. After browser tab switches, this
 * `getSession()` call can hang indefinitely due to internal GoTrueClient locks.
 *
 * This wrapper reads the token directly from localStorage and makes direct
 * fetch calls to the Supabase REST API, completely bypassing the problematic
 * client code.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TIMEOUT_MS = 15000;

/**
 * Gets the access token from localStorage (where Supabase persists sessions)
 */
function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
        const item = localStorage.getItem(key);
        if (item) {
          const session = JSON.parse(item);
          return session.access_token || null;
        }
      }
    }
  } catch (err) {
    console.error('[supabaseRest] Failed to read token from localStorage', err);
  }
  return null;
}

export type RestQueryResult<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
};

export type RestSingleResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

interface QueryOptions {
  select?: string;
  eq?: Record<string, string | number | boolean>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
}

/**
 * Makes a direct REST API call to Supabase, bypassing the JS client.
 */
export async function supabaseRest<T = any>(
  table: string,
  options: QueryOptions = {},
): Promise<RestQueryResult<T>> {
  const { select = '*', eq = {}, order, limit } = options;

  const token = getTokenFromStorage();
  if (!token) {
    console.warn(
      '[supabaseRest] No token in localStorage - user may need to login',
    );
    return {
      data: null,
      error: { message: 'No authentication token', code: 'NO_TOKEN' },
    };
  }

  // Build URL with query params
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);

  // Add equality filters
  for (const [key, value] of Object.entries(eq)) {
    url.searchParams.set(key, `eq.${value}`);
  }

  // Add ordering
  if (order) {
    url.searchParams.set(
      'order',
      `${order.column}.${order.ascending ? 'asc' : 'desc'}`,
    );
  }

  // Add limit
  if (limit) {
    url.searchParams.set('limit', String(limit));
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // For .single() behavior, add header to get single object
  if (options.single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  console.log(`[supabaseRest] 🚀 ${table}`, {
    select,
    eq: Object.keys(eq).length > 0 ? eq : undefined,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[supabaseRest] ❌ ${table}`, {
        status: response.status,
        body: errorBody,
      });
      return {
        data: null,
        error: { message: errorBody, code: String(response.status) },
      };
    }

    const data = await response.json();
    console.log(`[supabaseRest] ✅ ${table}`, {
      count: Array.isArray(data) ? data.length : 1,
    });

    return { data, error: null };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error(`[supabaseRest] ❌ ${table}`, {
      error: err.message,
      isTimeout,
    });
    return {
      data: null,
      error: {
        message: isTimeout ? 'Request timed out' : err.message,
        code: 'FETCH_ERROR',
      },
    };
  }
}

/**
 * Convenience function for single-row queries
 */
export async function supabaseRestSingle<T = any>(
  table: string,
  options: Omit<QueryOptions, 'single'> = {},
): Promise<RestSingleResult<T>> {
  const result = await supabaseRest<T>(table, {
    ...options,
    single: true,
    limit: 1,
  });

  // Handle the single case
  if (result.error) {
    return { data: null, error: result.error };
  }

  // If we got an array (shouldn't happen with Accept header, but just in case)
  if (Array.isArray(result.data)) {
    return { data: result.data[0] || null, error: null };
  }

  return { data: result.data as unknown as T, error: null };
}
