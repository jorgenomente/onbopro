import { diag } from '@/lib/diagnostics/diag';

type InstrumentedFetchOptions = {
  label?: string;
  fetchImpl?: typeof fetch;
  instanceId?: string;
};

function sanitizeUrl(value: RequestInfo | URL) {
  try {
    const url = new URL(
      typeof value === 'string' ? value : value instanceof URL ? value : '',
    );
    url.search = '';
    return url.toString();
  } catch {
    if (typeof value === 'string') {
      return value.split('?')[0];
    }
    return '[request]';
  }
}

export async function instrumentedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: InstrumentedFetchOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const label = options.label ?? 'fetch';
  const method = init.method ?? 'GET';
  const url = sanitizeUrl(input);
  const startedAt = Date.now();
  const instanceId = options.instanceId ?? 'default';

  diag.log('fetch_start', { label, method, url, instanceId });

  try {
    const response = await fetchImpl(input, init);
    const durationMs = Date.now() - startedAt;
    diag.log('fetch_end', {
      label,
      method,
      url,
      status: response.status,
      durationMs,
      instanceId,
    });
    if (durationMs > 5000) {
      diag.log('fetch_slow', { label, method, url, durationMs, instanceId });
    }
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    diag.log('fetch_error', {
      label,
      method,
      url,
      durationMs,
      message: error instanceof Error ? error.message : String(error),
      instanceId,
    });
    throw error;
  }
}
