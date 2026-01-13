import { diag } from '@/lib/diagnostics/diag';

type FetchTimeoutOptions = {
  timeoutMs?: number;
  label?: string;
  retries?: number;
};

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') || message.includes('network');
}

export async function fetchWithTimeoutAbort(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchTimeoutOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const label = options.label ?? 'request';
  const retries = options.retries ?? 0;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      if (process.env.NODE_ENV !== 'production') {
        diag.log('fetch_abort_timeout', { label, timeoutMs });
      }
    }, timeoutMs);
    const startedAt = Date.now();
    const externalSignal = init.signal;
    const abortFromExternal = externalSignal ? () => controller.abort() : null;

    if (externalSignal && abortFromExternal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', abortFromExternal);
      }
    }

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (process.env.NODE_ENV !== 'production') {
        const durationMs = Date.now() - startedAt;
        if (durationMs > 5000) {
          console.warn('[fetch-timeout]', label, {
            durationMs,
            status: response.status,
          });
        }
      }
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[fetch-timeout] error', label, {
          durationMs,
          message: error instanceof Error ? error.message : String(error),
          attempt,
        });
      }

      const inputIsRequest = input instanceof Request && input.bodyUsed;
      if (attempt < retries && isRetryableError(error) && !inputIsRequest) {
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      if (externalSignal && abortFromExternal) {
        externalSignal.removeEventListener('abort', abortFromExternal);
      }
      clearTimeout(timeoutId);
    }
  }
}
