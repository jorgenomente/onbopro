export function generateToken(): string {
  return (
    crypto.randomUUID().replaceAll('-', '') +
    crypto.randomUUID().replaceAll('-', '')
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Bytea(value: string): Promise<string> {
  const hex = await sha256Hex(value);
  return `\\x${hex}`;
}
