import { Request, Response, NextFunction } from 'express';

function cleanKey(k?: string | null): string {
  if (!k) return '';
  return k.trim().replace(/^["']|["']$/g, '');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow healthcheck root endpoint
  if (req.path === '/' || req.path === '/health') {
    return next();
  }

  const expectedKey = cleanKey(process.env.API_KEY);

  // If no API_KEY is set in environment, allow open access
  if (!expectedKey) {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['x-api-token'];
  const authHeader = req.headers['authorization'];
  const queryApiKey = req.query.apiKey || req.query.key;

  const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  const rawProvidedKey = (apiKeyHeader || bearerToken || queryApiKey) as string;
  const providedKey = cleanKey(rawProvidedKey);

  if (providedKey && providedKey === expectedKey) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API Key. Provide via X-API-Key header.'
  });
}

export function validateWsAuth(reqUrl: string, reqHeaders: Record<string, string | string[] | undefined>): boolean {
  const expectedKey = cleanKey(process.env.API_KEY);

  // If no API_KEY configured on server, allow
  if (!expectedKey) {
    return true;
  }

  try {
    const url = new URL(reqUrl, 'http://localhost');
    const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    const headerKey = (reqHeaders['x-api-key'] || reqHeaders['X-API-KEY'] || reqHeaders['x-api-token']) as string;

    const rawKey = queryKey || headerKey;
    const providedKey = cleanKey(rawKey);

    return Boolean(providedKey && providedKey === expectedKey);
  } catch {
    return false;
  }
}
