import { createHash } from "node:crypto";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "./database";

export class FacebookAutoAuthError extends Error {
  status = 401;

  constructor(message: string) {
    super(message);
    this.name = "FacebookAutoAuthError";
  }
}

type SessionRow = {
  token_hash?: string;
  expires_at?: string;
};

const authCache = new Map<string, { userId: number; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = Math.max(1_000, Number(process.env.FACEBOOK_AUTO_AUTH_CACHE_TTL_MS || 5_000));
const AUTH_CACHE_MAX_ENTRIES = Math.max(100, Number(process.env.FACEBOOK_AUTO_AUTH_CACHE_MAX_ENTRIES || 1_000));

function trimAuthCache() {
  if (authCache.size <= AUTH_CACHE_MAX_ENTRIES) return;
  const overflow = authCache.size - AUTH_CACHE_MAX_ENTRIES;
  let removed = 0;
  for (const key of authCache.keys()) {
    authCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!header) return null;

  const match = header.match(/Bearer\s+(.+)/i);
  if (match) return match[1].trim() || null;

  return header.trim() || null;
}

function queryToken(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return url.searchParams.get("token") || url.searchParams.get("access_token") || null;
  } catch {
    return null;
  }
}

function decodeSessions(raw: string | null | undefined): SessionRow[] {
  if (!raw || raw.length > 1_048_576) return [];

  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is SessionRow => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function activeSessions(sessions: SessionRow[]): SessionRow[] {
  const now = Date.now();
  return sessions.filter((session) => {
    if (!session?.token_hash || !session.expires_at) return false;
    const expiresAt = new Date(session.expires_at).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export async function requireFacebookAutoUserId(request: Request): Promise<number> {
  const token = bearerToken(request) ?? queryToken(request);
  if (!token) {
    throw new FacebookAutoAuthError("Bạn cần đăng nhập.");
  }

  await ensureFacebookAutoDatabase();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const cached = authCache.get(tokenHash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }
  if (cached) authCache.delete(tokenHash);

  const like = `%${tokenHash}%`;
  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT id, sessions FROM users WHERE sessions LIKE ? LIMIT 1",
    [like]
  );

  const row = (rows as Array<{ id: number; sessions: string | null }>)[0];
  if (!row) {
    throw new FacebookAutoAuthError("Phiên đăng nhập đã hết hạn.");
  }

  const sessions = activeSessions(decodeSessions(row.sessions));
  const matched = sessions.some((session) => session.token_hash === tokenHash);
  if (!matched) {
    throw new FacebookAutoAuthError("Phiên đăng nhập đã hết hạn.");
  }

  const matchedSession = sessions.find((session) => session.token_hash === tokenHash);
  const sessionExpiresAt = matchedSession?.expires_at ? new Date(matchedSession.expires_at).getTime() : 0;
  const expiresAt = Math.min(
    Date.now() + AUTH_CACHE_TTL_MS,
    Number.isFinite(sessionExpiresAt) && sessionExpiresAt > Date.now() ? sessionExpiresAt : Date.now() + AUTH_CACHE_TTL_MS
  );
  authCache.set(tokenHash, { userId: Number(row.id), expiresAt });
  trimAuthCache();

  return Number(row.id);
}
