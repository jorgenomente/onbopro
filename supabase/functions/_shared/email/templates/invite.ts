type InviteTemplateInput = {
  appUrl: string;
  token: string;
  orgName?: string | null;
  localName?: string | null;
  invitedRole?: string | null;
  expiresAt?: string | null;
};

export function buildInviteEmail(input: InviteTemplateInput) {
  const link = `${input.appUrl}/auth/accept-invitation?token=${encodeURIComponent(input.token)}`;
  const subject = 'Te invitaron a ONBO';

  const details: string[] = [];
  if (input.orgName) details.push(`Organizacion: ${input.orgName}`);
  if (input.localName) details.push(`Local: ${input.localName}`);
  if (input.invitedRole) details.push(`Rol: ${input.invitedRole}`);
  if (input.expiresAt) details.push(`Expira: ${input.expiresAt}`);

  const detailText = details.length > 0 ? details.join('\n') + '\n\n' : '';
  const detailHtml =
    details.length > 0
      ? `<ul>${details.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';

  const text = `Te invitaron a ONBO.\n\n${detailText}Acepta tu invitacion: ${link}`;

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <h2>Te invitaron a ONBO</h2>
    <p>Recibiste una invitacion para unirte a ONBO.</p>
    ${detailHtml}
    <p>
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
        Aceptar invitacion
      </a>
    </p>
    <p>Si el boton no funciona, copia y pega este link:</p>
    <p>${link}</p>
  </body>
</html>`;

  return { subject, html, text };
}
