import { supabase } from '@/lib/supabase/client';

type InvokeEdgeOptions = {
  anon?: boolean;
  headers?: Record<string, string>;
};

type InvokeEdgeError = {
  message: string;
  status: number;
  code?: string | null;
  details?: string | null;
};

type InvokeEdgeResult<T> = {
  data: T | null;
  error: InvokeEdgeError | null;
  status: number;
};

export async function invokeEdge<T = unknown>(
  functionName: string,
  body: unknown,
  opts: InvokeEdgeOptions = {},
): Promise<InvokeEdgeResult<T>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const functionsUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL;
  const isBrowser = typeof window !== 'undefined';
  const isDev = process.env.NODE_ENV !== 'production';

  if (!functionName) {
    return {
      data: null,
      error: { message: 'Missing function name', status: 400 },
      status: 400,
    };
  }

  if (!supabaseUrl || !anonKey) {
    return {
      data: null,
      error: { message: 'Missing Supabase configuration', status: 500 },
      status: 500,
    };
  }

  const isLocalSupabaseUrl =
    supabaseUrl.startsWith('http://localhost') ||
    supabaseUrl.startsWith('http://127.0.0.1');
  if (!supabaseUrl.startsWith('https://') && !isLocalSupabaseUrl) {
    return {
      data: null,
      error: { message: 'Invalid Supabase URL', status: 500 },
      status: 500,
    };
  }

  const functionsUrl =
    functionsUrlEnv?.trim() ||
    (supabaseUrl.startsWith('https://') && supabaseUrl.endsWith('.supabase.co')
      ? supabaseUrl.replace('.supabase.co', '.functions.supabase.co')
      : '');

  if (!functionsUrl) {
    return {
      data: null,
      error: {
        message: 'Missing Supabase Functions URL',
        status: 500,
      },
      status: 500,
    };
  }

  const isLocalFunctionsUrl =
    functionsUrl.startsWith('http://localhost') ||
    functionsUrl.startsWith('http://127.0.0.1');
  if (!functionsUrl.startsWith('https://') && !isLocalFunctionsUrl) {
    return {
      data: null,
      error: { message: 'Invalid Supabase Functions URL', status: 500 },
      status: 500,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = opts.anon ? null : (sessionData?.session?.access_token ?? null);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    ...opts.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const endpoint = `${functionsUrl}/${functionName}`;

  if (isDev) {
    const origin = isBrowser ? window.location.origin : null;
    if (!functionsUrlEnv) {
      console.warn('[invokeEdge] functions URL fallback in use', {
        supabaseUrl,
        functionsUrl,
      });
    }
    console.info('[invokeEdge]', {
      functionName,
      supabaseUrl,
      functionsUrl,
      endpoint,
      isBrowser,
      origin,
    });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message ? err.message : 'Failed to fetch';
    const hint = message.toLowerCase().includes('failed to fetch')
      ? 'Check NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL, CORS, mixed content, and function deployment.'
      : null;
    return {
      data: null,
      error: {
        message,
        status: 0,
        code: 'FETCH_FAILED',
        details: hint,
      },
      status: 0,
    };
  }

  let payload: T | { error?: string } | Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as T;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const payloadObject =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;
    const message =
      (payloadObject?.error as string | undefined) ??
      response.statusText ??
      'Request failed';
    const code =
      typeof payloadObject?.error_code === 'string'
        ? payloadObject.error_code
        : null;
    const details =
      payloadObject?.error_status !== undefined
        ? String(payloadObject.error_status)
        : null;
    return {
      data: null,
      error: {
        message,
        status: response.status,
        code,
        details,
      },
      status: response.status,
    };
  }

  return { data: payload as T, error: null, status: response.status };
}
