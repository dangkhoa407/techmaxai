import { createHash, randomUUID } from "node:crypto";
import { inspectThreadsCookieWithChrome } from "./bot";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "../../facebook-auto/lib/database";

export type ThreadsAutoAccount = {
  id: string;
  deviceKeyHash: string | null;
  name: string;
  userId: string;
  threadsName?: string | null;
  proxy?: string | null;
  status?: "active" | "checkpoint" | "invalid" | "unknown";
  adminDisabled?: boolean;
  cookie: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicThreadsAutoAccount = Omit<ThreadsAutoAccount, "cookie" | "deviceKeyHash"> & {
  username: string;
  threadsId: string;
  cookiePreview: string;
  sessionPreview: string;
};

function normalizeCookie(cookie: string) {
  return cookie.trim();
}

function normalizeDeviceKey(deviceKey: unknown) {
  return typeof deviceKey === "string" ? deviceKey.trim() : "";
}

function hashDeviceKey(deviceKey: string) {
  return createHash("sha256").update(deviceKey).digest("hex");
}

async function columnExists(table: string, column: string) {
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return (rows as unknown[]).length > 0;
}

async function indexExists(table: string, indexName: string) {
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [table, indexName]
  );
  return (rows as unknown[]).length > 0;
}

async function ensureThreadsAutoDatabase() {
  await ensureFacebookAutoDatabase();
  await getFacebookAutoDatabase().query(`
    CREATE TABLE IF NOT EXISTS threads_auto_accounts (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT UNSIGNED DEFAULT NULL,
      device_key_hash CHAR(64) DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      threads_user_id VARCHAR(190) NOT NULL,
      threads_name VARCHAR(255) DEFAULT NULL,
      proxy VARCHAR(255) DEFAULT NULL,
      status ENUM('active', 'checkpoint', 'invalid', 'unknown') DEFAULT NULL,
      admin_disabled TINYINT(1) NOT NULL DEFAULT 0,
      cookie LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_threads_auto_accounts_device (user_id, device_key_hash),
      UNIQUE KEY unique_user_threads (user_id, threads_user_id),
      INDEX idx_threads_auto_accounts_user_updated (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
  `);

  if (!(await columnExists("threads_auto_accounts", "user_id"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD COLUMN user_id INT UNSIGNED DEFAULT NULL AFTER id");
  }
  if (!(await columnExists("threads_auto_accounts", "device_key_hash"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD COLUMN device_key_hash CHAR(64) DEFAULT NULL AFTER user_id");
  }
  if (!(await columnExists("threads_auto_accounts", "proxy"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD COLUMN proxy VARCHAR(255) DEFAULT NULL AFTER threads_name");
  }
  if (!(await columnExists("threads_auto_accounts", "admin_disabled"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD COLUMN admin_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status");
  }
  if (!(await indexExists("threads_auto_accounts", "idx_threads_auto_accounts_device"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD INDEX idx_threads_auto_accounts_device (user_id, device_key_hash)");
  }
  if (!(await indexExists("threads_auto_accounts", "unique_user_threads"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD UNIQUE KEY unique_user_threads (user_id, threads_user_id)");
  }
  if (!(await indexExists("threads_auto_accounts", "idx_threads_auto_accounts_user_updated"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD INDEX idx_threads_auto_accounts_user_updated (user_id, updated_at)");
  }
}

function maskCookie(cookie: string, userId?: string) {
  const clean = cookie.replace(/\s+/g, " ").trim();
  if (!clean) return "Cookie đã lưu";
  const sessionId = clean.match(/(?:^|;\s*)sessionid=([^;]+)/i)?.[1];
  if (sessionId) {
    const visible = sessionId.length > 18 ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : sessionId;
    return `sessionid=${visible}; ...`;
  }
  const dsUserId = clean.match(/(?:^|;\s*)ds_user_id=([^;]+)/i)?.[1];
  if (dsUserId) return `ds_user_id=${dsUserId}; ...`;
  return clean.length > 52 ? `${clean.slice(0, 28)}...${clean.slice(-14)}` : clean;
}

function publicAccount(account: ThreadsAutoAccount): PublicThreadsAutoAccount {
  const { cookie: _cookie, ...rest } = account;
  const preview = maskCookie(account.cookie, account.userId);
  return {
    ...rest,
    username: account.userId ? `@${account.userId}` : "",
    threadsId: account.userId,
    cookiePreview: preview,
    sessionPreview: preview
  };
}

async function readAccounts(ownerId: number): Promise<ThreadsAutoAccount[]> {
  await ensureThreadsAutoDatabase();
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT id, device_key_hash, name, threads_user_id, threads_name, proxy, status, admin_disabled, cookie, created_at, updated_at
     FROM threads_auto_accounts
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    [ownerId]
  );
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    deviceKeyHash: row.device_key_hash ? String(row.device_key_hash) : null,
    userId: String(row.threads_user_id || ""),
    name: String(row.name || ""),
    threadsName: row.threads_name ? String(row.threads_name) : null,
    proxy: row.proxy ? String(row.proxy) : null,
    status: row.status as ThreadsAutoAccount["status"],
    adminDisabled: Boolean(Number(row.admin_disabled || 0)),
    cookie: String(row.cookie || ""),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString()
  }));
}

async function writeAccounts(ownerId: number, accounts: ThreadsAutoAccount[]) {
  await ensureThreadsAutoDatabase();
  const connection = await getFacebookAutoDatabase().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM threads_auto_accounts WHERE user_id = ?", [ownerId]);
    for (const account of accounts) {
      await connection.execute(
        `INSERT INTO threads_auto_accounts
          (id, user_id, device_key_hash, name, threads_user_id, threads_name, proxy, status, admin_disabled, cookie, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          ownerId,
          account.deviceKeyHash ?? null,
          account.name,
          account.userId,
          account.threadsName ?? null,
          account.proxy ?? null,
          account.status ?? null,
          account.adminDisabled ? 1 : 0,
          account.cookie,
          new Date(account.createdAt),
          new Date(account.updatedAt)
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listThreadsAutoAccounts(ownerId: number) {
  return (await readAccounts(ownerId)).map(publicAccount);
}

export async function getThreadsAutoAccountsForRun(ids: string[], ownerId: number) {
  const idSet = new Set(ids.map((id) => id.trim()).filter(Boolean));
  if (idSet.size === 0) return [];
  return (await readAccounts(ownerId)).filter((account) => idSet.has(account.id));
}

function cleanExportField(value: string) {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "/").trim();
}

function cleanExportCookie(value: string) {
  const raw = value.replace(/\r?\n/g, " ").trim();
  if (!raw.includes("|")) return raw;

  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  const cookiePart = parts.find((part) => /\b(sessionid|ds_user_id|csrftoken|mid|ig_did)=/i.test(part));
  return cookiePart || raw.replace(/\|/g, " ");
}

export async function exportThreadsAutoAccounts(ownerId: number, ids: unknown) {
  if (!Array.isArray(ids)) return { count: 0, content: "" };
  const cleanIds = new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
  if (cleanIds.size === 0) return { count: 0, content: "" };

  const lines = (await readAccounts(ownerId))
    .filter((account) => cleanIds.has(account.id))
    .map((account) => {
      const username = cleanExportField(account.userId ? `@${account.userId}` : account.name || "");
      const cookie = cleanExportCookie(account.cookie);
      const name = cleanExportField(account.threadsName || account.name || account.userId);
      return `${username}|${cookie}|${name}`;
    });

  return {
    count: lines.length,
    content: lines.join("\n")
  };
}

export async function saveThreadsAutoAccounts(
  input: { cookies?: unknown; cookie?: unknown; deviceKey?: unknown },
  ownerId: number
) {
  const cookie = normalizeCookie(typeof input.cookie === "string" ? input.cookie : "");
  const raw = typeof input.cookies === "string" ? input.cookies : cookie;
  const deviceKey = normalizeDeviceKey(input.deviceKey);
  const deviceKeyHash = deviceKey ? hashDeviceKey(deviceKey) : "";
  const cookies = [...new Set(raw.split(/\r?\n/).map(normalizeCookie).filter(Boolean))];

  if (!deviceKeyHash) throw new Error("Thiếu mã thiết bị. Hãy tải lại trang và thử lại.");
  if (cookies.length === 0) throw new Error("Vui lòng nhập ít nhất một cookie Threads.");

  const now = new Date().toISOString();
  const accounts = await readAccounts(ownerId);
  const skipped: Array<{ line: number; status: ThreadsAutoAccount["status"]; reason: string }> = [];
  let savedCount = 0;

  for (let index = 0; index < cookies.length; index += 1) {
    const cookie = cookies[index];
    const info = await inspectThreadsCookieWithChrome(cookie);
    if (info.status !== "active" || !info.threadsUserId) {
      skipped.push({
        line: index + 1,
        status: info.status,
        reason: info.status === "invalid" ? "Die" : info.status === "checkpoint" ? "Checkpoint" : "Không xác định"
      });
      continue;
    }

    const userId = info.threadsUserId;
    const existingIndex = accounts.findIndex((account) => account.userId === userId);
    const existing = existingIndex >= 0 ? accounts[existingIndex] : undefined;
    const displayName = info.threadsName || existing?.name || `Threads @${info.threadsUserId}`;
    const account: ThreadsAutoAccount = {
      id: existing?.id ?? randomUUID(),
      deviceKeyHash,
      name: displayName,
      userId,
      threadsName: info.threadsName || null,
      proxy: existing?.proxy || null,
      status: info.status,
      adminDisabled: existing?.adminDisabled ?? false,
      cookie,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    if (existingIndex >= 0) accounts[existingIndex] = account;
    else accounts.unshift(account);
    savedCount += 1;
  }

  if (savedCount === 0) {
    const firstReason = skipped[0]?.reason || "Die";
    throw new Error(`Không lưu tài khoản Threads. Cookie ${firstReason}.`);
  }

  await writeAccounts(ownerId, accounts);
  return { accounts: accounts.map(publicAccount), savedCount, skipped };
}

export async function refreshThreadsAutoAccount(id: string, ownerId: number) {
  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error("Không tìm thấy tài khoản Threads.");

  const info = await inspectThreadsCookieWithChrome(account.cookie, account.proxy || "");
  const updatedAt = new Date().toISOString();
  account.status = info.status;
  if (info.threadsUserId) account.userId = info.threadsUserId;
  account.threadsName = info.threadsName || account.threadsName || null;
  account.name = info.threadsName || account.name || (info.threadsUserId ? `Threads @${info.threadsUserId}` : "Threads");
  account.updatedAt = updatedAt;
  await writeAccounts(ownerId, accounts);
  return accounts.map(publicAccount);
}

export async function updateThreadsAutoAccountCookie(id: string, cookieInput: unknown, ownerId: number) {
  const cookie = normalizeCookie(typeof cookieInput === "string" ? cookieInput : "");
  if (!cookie) throw new Error("Vui lòng nhập cookie Threads.");

  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error("Không tìm thấy tài khoản Threads.");

  const info = await inspectThreadsCookieWithChrome(cookie, account.proxy || "");
  account.cookie = cookie;
  account.status = info.status;
  if (info.threadsUserId) account.userId = info.threadsUserId;
  account.threadsName = info.threadsName || account.threadsName || null;
  account.name = info.threadsName || account.name || (info.threadsUserId ? `Threads @${info.threadsUserId}` : "Threads");
  account.updatedAt = new Date().toISOString();
  await writeAccounts(ownerId, accounts);
  return accounts.map(publicAccount);
}

export async function updateThreadsAutoAccountProxy(id: string, proxyInput: unknown, ownerId: number) {
  const proxy = typeof proxyInput === "string" ? proxyInput.trim() : "";
  if (proxy.length > 255) throw new Error("Proxy không được vượt quá 255 ký tự.");

  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error("Không tìm thấy tài khoản Threads.");

  account.proxy = proxy || null;
  account.updatedAt = new Date().toISOString();
  await writeAccounts(ownerId, accounts);
  return accounts.map(publicAccount);
}

export async function deleteThreadsAutoAccount(id: string, ownerId: number) {
  const accounts = await readAccounts(ownerId);
  const nextAccounts = accounts.filter((account) => account.id !== id);
  await writeAccounts(ownerId, nextAccounts);
  return nextAccounts.map(publicAccount);
}
