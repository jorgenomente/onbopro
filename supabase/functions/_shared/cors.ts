const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

type CorsResult = {
  allowed: boolean;
  headers: HeadersInit;
};

export function buildCorsHeaders(req: Request): CorsResult {
  const origin = req.headers.get('origin');
  const appUrl = Deno.env.get('APP_URL') ?? '';
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const allowedOrigins = [appUrl, siteUrl].filter(Boolean);

  const allowed =
    !origin || allowedOrigins.includes(origin) || DEV_ORIGINS.includes(origin);

  const allowOrigin = !origin ? '*' : allowed ? origin : 'null';

  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  };
}
