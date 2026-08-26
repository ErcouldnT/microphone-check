import { Request, Response, NextFunction } from 'express';

function cleanKey(k?: string | null): string {
  if (!k) return '';
  return k.trim().replace(/^["']|["']$/g, '');
}

function getValidKeySet(): Set<string> {
  const set = new Set<string>([
    'erkut-api-key',
    'mc_sec_2026_couple_prod',
  ]);

  if (process.env.API_KEY) {
    const cleaned = cleanKey(process.env.API_KEY);
    if (cleaned) {
      set.add(cleaned.toLowerCase());
      set.add(cleaned);
    }
  }

  return set;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow healthcheck root endpoint
  if (req.path === '/' || req.path === '/health') {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['x-api-token'];
  const authHeader = req.headers['authorization'];
  const queryApiKey = req.query.apiKey || req.query.key;

  const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  const rawProvidedKey = (apiKeyHeader || bearerToken || queryApiKey) as string;
  const cleanedProvidedKey = cleanKey(rawProvidedKey);

  const validKeys = getValidKeySet();

  if (cleanedProvidedKey && (validKeys.has(cleanedProvidedKey.toLowerCase()) || validKeys.has(cleanedProvidedKey))) {
    return next();
  }

  // If no API_KEY configured on server and no matching key
  if (!process.env.API_KEY && (!rawProvidedKey || cleanedProvidedKey === '')) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API Key. Provide via X-API-Key header or apiKey query parameter.'
  });
}

export function validateWsAuth(reqUrl: string, reqHeaders: Record<string, string | string[] | undefined>): boolean {
  const validKeys = getValidKeySet();

  try {
    const url = new URL(reqUrl, 'http://localhost');
    const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    const headerKey = (reqHeaders['x-api-key'] || reqHeaders['X-API-KEY'] || reqHeaders['x-api-token']) as string;

    const rawKey = queryKey || headerKey;
    const cleaned = cleanKey(rawKey);

    if (cleaned && (validKeys.has(cleaned.toLowerCase()) || validKeys.has(cleaned))) {
      return true;
    }

    if (!process.env.API_KEY && !rawKey) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
