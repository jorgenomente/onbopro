import { sendResendEmail } from './resend.ts';
import { buildInviteEmail } from './email/templates/invite.ts';

export type InviteEmailPayload = {
  toEmail: string;
  token: string;
  orgName?: string | null;
  localName?: string | null;
  invitedRole?: string | null;
  expiresAt?: string | null;
  invitationId?: string | null;
};

export type InviteEmailResult = { ok: true; resendId: string | null };

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function sendInviteEmail(
  payload: InviteEmailPayload,
): Promise<InviteEmailResult> {
  const appUrl = requireEnv(Deno.env.get('APP_URL'), 'APP_URL');
  const emailFrom = requireEnv(Deno.env.get('EMAIL_FROM'), 'EMAIL_FROM');
  requireEnv(Deno.env.get('RESEND_API_KEY'), 'RESEND_API_KEY');

  const { subject, html, text } = buildInviteEmail({
    appUrl,
    token: payload.token,
    orgName: payload.orgName,
    localName: payload.localName,
    invitedRole: payload.invitedRole,
    expiresAt: payload.expiresAt,
  });

  const result = await sendResendEmail({
    from: emailFrom,
    to: [payload.toEmail],
    subject,
    html,
    text,
    tags: [
      { name: 'system', value: 'onbo' },
      { name: 'purpose', value: 'invitation' },
    ],
  });

  console.log('[invite email sent]', {
    toEmail: payload.toEmail,
    invitationId: payload.invitationId ?? null,
    resendId: result.id ?? null,
  });

  return { ok: true, resendId: result.id ?? null };
}
