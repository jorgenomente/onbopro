/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { supabase } from '@/lib/supabase/client';
import { diag } from '@/lib/diagnostics/diag';
import { withTimeout, TimeoutError } from '@/lib/withTimeout';

interface SafeFetchOptions {
  timeoutMs?: number;
  retryOnTimeout?: boolean;
}

/**
 * Robustly fetches data from a Supabase view or table.
 * Tries the standard client first, then falls back to manual REST fetch.
 */
export async function safeFetchView<T = any>(
  viewName: string,
  options: SafeFetchOptions = {},
): Promise<{ data: T[] | null; error: any }> {
  const timeoutMs = options.timeoutMs ?? 3000;

  // 1. Try standard client
  try {
    const executeQuery = async () => {
      return await supabase.from(viewName).select('*');
    };

    // Use a short timeout to fail fast
    const result = await withTimeout(executeQuery(), timeoutMs, viewName);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { data: result.data, error: null };
  } catch (err) {
    // Only fallback on timeout or specific connection errors
    // If it's a logic error (e.g. column not found), let it fail.
    const isTimeout = err instanceof TimeoutError;
    // We treat "Failed to fetch" (network error) as fallback-worthy too
    const isNetworkError =
      err instanceof Error &&
      (err.message.includes('Failed to fetch') ||
        err.message.includes('network'));

    if (!isTimeout && !isNetworkError) {
      // Re-throw genuine errors
      throw err;
    }

    diag.log('safe_fetch_fallback', {
      viewName,
      reason: isTimeout ? 'timeout' : 'network_error',
    });

    // 2. Manual Fetch Fallback (Nuclear Option)
    return await manualFetch(viewName);
  }
}

async function manualFetch(viewName: string) {
  let token: string | undefined;

  // Try getting session from client (with timeout)
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 1000),
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    token = data?.session?.access_token;
  } catch (e) {
    // Ignore error
  }

  // Fallback to localStorage
  if (!token && typeof window !== 'undefined') {
    try {
      const keys = Object.keys(localStorage);
      const sbKey = keys.find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      if (sbKey) {
        const item = localStorage.getItem(sbKey);
        if (item) {
          const parsed = JSON.parse(item);
          token = parsed.access_token;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!token) {
    return {
      data: null,
      error: { message: 'No access token available for recovery' },
    };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${viewName}?select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      return {
        data: null,
        error: { message: `Manual fetch failed: ${response.statusText}` },
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message } };
  }
}
