'use client';

import InvitationCard, { InvitationRow } from './InvitationCard';

type InvitationsListProps = {
  rows: InvitationRow[];
  emptyLabel?: string;
  onResend: (invitationId: string) => void;
  actioningId?: string | null;
};

export default function InvitationsList({
  rows,
  emptyLabel,
  onResend,
  actioningId,
}: InvitationsListProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600">
        {emptyLabel ?? 'No hay invitaciones aún.'}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <InvitationCard
          key={row.invitation_id}
          row={row}
          onResend={onResend}
          actioningId={actioningId}
        />
      ))}
    </div>
  );
}
