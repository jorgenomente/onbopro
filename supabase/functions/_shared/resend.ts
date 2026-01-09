type ResendEmailInput = {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
};

export async function sendResendEmail(input: ResendEmailInput) {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tags,
      }),
      signal: controller.signal,
    });

    let payload: { id?: string; message?: string } | null = null;
    try {
      payload = (await response.json()) as { id?: string; message?: string };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message ?? 'Resend request failed';
      throw new Error(`Resend error (${response.status}): ${message}`);
    }

    return { id: payload?.id ?? null };
  } finally {
    clearTimeout(timeout);
  }
}
