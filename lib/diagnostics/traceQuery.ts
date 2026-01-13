import { diag } from '@/lib/diagnostics/diag';

type TraceResult<T> = Promise<T>;

export async function traceQuery<T>(
  label: string,
  fn: () => TraceResult<T>,
): Promise<T> {
  const startedAt = Date.now();
  diag.log('query_start', { label });
  try {
    const result = await fn();
    diag.log('query_end', {
      label,
      ok: true,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    diag.log('query_end', {
      label,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
