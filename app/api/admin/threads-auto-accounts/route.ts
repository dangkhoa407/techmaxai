import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "../../../facebook-auto/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminUserId(request: Request) {
  const userId = await requireFacebookAutoUserId(request);
  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT level FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const level = String((rows as Array<{ level?: string }>)[0]?.level || "").toLowerCase();
  if (level !== "admin") {
    const error = new FacebookAutoAuthError("Bạn không có quyền truy cập.");
    error.status = 403;
    throw error;
  }
  return userId;
}

function normalizeThreadsAutoAccount(row: Record<string, unknown>) {
  const userId = String(row.threads_user_id || "");
  const cookie = String(row.cookie || "").replace(/\s+/g, " ").trim();
  const sessionId = cookie.match(/(?:^|;\s*)sessionid=([^;]+)/i)?.[1];
  const cookiePreview = sessionId
    ? `sessionid=${sessionId.length > 18 ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : sessionId}; ...`
    : cookie.length > 52 ? `${cookie.slice(0, 28)}...${cookie.slice(-14)}` : cookie || "Cookie đã lưu";
  return {
    id: String(row.id),
    deviceKeyHash: row.device_key_hash ? String(row.device_key_hash) : null,
    userId,
    name: String(row.name || ""),
    threadsName: row.threads_name ? String(row.threads_name) : null,
    status: row.status || null,
    admin_disabled: Boolean(Number(row.admin_disabled || 0)),
    cookiePreview,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    owner_id: Number(row.user_id || 0),
    owner_name: String(row.owner_name || ""),
    owner_email: String(row.owner_email || ""),
    job_status: null,
    job_progress: 0,
    job_completed: 0,
    job_total: 0,
    job_started_at: null,
    job_updated_at: null
  };
}

async function ensureThreadsAutoAccountsTable() {
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
}

export async function GET(request: Request) {
  try {
    await requireAdminUserId(request);
    await ensureThreadsAutoAccountsTable();
    const [rows] = await getFacebookAutoDatabase().execute(
      `SELECT a.*,
              u.fullname AS owner_name,
              u.email AS owner_email,
              DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM threads_auto_accounts a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.updated_at DESC
       LIMIT 500`
    );
    return NextResponse.json({
      success: true,
      accounts: (rows as Array<Record<string, unknown>>).map(normalizeThreadsAutoAccount),
      logs: []
    });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể tải tài khoản Auto Threads." },
      { status: 400 }
    );
  }
}
