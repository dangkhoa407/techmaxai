import mysql, { Pool } from "mysql2/promise";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const globalDatabase = globalThis as typeof globalThis & {
  facebookAutoDatabase?: Pool;
  facebookAutoSchemaPromise?: Promise<void>;
  facebookAutoSettingsCache?: Map<string, { value: string | null; expiresAt: number }>;
};

const FACEBOOK_AUTO_SETTING_TTL_MS = Math.max(1_000, Number(process.env.FACEBOOK_AUTO_SETTING_TTL_MS || 15_000));
const FACEBOOK_AUTO_CONNECTION_LIMIT = Math.max(2, Number(process.env.FACEBOOK_AUTO_DB_CONNECTION_LIMIT || 8));

export function getFacebookAutoDatabase() {
  if (!globalDatabase.facebookAutoDatabase) {
    globalDatabase.facebookAutoDatabase = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "techmax_app",
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: FACEBOOK_AUTO_CONNECTION_LIMIT,
      maxIdle: Math.min(FACEBOOK_AUTO_CONNECTION_LIMIT, 5),
      idleTimeout: 60_000,
      queueLimit: 0
    });
  }
  return globalDatabase.facebookAutoDatabase;
}

function settingsCache() {
  if (!globalDatabase.facebookAutoSettingsCache) {
    globalDatabase.facebookAutoSettingsCache = new Map();
  }
  return globalDatabase.facebookAutoSettingsCache;
}

export function clearFacebookAutoSettingsCache() {
  settingsCache().clear();
}

async function readFacebookAutoSetting(key: string, fallback: string, useCache = true) {
  const cache = settingsCache();
  const cached = cache.get(key);
  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.value ?? fallback;
  }

  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
    [key]
  );
  const value = (rows as Array<{ setting_value: string }>)[0]?.setting_value ?? fallback;
  if (useCache) {
    cache.set(key, { value, expiresAt: Date.now() + FACEBOOK_AUTO_SETTING_TTL_MS });
    if (cache.size > 20) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
  return value;
}

async function writeFacebookAutoSetting(key: string, value: string, description: string) {
  await ensureFacebookAutoDatabase();
  await getFacebookAutoDatabase().execute(
    `INSERT INTO app_settings (setting_key, setting_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)`,
    [key, value, description]
  );
  clearFacebookAutoSettingsCache();
}

export function ensureFacebookAutoDatabase() {
  if (!globalDatabase.facebookAutoSchemaPromise) {
    globalDatabase.facebookAutoSchemaPromise = getFacebookAutoDatabase().query(`
      CREATE TABLE IF NOT EXISTS facebook_auto_jobs (
        job_key VARCHAR(64) PRIMARY KEY,
        status ENUM('running', 'paused', 'completed', 'stopped') NOT NULL,
        job_json LONGTEXT NULL,
        started_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
    `).then(async () => {
      await getFacebookAutoDatabase().query(`
      CREATE TABLE IF NOT EXISTS threads_auto_jobs (
        job_key VARCHAR(64) PRIMARY KEY,
        status ENUM('running', 'paused', 'completed', 'stopped') NOT NULL,
        job_json LONGTEXT NULL,
        started_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
      `);
      await getFacebookAutoDatabase().query(`
      CREATE TABLE IF NOT EXISTS facebook_auto_accounts (
          id VARCHAR(36) PRIMARY KEY,
          user_id INT UNSIGNED DEFAULT NULL,
          device_key_hash CHAR(64) DEFAULT NULL,
          name VARCHAR(255) NOT NULL,
          facebook_user_id VARCHAR(32) NOT NULL,
          facebook_name VARCHAR(255) DEFAULT NULL,
          proxy VARCHAR(255) DEFAULT NULL,
          status ENUM('active', 'checkpoint', 'invalid', 'unknown') DEFAULT NULL,
          checkpoint_code VARCHAR(16) DEFAULT NULL,
          admin_disabled TINYINT(1) NOT NULL DEFAULT 0,
          cookie LONGTEXT NOT NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          INDEX idx_facebook_auto_accounts_device (user_id, device_key_hash),
          UNIQUE KEY unique_user_facebook (user_id, facebook_user_id),
          INDEX idx_facebook_auto_accounts_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
      `);
      await getFacebookAutoDatabase().query(`
      CREATE TABLE IF NOT EXISTS facebook_auto_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_id INT UNSIGNED NOT NULL,
        account_user_id VARCHAR(32) DEFAULT NULL,
        level ENUM('info', 'success', 'warn', 'error') NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_facebook_auto_logs_owner_created (owner_id, created_at),
        INDEX idx_facebook_auto_logs_account_created (account_user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
      `);
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
      await ensureFacebookAutoAccountColumns();
      await ensureThreadsAutoAccountColumns();
      await getFacebookAutoDatabase().query(`
        CREATE TABLE IF NOT EXISTS facebook_auto_group_cache (
          facebook_user_id VARCHAR(32) NOT NULL,
          cache_scope VARCHAR(255) NOT NULL,
          links_json LONGTEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (facebook_user_id, cache_scope)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
      `);
      await getFacebookAutoDatabase().query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          setting_key VARCHAR(120) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          description VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
      `);
      await getFacebookAutoDatabase().execute(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ('facebook_auto_max_workers', '5', 'Số luồng Auto Facebook và Threads tối đa trên toàn hệ thống')
         ON DUPLICATE KEY UPDATE setting_key = setting_key`
      );
      await getFacebookAutoDatabase().execute(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ('facebook_auto_headless_chrome', '1', 'Bật/tắt headless Chrome cho Auto Facebook và Threads')
         ON DUPLICATE KEY UPDATE setting_key = setting_key`
      );
      await getFacebookAutoDatabase().execute(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ('facebook_auto_low_resource_mode', '1', 'Giảm tải Chrome Auto Facebook và Threads cho máy yếu')
         ON DUPLICATE KEY UPDATE setting_value = CASE WHEN setting_value = '0' THEN '1' ELSE setting_value END`
      );
      await ensureAutomationUsageColumns();
      await migrateLegacyFacebookAccounts();
    });
  }
  return globalDatabase.facebookAutoSchemaPromise;
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

