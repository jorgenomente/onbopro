'use client';

export type InvitationRow = {
  invitation_id: string;
  email: string;
  org_id: string;
  local_id: string | null;
  local_name: string | null;
  role: 'aprendiz' | 'referente' | 'org_admin';
  status: 'pending' | 'accepted' | 'expired';
  sent_at: string | null;
  expires_at: string | null;
};

type InvitationCardProps = {
  row: InvitationRow;
  onResend: (invitationId: string) => void;
  actioningId?: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(status: InvitationRow['status']) {
  if (status === 'accepted') return 'Aceptada';
  if (status === 'expired') return 'Expirada';
  return 'Pendiente';
}

function statusStyles(status: InvitationRow['status']) {
  if (status === 'accepted') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'expired') {
    return 'bg-zinc-200 text-zinc-700';
  }
  return 'bg-amber-100 text-amber-700';
}

function roleLabel(role: InvitationRow['role']) {
  if (role === 'org_admin') return 'Org Admin';
  if (role === 'aprendiz') return 'Aprendiz';
  return 'Referente';
}

export default function InvitationCard({
  row,
  onResend,
  actioningId,
}: InvitationCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {row.email}
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            {roleLabel(row.role)} · {row.local_name ?? 'Organización'}
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
            <span>Enviada: {formatDate(row.sent_at)}</span>
            <span>Expira: {formatDate(row.expires_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
              row.status,
            )}`}
          >
            {statusLabel(row.status)}
          </span>
          {row.status === 'pending' && (
            <button
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
              type="button"
              disabled={actioningId === row.invitation_id}
              onClick={() => onResend(row.invitation_id)}
            >
              {actioningId === row.invitation_id ? 'Reenviando...' : 'Reenviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
