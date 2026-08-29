import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "../../../../facebook-auto/lib/database";

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

function cleanStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim() : "";
  return ["active", "checkpoint", "invalid", "unknown"].includes(status) ? status : "";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    await requireAdminUserId(request);
    await ensureThreadsAutoAccountsTable();
    const params = await context.params;
    const accountId = String(params.id || "").trim();
    if (!accountId) return NextResponse.json({ success: false, message: "Thiếu ID tài khoản." }, { status: 422 });

    const body = (await request.json().catch(() => ({}))) as { status?: unknown; admin_disabled?: unknown };
    const [rows] = await getFacebookAutoDatabase().execute("SELECT id FROM threads_auto_accounts WHERE id = ? LIMIT 1", [accountId]);
    if (!(rows as unknown[]).length) {
      return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản Auto Threads." }, { status: 404 });
    }

    const fields: Record<string, string | number> = {};
    if (body.status !== undefined) {
      const status = cleanStatus(body.status);
      if (!status) return NextResponse.json({ success: false, message: "Trạng thái tài khoản không hợp lệ." }, { status: 422 });
      fields.status = status;
    }
    if (body.admin_disabled !== undefined) {
      fields.admin_disabled = body.admin_disabled ? 1 : 0;
    }

    const keys = Object.keys(fields);
    if (!keys.length) return NextResponse.json({ success: false, message: "Không có dữ liệu cập nhật." }, { status: 422 });
    await getFacebookAutoDatabase().execute(
      `UPDATE threads_auto_accounts SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`,
      [...keys.map((key) => fields[key]), accountId]
    );
    return NextResponse.json({ success: true, message: "Đã cập nhật tài khoản Auto Threads." });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể cập nhật tài khoản Auto Threads." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    await requireAdminUserId(request);
    await ensureThreadsAutoAccountsTable();
    const params = await context.params;
    const accountId = String(params.id || "").trim();
    if (!accountId) return NextResponse.json({ success: false, message: "Thiếu ID tài khoản." }, { status: 422 });

    const [rows] = await getFacebookAutoDatabase().execute("SELECT id FROM threads_auto_accounts WHERE id = ? LIMIT 1", [accountId]);
    if (!(rows as unknown[]).length) {
      return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản Auto Threads." }, { status: 404 });
    }

    await getFacebookAutoDatabase().execute("DELETE FROM threads_auto_accounts WHERE id = ?", [accountId]);
    return NextResponse.json({ success: true, message: "Đã xoá tài khoản Auto Threads." });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể xoá tài khoản Auto Threads." },
      { status: 400 }
    );
  }
}
