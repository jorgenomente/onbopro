'use client';

import { useMemo, useState } from 'react';
import { invokeEdge } from '@/lib/invokeEdge';

export type InviteMemberResult = 'member_added' | 'invited';

type LocalOption = {
  local_id: string;
  local_name: string;
};

type InviteMemberModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  locals?: LocalOption[];
  defaultLocalId?: string | null;
  defaultLocalName?: string | null;
  lockLocal?: boolean;
  onSuccess?: (result?: InviteMemberResult) => void;
};

type InviteResponse =
  | {
      ok: true;
      result: 'member_added';
      mode: 'assigned_existing_user';
      invitation_id?: string | null;
    }
  | {
      ok: true;
      result: 'invited';
      mode: 'invited_new_user';
      invitation_id: string;
    };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function InviteMemberModal({
  open,
  onOpenChange,
  orgId,
  locals,
  defaultLocalId,
  defaultLocalName,
  lockLocal,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'aprendiz' | 'referente'>('aprendiz');
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(
    defaultLocalId ?? null,
  );
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableLocals = useMemo(() => {
    if (!locals) return [];
    const normalized = search.trim().toLowerCase();
    if (!normalized) return locals;
    return locals.filter((local) =>
      local.local_name.toLowerCase().includes(normalized),
    );
  }, [locals, search]);

  const handleClose = () => {
    onOpenChange(false);
    setError('');
    setSearch('');
    setEmail('');
    setRole('aprendiz');
    setSelectedLocalId(defaultLocalId ?? null);
  };

  const handleSubmit = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError('Ingresá un email válido.');
      return;
    }

    const localId = defaultLocalId ?? selectedLocalId;
    if (!localId) {
      setError('Seleccioná un local.');
      return;
    }

    setSubmitting(true);
    const { data, error: edgeError } = await invokeEdge<InviteResponse>(
      'provision_local_member',
      {
        org_id: orgId,
        local_id: localId,
        email: trimmedEmail,
        role,
      },
    );

    setSubmitting(false);

    if (edgeError) {
      setError(edgeError.message ?? 'No se pudo enviar la invitación.');
      return;
    }

    if (!data?.ok) {
      setError('Respuesta inválida del servidor.');
      return;
    }

    handleClose();
    onSuccess?.(data.result);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-900">Invitar miembro</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Enviá una invitación para sumar un aprendiz o referente.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-600">Email</label>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@dominio.com"
              type="email"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600">Rol</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'aprendiz', label: 'Aprendiz' },
                  { value: 'referente', label: 'Referente' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    role === option.value
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600">Local</label>
            {lockLocal ? (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {defaultLocalName ?? 'Local seleccionado'}
              </div>
            ) : (
              <>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar local..."
                />
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {availableLocals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                      No hay locales disponibles.
                    </div>
                  ) : (
                    availableLocals.map((local) => {
                      const selected = selectedLocalId === local.local_id;
                      return (
                        <button
                          key={local.local_id}
                          type="button"
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? 'border-zinc-900 bg-zinc-900/5 text-zinc-900'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                          }`}
                          onClick={() => setSelectedLocalId(local.local_id)}
                        >
                          <span className="font-semibold">
                            {local.local_name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            type="button"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Enviando...' : 'Invitar'}
          </button>
        </div>
      </div>
    </div>
  );
}
