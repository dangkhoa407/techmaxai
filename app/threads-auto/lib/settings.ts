import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "../../facebook-auto/lib/database";

export type ThreadsAutoSettings = {
  enableGroupPost?: boolean;
  enableFeedComment?: boolean;
  enableSearchComment?: boolean;
  groupPostCount?: number;
  feedCommentCount?: number;
  searchCommentCount?: number;
  groupPostDelaySeconds?: number;
  feedCommentDelaySeconds?: number;
  searchCommentDelaySeconds?: number;
  randomizeTasks?: boolean;
  groupPostTopic?: string;
  groupPostContentDraft?: string;
  groupPostItems?: string[];
  feedComments?: string;
  searchKeyword?: string;
  searchComments?: string;
};

async function ensureThreadsAutoSettingsDatabase() {
  await ensureFacebookAutoDatabase();
  await getFacebookAutoDatabase().query(`
    CREATE TABLE IF NOT EXISTS threads_auto_settings (
      user_id INT UNSIGNED PRIMARY KEY,
      config_json LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_threads_auto_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
  `);
}

export async function getThreadsAutoSettings(ownerId: number) {
  await ensureThreadsAutoSettingsDatabase();
  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT config_json, updated_at FROM threads_auto_settings WHERE user_id = ? LIMIT 1",
    [ownerId]
  );
  const row = (rows as Array<{ config_json?: string | null; updated_at?: string | Date | null }>)[0];
  let settings: ThreadsAutoSettings | null = null;
  try {
    settings = row?.config_json ? JSON.parse(row.config_json) : null;
  } catch {
    settings = null;
  }
  return {
    settings,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

export async function saveThreadsAutoSettings(ownerId: number, settings: ThreadsAutoSettings) {
  await ensureThreadsAutoSettingsDatabase();
  await getFacebookAutoDatabase().execute(
    `INSERT INTO threads_auto_settings (user_id, config_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_at = CURRENT_TIMESTAMP`,
    [ownerId, JSON.stringify(settings)]
  );
  return settings;
}