async function ensureAutomationUsageColumns() {
  if (!(await columnExists("users", "automation_usage_count"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE users ADD COLUMN automation_usage_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER plan_expires_at"
    );
  }

  if (!(await columnExists("users", "facebook_auto_usage_count"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE users ADD COLUMN facebook_auto_usage_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER campaign_usage_count"
    );
  }

  if (!(await columnExists("service_plans", "automation_usage_limit"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE service_plans ADD COLUMN automation_usage_limit INT UNSIGNED DEFAULT NULL AFTER messages"
    );
  }

  if (!(await columnExists("service_plans", "automation_usage_unlimited"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE service_plans ADD COLUMN automation_usage_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER automation_usage_limit"
    );
  }

  if (!(await columnExists("service_plans", "facebook_auto_usage_limit"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE service_plans ADD COLUMN facebook_auto_usage_limit INT UNSIGNED DEFAULT NULL AFTER campaign_usage_unlimited"
    );
  }

  if (!(await columnExists("service_plans", "facebook_auto_usage_unlimited"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE service_plans ADD COLUMN facebook_auto_usage_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER facebook_auto_usage_limit"
    );
  }

  await getFacebookAutoDatabase().query(
    `UPDATE service_plans
     SET automation_usage_limit = CASE code
       WHEN 'trial' THEN 30
       WHEN 'starter' THEN 100
       WHEN 'professional' THEN 500
       ELSE automation_usage_limit
     END,
     automation_usage_unlimited = CASE code
       WHEN 'enterprise' THEN 1
       ELSE automation_usage_unlimited
     END,
     facebook_auto_usage_limit = CASE code
       WHEN 'trial' THEN 30
       WHEN 'starter' THEN 100
       WHEN 'professional' THEN 500
       ELSE facebook_auto_usage_limit
     END,
     facebook_auto_usage_unlimited = CASE code
       WHEN 'enterprise' THEN 1
       ELSE facebook_auto_usage_unlimited
     END
     WHERE code IN ('trial', 'starter', 'professional', 'enterprise')`
  ).catch(() => null);
}

async function ensureFacebookAutoAccountColumns() {
  if (!(await columnExists("facebook_auto_accounts", "user_id"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE facebook_auto_accounts ADD COLUMN user_id INT UNSIGNED DEFAULT NULL AFTER id");
  }

  if (!(await columnExists("facebook_auto_accounts", "device_key_hash"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD COLUMN device_key_hash CHAR(64) DEFAULT NULL AFTER user_id"
    );
  }

  if (!(await columnExists("facebook_auto_accounts", "admin_disabled"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD COLUMN admin_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status"
    );
  }

  if (!(await columnExists("facebook_auto_accounts", "checkpoint_code"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD COLUMN checkpoint_code VARCHAR(16) DEFAULT NULL AFTER status"
    );
  }

  if (!(await columnExists("facebook_auto_accounts", "proxy"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD COLUMN proxy VARCHAR(255) DEFAULT NULL AFTER facebook_name"
    );
  }

  if (await indexExists("facebook_auto_accounts", "facebook_user_id")) {
    await getFacebookAutoDatabase().query("ALTER TABLE facebook_auto_accounts DROP INDEX facebook_user_id");
  }

  if (!(await indexExists("facebook_auto_accounts", "idx_facebook_auto_accounts_device"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD INDEX idx_facebook_auto_accounts_device (user_id, device_key_hash)"
    );
  }

  if (!(await indexExists("facebook_auto_accounts", "unique_user_facebook"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD UNIQUE KEY unique_user_facebook (user_id, facebook_user_id)"
    );
  }

  if (!(await indexExists("facebook_auto_accounts", "idx_facebook_auto_accounts_user_updated"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE facebook_auto_accounts ADD INDEX idx_facebook_auto_accounts_user_updated (user_id, updated_at)"
    );
  }
}

async function ensureThreadsAutoAccountColumns() {
  if (!(await columnExists("threads_auto_accounts", "user_id"))) {
    await getFacebookAutoDatabase().query("ALTER TABLE threads_auto_accounts ADD COLUMN user_id INT UNSIGNED DEFAULT NULL AFTER id");
  }

  if (!(await columnExists("threads_auto_accounts", "device_key_hash"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD COLUMN device_key_hash CHAR(64) DEFAULT NULL AFTER user_id"
    );
  }

  if (!(await columnExists("threads_auto_accounts", "proxy"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD COLUMN proxy VARCHAR(255) DEFAULT NULL AFTER threads_name"
    );
  }

  if (!(await columnExists("threads_auto_accounts", "admin_disabled"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD COLUMN admin_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status"
    );
  }

  if (!(await indexExists("threads_auto_accounts", "idx_threads_auto_accounts_device"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD INDEX idx_threads_auto_accounts_device (user_id, device_key_hash)"
    );
  }

  if (!(await indexExists("threads_auto_accounts", "unique_user_threads"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD UNIQUE KEY unique_user_threads (user_id, threads_user_id)"
    );
  }

  if (!(await indexExists("threads_auto_accounts", "idx_threads_auto_accounts_user_updated"))) {
    await getFacebookAutoDatabase().query(
      "ALTER TABLE threads_auto_accounts ADD INDEX idx_threads_auto_accounts_user_updated (user_id, updated_at)"
    );
  }
}

export async function getFacebookAutoMaxWorkers() {
  await ensureFacebookAutoDatabase();
  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'facebook_auto_max_workers' LIMIT 1"
  );
  const value = Number((rows as Array<{ setting_value: string }>)[0]?.setting_value ?? "5");
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 100) : 5;
}

export async function setFacebookAutoMaxWorkers(value: number) {
  const normalized = Math.min(Math.max(Math.floor(Number(value) || 5), 1), 100);
  await writeFacebookAutoSetting(
    "facebook_auto_max_workers",
    String(normalized),
    "Số luồng Auto Facebook và Threads tối đa trên toàn hệ thống"
  );
  return normalized;
}

export async function setFacebookAutoHeadlessChrome(value: boolean) {
  await writeFacebookAutoSetting("facebook_auto_headless_chrome", value ? "1" : "0", "Bật/tắt headless Chrome cho Auto Facebook và Threads");
  return value;
}

export async function setFacebookAutoLowResourceMode(value: boolean) {
  await writeFacebookAutoSetting("facebook_auto_low_resource_mode", value ? "1" : "0", "Giảm tải Chrome Auto Facebook và Threads cho máy yếu");
  return value;
}

export async function getFacebookAutoHeadlessChrome() {
  await ensureFacebookAutoDatabase();
  return String(await readFacebookAutoSetting("facebook_auto_headless_chrome", "1", false)) !== "0";
}

export async function getFacebookAutoLowResourceMode() {
  await ensureFacebookAutoDatabase();
  return String(await readFacebookAutoSetting("facebook_auto_low_resource_mode", "1", false)) !== "0";
}

async function migrateLegacyFacebookAccounts() {
  const legacyPath = path.join(process.cwd(), "data", "facebook-auto-accounts.json");
  if (!existsSync(legacyPath)) return;

  const parsed = JSON.parse(readFileSync(legacyPath, "utf8")) as { accounts?: Array<Record<string, unknown>> };
  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
  const connection = await getFacebookAutoDatabase().getConnection();
  try {
    await connection.beginTransaction();
    for (const account of accounts) {
      if (!account.id || !account.name || !account.userId || !account.cookie) continue;
      await connection.execute(
        `INSERT INTO facebook_auto_accounts
          (id, name, facebook_user_id, facebook_name, status, cookie, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), facebook_name = VALUES(facebook_name),
           status = VALUES(status), cookie = VALUES(cookie), updated_at = VALUES(updated_at)`,
        [String(account.id), String(account.name), String(account.userId), account.facebookName ? String(account.facebookName) : null,
          account.status ? String(account.status) : null, String(account.cookie),
          new Date(String(account.createdAt || new Date().toISOString())),
          new Date(String(account.updatedAt || new Date().toISOString()))]
      );
    }
    await connection.commit();
    unlinkSync(legacyPath);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
