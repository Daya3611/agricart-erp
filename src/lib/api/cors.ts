import { NextResponse } from 'next/server';

/**
 * Production and designated static origins allowed to access the API.
 */
const STATIC_ALLOWED_ORIGINS = new Set([
  'https://erp.agricartfpc.in',
  'https://agricart-erp.vercel.app',
  'http://localhost:3000',
  'http://localhost:63295',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:63295',
]);

/**
 * Checks if the request origin is permitted under the Agricart ERP CORS policy.
 * 
 * Rules:
 * 1. Matches designated production domains (https://erp.agricartfpc.in).
 * 2. Matches local development web servers (http://localhost:[port] or http://127.0.0.1:[port]),
 *    which safely supports Flutter Web dynamic debug ports (e.g. 63295, 52454, etc.).
 * 3. Rejects arbitrary production origins.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;

  const normalized = origin.trim().replace(/\/+$/, '');

  // 1. Exact match with static allowed origins
  if (STATIC_ALLOWED_ORIGINS.has(normalized)) {
    return true;
  }

  // 2. Safe regex for localhost and 127.0.0.1 with any valid port number
  const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  if (localhostPattern.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Returns required CORS headers for allowed origins.
 */
export function getCorsHeaders(origin: string | null | undefined): Record<string, string> {
  if (!origin || !isAllowedOrigin(origin)) {
    return {};
  }

  const normalized = origin.trim().replace(/\/+$/, '');

  return {
    'Access-Control-Allow-Origin': normalized,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Direct preflight handler returning 204 No Content with CORS headers.
 */
export function handleCorsPreflight(req: Request): NextResponse {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Injects CORS headers into a NextResponse.
 */
export function applyCorsHeaders(res: NextResponse, req?: Request | null): NextResponse {
  if (!req) return res;

  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }

  return res;
}

