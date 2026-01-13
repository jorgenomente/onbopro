type DiagnosticEvent = {
  ts: string;
  type: string;
  data?: Record<string, unknown>;
};

const MAX_EVENTS = 200;
const buffer: DiagnosticEvent[] = [];

const enabled = process.env.NODE_ENV !== 'production';

export const diag = {
  log(type: string, data?: Record<string, unknown>) {
    if (!enabled) return;
    buffer.push({ ts: new Date().toISOString(), type, data });
    if (buffer.length > MAX_EVENTS) {
      buffer.splice(0, buffer.length - MAX_EVENTS);
    }
  },
  get(): DiagnosticEvent[] {
    if (!enabled) return [];
    return [...buffer];
  },
};
