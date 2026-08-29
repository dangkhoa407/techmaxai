import { createHash, randomUUID } from "node:crypto";
import { addFacebookAutoLog, inspectFacebookCookieWithChrome } from "./bot";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "./database";

export type FacebookAutoAccount = {
  id: string;
  deviceKeyHash: string | null;
  name: string;
  userId: string;
  facebookName?: string;
  proxy?: string | null;
  status?: "active" | "checkpoint" | "invalid" | "unknown";
  adminDisabled?: boolean;
  cookie: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicFacebookAutoAccount = Omit<FacebookAutoAccount, "cookie" | "deviceKeyHash"> & {
  cookiePreview: string;
};

export function facebookAutoAccountLabel(account: Pick<FacebookAutoAccount, "name" | "facebookName" | "userId">) {
  const label = (account.facebookName || account.name || account.userId || "").trim();
  return label && label !== "KhÃ´ng rÃµ" ? label : "";
}

function getUserId(cookie: string) {
  return cookie.match(/(?:^|;\s*)c_user=(\d+)/)?.[1] ?? "";
}

function normalizeCookie(cookie: string) {
  return cookie.trim();
}

function normalizeDeviceKey(deviceKey: unknown) {
  return typeof deviceKey === "string" ? deviceKey.trim() : "";
}

function hashDeviceKey(deviceKey: string) {
  return createHash("sha256").update(deviceKey).digest("hex");
}

async function accountColumnExists(column: string) {
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facebook_auto_accounts' AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  );
  return (rows as unknown[]).length > 0;
}

type AutomationPlanRow = {
  plan_code: string | null;
  plan_name: string | null;
  plan_expires_at: string | null;
  facebook_auto_usage_count: number | null;
  facebook_auto_usage_limit: number | null;
  facebook_auto_usage_unlimited: number | null;
  automation_usage_limit: number | null;
  automation_usage_unlimited: number | null;
};

async function currentAutomationPlan(ownerId: number) {
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT u.plan_code, u.plan_name, u.plan_expires_at, COALESCE(u.facebook_auto_usage_count, 0) AS facebook_auto_usage_count,
            COALESCE(sp.facebook_auto_usage_limit, sp.automation_usage_limit) AS facebook_auto_usage_limit,
            COALESCE(sp.facebook_auto_usage_unlimited, sp.automation_usage_unlimited) AS facebook_auto_usage_unlimited,
            sp.automation_usage_limit, sp.automation_usage_unlimited
     FROM users u
     LEFT JOIN service_plans sp ON sp.code = u.plan_code
     WHERE u.id = ?
     LIMIT 1`,
    [ownerId]
  );
  return (rows as AutomationPlanRow[])[0] || null;
}

function automationUsageLimitFromPlan(plan: AutomationPlanRow | null) {
  if (!plan?.plan_code) return 0;
  if (Boolean(plan.facebook_auto_usage_unlimited) || Boolean(plan.automation_usage_unlimited)) return Infinity;
  const limit = Number(plan.facebook_auto_usage_limit ?? plan.automation_usage_limit ?? 0);
  if (Number.isFinite(limit) && limit > 0) return limit;
  const code = String(plan.plan_code || "").toLowerCase();
  const name = String(plan.plan_name || "").toLowerCase();
  if (code === "trial" || code === "free" || /dÃ¹ng thá»­|dung thu|miá»n phÃ­|mien phi/.test(name)) return 30;
  if (code === "starter") return 100;
  if (code === "professional") return 500;
  if (code === "enterprise") return Infinity;
  return 0;
}

async function ensureAutomationUsageAvailable(ownerId: number, amount: number) {
  if (amount <= 0) return;
  const plan = await currentAutomationPlan(ownerId);
  if (!plan?.plan_code) {
    throw new Error("Bạn cần có gói dịch vụ đang hoạt động hoặc gói dùng thử để dùng Auto Facebook/Threads.");
  }
  const expiresAt = plan.plan_expires_at ? new Date(plan.plan_expires_at).getTime() : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Gói hiện tại đã hết hạn. Vui lòng gia hạn để tiếp tục dùng Auto Facebook/Threads.");
  }
  const limit = automationUsageLimitFromPlan(plan);
  if (!limit) {
    throw new Error("Gói hiện tại chưa hỗ trợ lượt dùng Auto Facebook/Threads. Vui lòng nâng cấp gói.");
  }
  if (limit === Infinity) return;
  const used = Number(plan.facebook_auto_usage_count || 0);
  if (used + amount > limit) {
    throw new Error(`Gói ${plan.plan_name || "hiện tại"} chỉ cho phép ${limit} lượt dùng Auto Facebook/Threads. Bạn đã dùng ${used} lượt.`);
  }
}

async function consumeAutomationUsage(ownerId: number, amount: number) {
  if (amount <= 0) return;
  await getFacebookAutoDatabase().execute(
    "UPDATE users SET facebook_auto_usage_count = COALESCE(facebook_auto_usage_count, 0) + ? WHERE id = ?",
    [amount, ownerId]
  );
}

export async function reserveFacebookAutoAutomationUsage(ownerId: number, amount: number) {
  if (amount <= 0) return;
  await ensureAutomationUsageAvailable(ownerId, amount);
  await consumeAutomationUsage(ownerId, amount);
}

export async function updateFacebookAutoAccountStatus(
  ownerId: number,
  userId: string,
  status: FacebookAutoAccount["status"]
) {
  if (!userId) return;

  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.userId === userId);
  if (!account) return;

  account.status = status;
  account.updatedAt = new Date().toISOString();
  await writeAccounts(ownerId, accounts);
}

export async function getFacebookAutoAccountLabelByUserId(ownerId: number, userId: string) {
  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.userId === userId);
  return account ? facebookAutoAccountLabel(account) : "";
}

function maskCookie(cookie: string) {
  const userId = getUserId(cookie);
  if (!userId) return "Cookie ÄÃ£ lÆ°u";
  return `c_user=${userId}; ...`;
}

async function readAccounts(ownerId: number): Promise<FacebookAutoAccount[]> {
  await ensureFacebookAutoDatabase();
  const hasDeviceKeyHash = await accountColumnExists("device_key_hash");
  const deviceKeyHashSelect = hasDeviceKeyHash ? "device_key_hash, " : "";
  const [rows] = await getFacebookAutoDatabase().execute(
    `SELECT id, ${deviceKeyHashSelect}name, facebook_user_id, facebook_name, proxy, status, admin_disabled, cookie, created_at, updated_at
     FROM facebook_auto_accounts
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    [ownerId]
  );
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    deviceKeyHash: hasDeviceKeyHash && row.device_key_hash ? String(row.device_key_hash) : null,
    userId: String(row.facebook_user_id),
    name: String(row.name),
    facebookName: row.facebook_name ? String(row.facebook_name) : undefined,
    proxy: row.proxy ? String(row.proxy) : null,
    status: row.status as FacebookAutoAccount["status"],
    adminDisabled: Boolean(Number(row.admin_disabled || 0)),
    cookie: String(row.cookie),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString()
  }));
}

