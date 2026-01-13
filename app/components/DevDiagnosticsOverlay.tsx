'use client';

import { useEffect, useMemo, useState } from 'react';
import { diag } from '@/lib/diagnostics/diag';

export default function DevDiagnosticsOverlay() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(() => diag.get());

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const interval = setInterval(() => {
      setEvents(diag.get());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const recent = useMemo(() => events.slice(-50).reverse(), [events]);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed right-4 bottom-4 z-[9999]">
      <button
        className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        Diag
      </button>
      {open ? (
        <div className="mt-2 max-h-[60vh] w-[360px] overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-xl">
          <div className="mb-2 text-xs font-semibold text-zinc-900">
            Diagnostics
          </div>
          <ul className="space-y-2">
            {recent.map((event, index) => (
              <li key={`${event.ts}-${event.type}-${index}`}>
                <div className="text-[10px] text-zinc-400">{event.ts}</div>
                <div className="font-semibold">{event.type}</div>
                {event.data ? (
                  <div className="text-[10px] whitespace-pre-wrap text-zinc-500">
                    {JSON.stringify(event.data)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
