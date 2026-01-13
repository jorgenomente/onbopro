import { diag } from '@/lib/diagnostics/diag';

type RecheckResult = {
  ok: boolean;
  refreshed: boolean;
  token: string | null;
  expiresAt: number | null;
  reason?: string;
};

type RecheckOptions = {
  forceRefresh?: boolean;
};

const REFRESH_WINDOW_SEC = 120;
const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SessionShape = {
  access_token?: string | null;
  expires_at?: number | null;
};

type GetSessionResult = {
  data: { session: SessionShape | null };
  error?: { message?: string } | null;
};

export async function recheckSession(
  supabase: {
    auth: {
      getSession: () => Promise<GetSessionResult>;
      refreshSession: () => Promise<unknown>;
    };
  },
  options: RecheckOptions = {},
): Promise<RecheckResult> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session ?? null;
  const token = session?.access_token ?? null;
  const expiresAt = session?.expires_at ?? null;
  const secondsLeft =
    expiresAt !== null ? Math.floor(expiresAt - Date.now() / 1000) : null;

  if (process.env.NODE_ENV !== 'production') {
    diag.log('session_recheck_start', {
      hasSession: Boolean(session),
      secondsLeft,
      forceRefresh: Boolean(options.forceRefresh),
      error: error?.message ?? null,
    });
  }

  if (!session) {
    return {
      ok: false,
      refreshed: false,
      token: null,
      expiresAt: null,
      reason: 'no_session',
    };
  }

  const shouldRefresh =
    options.forceRefresh ||
    (secondsLeft !== null && secondsLeft < REFRESH_WINDOW_SEC);

  if (shouldRefresh) {
    try {
      void supabase.auth.refreshSession();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        diag.log('session_recheck_refresh_fire', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
      await sleep(POLL_DELAY_MS);
      const { data: nextData } = await supabase.auth.getSession();
      const nextSession = nextData.session ?? null;
      const nextToken = nextSession?.access_token ?? null;
      const nextExpiresAt = nextSession?.expires_at ?? null;
      if (nextToken && nextToken !== token) {
        if (process.env.NODE_ENV !== 'production') {
          diag.log('session_recheck_end', {
            refreshed: true,
            secondsLeft: nextExpiresAt
              ? Math.floor(nextExpiresAt - Date.now() / 1000)
              : null,
          });
        }
        return {
          ok: true,
          refreshed: true,
          token: nextToken,
          expiresAt: nextExpiresAt ?? null,
        };
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    diag.log('session_recheck_end', {
      refreshed: false,
      secondsLeft,
    });
  }

  return { ok: true, refreshed: false, token, expiresAt };
}
