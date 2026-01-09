'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type CompleteProfileModalProps = {
  userId: string | null;
  initialFullName?: string | null;
  onSaved: (fullName: string) => void;
};

export default function CompleteProfileModal({
  userId,
  initialFullName,
  onSaved,
}: CompleteProfileModalProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = useMemo(() => {
    const trimmed = fullName.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  }, [fullName]);

  const handleSave = async () => {
    if (!userId) return;
    const trimmed = fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setError('El nombre debe tener entre 2 y 100 caracteres.');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: trimmed })
      .eq('user_id', userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message ?? 'No se pudo guardar el nombre.');
      return;
    }

    onSaved(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-900">
          Completá tu perfil
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Necesitamos tu nombre para que el equipo pueda reconocerte.
        </p>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-zinc-700">
            Nombre y apellido
          </label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            type="text"
            placeholder="Ej: Juan Pérez"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6">
          <button
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
