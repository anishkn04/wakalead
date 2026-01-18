import { Env } from './types';

/**
 * Session management utilities
 * Sessions are stored in Cloudflare KV with a 7-day TTL
 */

export async function createSession(
  env: Env,
  userId: number,
  wakatimeId: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionData = {
    userId,
    wakatimeId,
    createdAt: Date.now(),
  };

  // Store session in KV with 7-day expiration
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(sessionData),
    { expirationTtl: 60 * 60 * 24 * 7 }
  );

  return sessionId;
}

export async function getSession(env: Env, sessionId: string) {
  const data = await env.SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deleteSession(env: Env, sessionId: string) {
  await env.SESSIONS.delete(`session:${sessionId}`);
}

/**
 * Extract session ID from Authorization header or cookie
 */
export function extractSessionId(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/session=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Verify user session and return user data
 */
export async function verifySession(env: Env, request: Request) {
  const sessionId = extractSessionId(request);
  if (!sessionId) return null;

  const session = await getSession(env, sessionId);
  if (!session) return null;

  // Fetch user from database
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(session.userId).first<any>();

  return user;
}
