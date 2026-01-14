/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { instrumentedFetch } from '@/lib/diagnostics/instrumentedFetch';
import { diag } from '@/lib/diagnostics/diag';
import { fetchWithAuthRetry } from './fetchWithAuthRetry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

/**
 * Reads the session directly from localStorage.
 * This bypasses the GoTrueClient locks that cause hangs after tab switches.
 */
function getSessionFromLocalStorage():
  | { data: { session: any }; error: null }
  | { data: { session: null }; error: null } {
  if (typeof window === 'undefined') {
    return { data: { session: null }, error: null };
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
        const item = localStorage.getItem(key);
        if (item) {
          const session = JSON.parse(item);
          console.log('[client.ts] 🔐 getSession from localStorage (bypass)');
          return { data: { session }, error: null };
        }
      }
    }
  } catch (err) {
    console.error('[client.ts] localStorage read error:', err);
  }

  return { data: { session: null }, error: null };
}

// Track if we're "poisoned" by tab switch
let isPoisoned = false;

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      isPoisoned = true;
    }
  });
}

// Reset poisoned state after successful navigation
if (typeof window !== 'undefined') {
  // Clear poisoned state periodically (every 30 seconds if page is visible)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      isPoisoned = false;
    }
  }, 30000);
}

// Internal instance that can be swapped
let internalClient = createInstance(true);

function createInstance(useCustomFetch: boolean) {
  const instanceId = Math.random().toString(36).slice(2, 10);

  if (process.env.NODE_ENV !== 'production') {
    diag.log('supabase_client_init', {
      id: instanceId,
      url: supabaseUrl,
      customFetch: useCustomFetch,
    });
  }

  const options: any = {};

  // Use resilient fetch for BOTH modes
  if (useCustomFetch) {
    options.global = {
      fetch: (input: any, init: any) =>
        instrumentedFetch(input, init, {
          label: 'supabase',
          instanceId: instanceId,
          fetchImpl: (nextInput, nextInit) =>
            fetchWithAuthRetry(nextInput, nextInit),
        }),
    };
  } else {
    options.global = {
      fetch: fetchWithAuthRetry,
    };
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, options);
}

/**
 * Creates a proxied version of the auth object that uses localStorage
 * for getSession when the client is "poisoned" by tab switches.
 */
function createAuthProxy(originalAuth: any) {
  return new Proxy(originalAuth, {
    get(target, prop) {
      // Intercept getSession to bypass locks when poisoned
      if (prop === 'getSession') {
        return async () => {
          if (isPoisoned) {
            console.log('[client.ts] 🛡️ Bypassing getSession (poisoned state)');
            return getSessionFromLocalStorage();
          }
          // Not poisoned, use normal getSession
          return target.getSession();
        };
      }

      // For all other auth methods, return the original
      const value = target[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });
}

// Export a Proxy that redirects everything to the current internal instance
// with special handling for the auth object
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    // Special handling for auth to intercept getSession
    if (prop === 'auth') {
      return createAuthProxy((internalClient as any).auth);
    }

    // Forward all other property accesses to the current internal client
    const value = (internalClient as any)[prop];
    if (typeof value === 'function') {
      return value.bind(internalClient);
    }
    return value;
  },
});

export const resetSupabaseClient = () => {
  diag.log('supabase_client_reset', { mode: 'fallback_vanilla' });
  internalClient = createInstance(false);
  // Clear poisoned state on reset
  isPoisoned = false;
};

// Export for manual poisoning control if needed
export const markClientAsPoisoned = () => {
  isPoisoned = true;
};

export const clearClientPoisonState = () => {
  isPoisoned = false;
};
