import { Request, Response, NextFunction } from 'express';

const REQUIRED_API_KEY = process.env.API_KEY || 'mc_sec_2026_couple_prod';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow healthcheck root endpoint
  if (req.path === '/' || req.path === '/health') {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'] as string;
  const queryApiKey = req.query.apiKey as string;

  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const providedKey = apiKeyHeader || bearerToken || queryApiKey;

  if (!REQUIRED_API_KEY) {
    // If no API_KEY is set in environment, open access is allowed
    return next();
  }

  if (providedKey && providedKey.trim() === REQUIRED_API_KEY.trim()) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API Key. Provide via X-API-Key header.'
  });
}

export function validateWsAuth(reqUrl: string, reqHeaders: Record<string, string | string[] | undefined>): boolean {
  if (!REQUIRED_API_KEY) return true;

  try {
    const url = new URL(reqUrl, 'http://localhost');
    const queryKey = url.searchParams.get('apiKey');
    const headerKey = (reqHeaders['x-api-key'] as string) || '';

    const providedKey = queryKey || headerKey;
    return Boolean(providedKey && providedKey.trim() === REQUIRED_API_KEY.trim());
  } catch {
    return false;
  }
}
