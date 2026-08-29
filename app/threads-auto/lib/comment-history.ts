import { createHash } from "node:crypto";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase } from "../../facebook-auto/lib/database";

export type ThreadsAutoCommentTaskType = "newfeed" | "search";

function normalizePostUrl(postUrl: string) {
  try {
    const url = new URL(String(postUrl || "").trim(), "https://www.threads.com");
    url.hash = "";
    return url.href;
  } catch {
    return String(postUrl || "").trim();
  }
}

function hashPostUrl(postUrl: string) {
  return createHash("sha256").update(normalizePostUrl(postUrl)).digest("hex");
}

async function ensureThreadsAutoCommentHistoryDatabase() {
  await ensureFacebookAutoDatabase();
  await getFacebookAutoDatabase().query(`
    CREATE TABLE IF NOT EXISTS threads_auto_commented_posts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_id INT UNSIGNED NOT NULL,
      account_user_id VARCHAR(190) DEFAULT NULL,
      task_type ENUM('newfeed', 'search') NOT NULL DEFAULT 'newfeed',
      post_url VARCHAR(768) NOT NULL,
      post_url_hash CHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_threads_commented_post_owner_url (owner_id, post_url_hash),
      INDEX idx_threads_commented_posts_owner_created (owner_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_vietnamese_ci
  `);
}

export async function listThreadsAutoCommentedPostUrls(ownerId: number) {
  await ensureThreadsAutoCommentHistoryDatabase();
  const [rows] = await getFacebookAutoDatabase().execute(
    "SELECT post_url FROM threads_auto_commented_posts WHERE owner_id = ? ORDER BY created_at DESC LIMIT 5000",
    [ownerId]
  );
  return (rows as Array<{ post_url: string }>).map((row) => normalizePostUrl(row.post_url)).filter(Boolean);
}

export async function saveThreadsAutoCommentedPostUrl(input: {
  ownerId: number;
  accountUserId?: string | null;
  postUrl: string;
  taskType: ThreadsAutoCommentTaskType;
}) {
  const postUrl = normalizePostUrl(input.postUrl);
  if (!postUrl) return;
  await ensureThreadsAutoCommentHistoryDatabase();
  await getFacebookAutoDatabase().execute(
    `INSERT INTO threads_auto_commented_posts (owner_id, account_user_id, task_type, post_url, post_url_hash)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE created_at = created_at`,
    [input.ownerId, input.accountUserId || null, input.taskType, postUrl, hashPostUrl(postUrl)]
  );
}