async function writeAccounts(ownerId: number, accounts: FacebookAutoAccount[]) {
  await ensureFacebookAutoDatabase();
  const hasDeviceKeyHash = await accountColumnExists("device_key_hash");
  const connection = await getFacebookAutoDatabase().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM facebook_auto_accounts WHERE user_id = ?", [ownerId]);
    for (const account of accounts) {
      if (hasDeviceKeyHash) {
        await connection.execute(
          `INSERT INTO facebook_auto_accounts
            (id, user_id, device_key_hash, name, facebook_user_id, facebook_name, proxy, status, admin_disabled, cookie, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            account.id,
            ownerId,
            account.deviceKeyHash ?? null,
            account.name,
            account.userId,
            account.facebookName ?? null,
            account.proxy ?? null,
            account.status ?? null,
            account.adminDisabled ? 1 : 0,
            account.cookie,
            new Date(account.createdAt),
            new Date(account.updatedAt)
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO facebook_auto_accounts
            (id, user_id, name, facebook_user_id, facebook_name, proxy, status, admin_disabled, cookie, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            account.id,
            ownerId,
            account.name,
            account.userId,
            account.facebookName ?? null,
            account.proxy ?? null,
            account.status ?? null,
            account.adminDisabled ? 1 : 0,
            account.cookie,
            new Date(account.createdAt),
            new Date(account.updatedAt)
          ]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function inspectFacebookAccount(cookie: string, userId: string, proxy = "") {
  return inspectFacebookCookieWithChrome(cookie, userId, proxy);
}

export async function refreshFacebookAutoAccount(id: string, ownerId: number) {
  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error("KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n Facebook.");

  const accountLabel = facebookAutoAccountLabel(account);
  addFacebookAutoLog(`Äang check live tÃ i khoáº£n ${accountLabel || account.userId} (${account.userId}) báº±ng Chrome.`, "info", {
    ownerId,
    accountUserId: account.userId,
    accountName: accountLabel || null
  });
  const facebookInfo = await inspectFacebookAccount(account.cookie, account.userId, account.proxy || "");
  Object.assign(account, facebookInfo, {
    updatedAt: new Date().toISOString()
  });
  await writeAccounts(ownerId, accounts);
  const statusLabel = facebookInfo.status === "active"
    ? "Hoáº¡t Äá»ng"
    : facebookInfo.status === "invalid"
      ? "Die"
      : "KhÃ´ng xÃ¡c Äá»nh";
  addFacebookAutoLog(
    `Check live ${statusLabel}.`,
    facebookInfo.status === "active" ? "success" : "error",
    {
      ownerId,
      accountUserId: account.userId,
      accountName: accountLabel || null
    }
  );
  return accounts.map(publicAccount);
}

export function publicAccount(account: FacebookAutoAccount): PublicFacebookAutoAccount {
  const { cookie: _cookie, ...rest } = account;
  return {
    ...rest,
    cookiePreview: maskCookie(account.cookie)
  };
}

export async function listFacebookAutoAccounts(ownerId: number) {
  const accounts = await readAccounts(ownerId);
  return accounts.map(publicAccount);
}

export async function saveFacebookAutoAccount(
  input: { name?: unknown; cookie?: unknown; deviceKey?: unknown },
  ownerId: number
) {
  return saveFacebookAutoAccounts({ cookie: input.cookie, deviceKey: input.deviceKey }, ownerId);
}

export async function saveFacebookAutoAccounts(
  input: { cookies?: unknown; cookie?: unknown; deviceKey?: unknown },
  ownerId: number
) {
  const cookie = normalizeCookie(typeof input.cookie === "string" ? input.cookie : "");
  const raw = typeof input.cookies === "string" ? input.cookies : cookie;
  const deviceKey = normalizeDeviceKey(input.deviceKey);
  const deviceKeyHash = deviceKey ? hashDeviceKey(deviceKey) : "";
  const cookies = [...new Set(raw.split(/\r?\n/).map(normalizeCookie).filter(Boolean))];

  if (!deviceKeyHash) {
    throw new Error("Thiáº¿u mÃ£ thiáº¿t bá». HÃ£y táº£i láº¡i trang vÃ  thá»­ láº¡i.");
  }

  if (cookies.length === 0) {
    throw new Error("Vui lòng nhập ít nhất một cookie Facebook.");
  }

  const invalidLine = cookies.findIndex((item) => !getUserId(item));
  if (invalidLine >= 0) throw new Error(`Cookie ở dòng ${invalidLine + 1} không có c_user.`);

  const now = new Date().toISOString();
  const accounts = await readAccounts(ownerId);
  const incomingUserIds = cookies.map(getUserId);
  const existingByUserId = new Map(accounts.map((account) => [account.userId, account]));
  const skippedCookies: Array<{ index: number; userId: string; reason: string }> = [];

  for (let index = 0; index < cookies.length; index += 1) {
    const cookie = cookies[index];
    const userId = getUserId(cookie);
    const existingIndex = accounts.findIndex((account) => account.userId === userId);
    const existing = existingIndex >= 0 ? accounts[existingIndex] : undefined;
    const existingLabel = existing ? facebookAutoAccountLabel(existing) : "";
    addFacebookAutoLog(`Äang kiá»m tra tÃ i khoáº£n ${index + 1}/${cookies.length} (${userId}).`, "info", {
      ownerId,
      accountUserId: userId,
      accountName: existingLabel || null
    });
    try {
      const facebookInfo = await inspectFacebookAccount(cookie, userId, existing?.proxy || "");
      const account: FacebookAutoAccount = {
        id: existing?.id ?? randomUUID(),
        deviceKeyHash,
        name: facebookInfo.facebookName || existing?.name || `Facebook ${userId}`,
        userId,
        proxy: existing?.proxy || null,
        adminDisabled: existing?.adminDisabled ?? false,
        ...facebookInfo,
        cookie,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) accounts[existingIndex] = account;
      else accounts.unshift(account);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "KhÃ´ng thá» thÃªm cookie.";
      skippedCookies.push({ index: index + 1, userId, reason });
      addFacebookAutoLog(`Bá» qua cookie dÃ²ng ${index + 1} (${userId}): ${reason}`, "warn", {
        ownerId,
        accountUserId: userId,
        accountName: existingLabel || null
      });
    }
  }

  await writeAccounts(ownerId, accounts);
  if (skippedCookies.length > 0) {
    addFacebookAutoLog(
      `ÄÃ£ lÆ°u ${cookies.length - skippedCookies.length}/${cookies.length} tÃ i khoáº£n Facebook. Bá» qua ${skippedCookies.length} cookie lá»i.`,
      "warn",
      {
        ownerId,
        accountUserId: incomingUserIds[0] || null,
        accountName: accounts[0] ? facebookAutoAccountLabel(accounts[0]) : null
      }
    );
  } else {
    addFacebookAutoLog(`ÄÃ£ lÆ°u ${cookies.length} tÃ i khoáº£n Facebook.`, "success", {
      ownerId,
      accountUserId: incomingUserIds[0] || null,
      accountName: accounts[0] ? facebookAutoAccountLabel(accounts[0]) : null
    });
  }
  return accounts.map(publicAccount);
}

export async function updateFacebookAutoAccountCookie(
  id: string,
  cookieInput: unknown,
  ownerId: number
) {
  const cookie = normalizeCookie(typeof cookieInput === "string" ? cookieInput : "");
  if (!cookie) {
    throw new Error("Vui lÃ²ng nháº­p cookie Facebook.");
  }

  const userId = getUserId(cookie);
  if (!userId) {
    throw new Error("Cookie cáº§n cÃ³ c_user.");
  }

  const accounts = await readAccounts(ownerId);
  const accountIndex = accounts.findIndex((item) => item.id === id);
  if (accountIndex < 0) {
    throw new Error("KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n Facebook.");
  }

  const existing = accounts[accountIndex];
  const existingLabel = facebookAutoAccountLabel(existing);
  addFacebookAutoLog(`Äang cáº­p nháº­t cookie cho tÃ i khoáº£n ${existing.name} (${existing.userId}).`, "info", {
    ownerId,
    accountUserId: existing.userId,
    accountName: existingLabel || null
  });

  const facebookInfo = await inspectFacebookAccount(cookie, userId, existing.proxy || "");
  const updatedAt = new Date().toISOString();
  accounts[accountIndex] = {
    ...existing,
    cookie,
    userId,
    name: facebookInfo.facebookName || existing.name || `Facebook ${userId}`,
    ...facebookInfo,
    updatedAt
  };

  await writeAccounts(ownerId, accounts);
  addFacebookAutoLog(
    `ÄÃ£ cáº­p nháº­t cookie: ${facebookInfo.status === "active" ? "Hoáº¡t Äá»ng" : "KhÃ´ng hoáº¡t Äá»ng"}.`,
    facebookInfo.status === "active" ? "success" : "error",
    {
      ownerId,
      accountUserId: userId,
      accountName: facebookAutoAccountLabel(accounts[accountIndex]) || null
    }
  );

  return accounts.map(publicAccount);
}

export async function deleteFacebookAutoAccount(id: string, ownerId: number) {
  const accounts = await readAccounts(ownerId);
  const nextAccounts = accounts.filter((account) => account.id !== id);
  await writeAccounts(ownerId, nextAccounts);
  return nextAccounts.map(publicAccount);
}

export async function updateFacebookAutoAccountProxy(id: string, proxyInput: unknown, ownerId: number) {
  const proxy = typeof proxyInput === "string" ? proxyInput.trim() : "";
  if (proxy && proxy.length > 255) {
    throw new Error("Proxy khÃÂ´ng ÃâÃÂ°Ã¡Â»Â£c vÃÂ°Ã¡Â»Â£t quÃÂ¡ 255 kÃÂ½ tÃ¡Â»Â±.");
  }

  const accounts = await readAccounts(ownerId);
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error("KhÃÂ´ng tÃÂ¬m thÃ¡ÂºÂ¥y tÃÂ i khoÃ¡ÂºÂ£n Facebook.");

  account.proxy = proxy || null;
  account.updatedAt = new Date().toISOString();
  await writeAccounts(ownerId, accounts);
  return accounts.map(publicAccount);
}

export async function getFacebookAutoAccountCookies(ownerId: number, ids: unknown) {
  if (!Array.isArray(ids)) return [];
  const cleanIds = new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
  if (cleanIds.size === 0) return [];

  return (await readAccounts(ownerId))
    .filter((account) => cleanIds.has(account.id) && account.status === "active")
    .map((account) => account.cookie);
}

function cleanExportField(value: string) {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "/").trim();
}

function cleanExportCookie(value: string) {
  const raw = value.replace(/\r?\n/g, " ").trim();
  if (!raw.includes("|")) return raw;

  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  const cookiePart = parts.find((part) => /\b(c_user|datr|xs|fr|sb|wd|presence|locale)=/i.test(part));
  return cookiePart || raw.replace(/\|/g, " ");
}

export async function exportFacebookAutoAccounts(ownerId: number, ids: unknown) {
  if (!Array.isArray(ids)) return { count: 0, content: "" };
  const cleanIds = new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
  if (cleanIds.size === 0) return { count: 0, content: "" };

  const lines = (await readAccounts(ownerId))
    .filter((account) => cleanIds.has(account.id))
    .map((account) => {
      const name = cleanExportField(facebookAutoAccountLabel(account) || account.name || account.userId);
      const cookie = cleanExportCookie(account.cookie);
      return `${account.userId}|${cookie}|${name}`;
    });

  return {
    count: lines.length,
    content: lines.join("\n")
  };
}

export async function getFacebookAutoAccountRuntimeInputs(ownerId: number, ids: unknown) {
  if (!Array.isArray(ids)) return [];
  const cleanIds = new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
  if (cleanIds.size === 0) return [];

  return (await readAccounts(ownerId))
    .filter((account) => cleanIds.has(account.id) && account.status === "active")
    .map((account) => ({ cookie: account.cookie, proxy: account.proxy || "" }));
}
