/* eslint-disable @typescript-eslint/no-explicit-any */
import { diag } from '@/lib/diagnostics/diag';

const TIMEOUT_MS = 10000;

/**
 * Finds and returns the Supabase access token from localStorage.
 */
function getLocalSessionToken(): string | null {
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
    console.error('[fetchWithAuthRetry] localStorage error:', err);
  }
  return null;
}

/**
 * Clones RequestInit and replaces the Authorization header.
 */
function cloneInitWithNewToken(
  init: RequestInit | undefined,
  newToken: string,
): RequestInit {
  const newInit: RequestInit = { ...init };
  const existingHeaders: Record<string, string> = {};

  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        existingHeaders[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        existingHeaders[key] = value;
      });
    } else {
      Object.assign(existingHeaders, init.headers);
    }
  }

  existingHeaders['Authorization'] = `Bearer ${newToken}`;
  newInit.headers = existingHeaders;

  return newInit;
}

// Track if we're returning from a hidden state
let wasTabHidden = false;

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasTabHidden = true;
      console.log('[fetchWithAuthRetry] 📴 Tab hidden');
    } else {
      console.log(
        '[fetchWithAuthRetry] 📱 Tab visible, wasHidden:',
        wasTabHidden,
      );
    }
  });
}

/**
 * Resilient fetch with detailed diagnostics
 */
export async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const isSupabaseRest = url.includes('/rest/v1/');
  const isSupabaseAuth = url.includes('/auth/v1/');
  const requestId = Math.random().toString(36).slice(2, 6);

  // Only log Supabase requests to reduce noise
  const shouldLog = isSupabaseRest || isSupabaseAuth;

  const log = (step: string, data?: Record<string, any>) => {
    if (!shouldLog) return;
    const endpoint = url.split('?')[0].split('/').pop();
    console.log(`[fetch:${requestId}] ${step}`, {
      endpoint,
      wasTabHidden,
      ...data,
    });
    diag.log('fetch_trace', {
      requestId,
      step,
      endpoint,
      wasTabHidden,
      ...data,
    });
  };

  const doFetch = async (
    fetchUrl: RequestInfo | URL,
    options?: RequestInit,
    attempt: number = 1,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      log('⏰ TIMEOUT', { attempt, timeoutMs: TIMEOUT_MS });
      controller.abort();
    }, TIMEOUT_MS);

    log(`🚀 fetch start`, { attempt });
    const startTime = Date.now();

    try {
      const fetchOptions = options?.signal
        ? options
        : { ...options, signal: controller.signal };

      const response = await fetch(fetchUrl, fetchOptions);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      log(`✅ fetch complete`, { attempt, status: response.status, duration });

      // Reset wasTabHidden after successful fetch
      if (wasTabHidden) {
        wasTabHidden = false;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      log(`❌ fetch error`, {
        attempt,
        duration,
        errorName: err.name,
        errorMessage: err.message,
      });
      throw err;
    }
  };

  // First attempt
  try {
    const response = await doFetch(input, init, 1);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      log('🔐 Got 401, checking localStorage token');
      const freshToken = getLocalSessionToken();
      if (freshToken) {
        log('🔄 Retrying with localStorage token');
        const newInit = cloneInitWithNewToken(init, freshToken);
        return await doFetch(input, newInit, 2);
      } else {
        log('⚠️ No token in localStorage');
      }
    }

    return response;
  } catch (err: any) {
    const isRetryable =
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError');

    log('🔍 Checking if retryable', {
      errorName: err.name,
      isRetryable,
    });

    if (isRetryable) {
      const freshToken = getLocalSessionToken();
      if (freshToken) {
        log('🔄 Retrying after error with localStorage token');
        const newInit = cloneInitWithNewToken(init, freshToken);
        return await doFetch(input, newInit, 2);
      } else {
        log('⚠️ Cannot retry - no token in localStorage');
      }
    }

    throw err;
  }
}
