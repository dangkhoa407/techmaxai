import { getThreadsAutoAccountsForRun, type ThreadsAutoAccount } from "./accounts";
import { runThreadsAutoPostActions, type ThreadsAutoPostRunLog } from "./bot";
import { listThreadsAutoCommentedPostUrls, saveThreadsAutoCommentedPostUrl } from "./comment-history";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase, getFacebookAutoMaxWorkers } from "../../facebook-auto/lib/database";

export type ThreadsAutoLog = ThreadsAutoPostRunLog & { id: number };

export type ThreadsAutoSnapshot = {
  running: boolean;
  paused: boolean;
  progress: number;
  currentPost: number;
  totalPosts: number;
  activeWorkers: number;
  maxWorkers: number;
  queuedWorkers: number;
  activeAccountUserIds: string[];
  accountProgress: Record<string, number>;
  startedAt: string | null;
  finishedAt: string | null;
  logs: ThreadsAutoLog[];
};

export type StartThreadsAutoConfig = {
  enableGroupPost: boolean;
  enableFeedComment: boolean;
  enableSearchComment: boolean;
  randomizeTasks: boolean;
  topics: string[];
  contents: string[];
  count: number;
  delaySeconds: number;
  feedCommentContents: string[];
  feedCommentCount: number;
  feedCommentDelaySeconds: number;
  searchKeyword: string;
  searchCommentContents: string[];
  searchCommentCount: number;
  searchCommentDelaySeconds: number;
};

type ThreadsAutoState = ThreadsAutoSnapshot & {
  nextLogId: number;
  delayLogId: number | null;
  stopRequested: boolean;
  abortControllers: Set<AbortController>;
  runToken: number;
};

type ThreadsAutoListener = (status: ThreadsAutoSnapshot) => void;
type PersistedThreadsJob = {
  accountIds: string[];
  config: StartThreadsAutoConfig;
  completedByAccount: number[];
  status: "running" | "paused";
  startedAt: string;
};

const globalForThreads = globalThis as typeof globalThis & {
  threadsAutoStates?: Map<number, ThreadsAutoState>;
  threadsAutoListeners?: Map<number, Set<ThreadsAutoListener>>;
  threadsAutoJobs?: Map<number, PersistedThreadsJob>;
  threadsAutoResumeCheckedOwners?: Set<number>;
  threadsAutoResumeBootstrapPromise?: Promise<void>;
};
let jobWriteQueue = Promise.resolve();

function createInitialState(): ThreadsAutoState {
  return {
    running: false,
    paused: false,
    progress: 0,
    currentPost: 0,
    totalPosts: 0,
    activeWorkers: 0,
    maxWorkers: 5,
    queuedWorkers: 0,
    activeAccountUserIds: [],
    accountProgress: {},
    startedAt: null,
    finishedAt: null,
    logs: [],
    nextLogId: 1,
    delayLogId: null,
    stopRequested: false,
    abortControllers: new Set(),
    runToken: 0
  };
}

function normalizeState(state: ThreadsAutoState) {
  state.activeWorkers ??= 0;
  state.maxWorkers ??= 5;
  state.queuedWorkers ??= 0;
  state.activeAccountUserIds ??= [];
  state.accountProgress ??= {};
  state.logs ??= [];
  state.nextLogId ??= 1;
  state.delayLogId ??= null;
  state.stopRequested ??= false;
  state.runToken ??= 0;
  if (!(state.abortControllers instanceof Set)) {
    state.abortControllers = new Set();
  }
  return state;
}

function getJobs() {
  globalForThreads.threadsAutoJobs ??= new Map();
  return globalForThreads.threadsAutoJobs;
}

function getResumeCheckedOwners() {
  globalForThreads.threadsAutoResumeCheckedOwners ??= new Set();
  return globalForThreads.threadsAutoResumeCheckedOwners;
}

function jobKey(ownerId: number) {
  return `owner:${ownerId}`;
}

function writeCurrentJob(ownerId: number, job: PersistedThreadsJob | null, finalStatus: "completed" | "stopped" = "completed") {
  const snapshot = job ? JSON.stringify(job) : null;
  jobWriteQueue = jobWriteQueue.then(async () => {
    await ensureFacebookAutoDatabase();
    await getFacebookAutoDatabase().execute(
      `INSERT INTO threads_auto_jobs (job_key, status, job_json, started_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), job_json = VALUES(job_json),
         started_at = VALUES(started_at), updated_at = CURRENT_TIMESTAMP`,
      [jobKey(ownerId), job?.status ?? finalStatus, snapshot, job?.startedAt ? new Date(job.startedAt) : null]
    );
  }).catch((error) => console.error("Không thể lưu checkpoint Threads Auto vào database:", error));
  return jobWriteQueue;
}

function clearCurrentJob(ownerId: number) {
  jobWriteQueue = jobWriteQueue.then(async () => {
    await ensureFacebookAutoDatabase();
    await getFacebookAutoDatabase().execute("DELETE FROM threads_auto_jobs WHERE job_key = ?", [jobKey(ownerId)]);
  }).catch((error) => console.error("Không thể xoá checkpoint Threads Auto trong database:", error));
  return jobWriteQueue;
}

async function readCurrentJob(ownerId: number) {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT status, job_json FROM threads_auto_jobs WHERE job_key = ? LIMIT 1",
      [jobKey(ownerId)]
    );
    const row = (rows as Array<{ status: string; job_json: string | null }>)[0];
    if (!row?.job_json || (row.status !== "running" && row.status !== "paused")) return null;
    const value = JSON.parse(row.job_json) as Partial<PersistedThreadsJob>;
    if ((value.status !== "running" && value.status !== "paused") || !value.config || !Array.isArray(value.accountIds) || !Array.isArray(value.completedByAccount)) return null;
    return value as PersistedThreadsJob;
  } catch {
    return null;
  }
}

async function readResumableJobOwnerIds() {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT job_key FROM threads_auto_jobs WHERE status IN ('running', 'paused') AND job_json IS NOT NULL"
    );
    return (rows as Array<{ job_key: string }>)
      .map((row) => /^owner:(\d+)$/.exec(String(row.job_key || ""))?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (error) {
    console.error("Không thể đọc danh sách job Auto Threads cần resume:", error);
    return [];
  }
}

function getState(ownerId: number) {
  globalForThreads.threadsAutoStates ??= new Map();
  if (!globalForThreads.threadsAutoStates.has(ownerId)) {
    globalForThreads.threadsAutoStates.set(ownerId, createInitialState());
  }
  return normalizeState(globalForThreads.threadsAutoStates.get(ownerId)!);
}

function getListeners(ownerId: number) {
  globalForThreads.threadsAutoListeners ??= new Map();
  if (!globalForThreads.threadsAutoListeners.has(ownerId)) {
    globalForThreads.threadsAutoListeners.set(ownerId, new Set());
  }
  return globalForThreads.threadsAutoListeners.get(ownerId)!;
}

function snapshotFromState(state: ThreadsAutoState): ThreadsAutoSnapshot {
  return {
    running: state.running,
    paused: state.paused,
    progress: state.progress,
    currentPost: state.currentPost,
    totalPosts: state.totalPosts,
    activeWorkers: state.activeWorkers,
    maxWorkers: state.maxWorkers,
    queuedWorkers: state.queuedWorkers,
    activeAccountUserIds: [...state.activeAccountUserIds],
    accountProgress: { ...state.accountProgress },
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    logs: [...state.logs]
  };
}

function notify(ownerId: number) {
  const status = snapshot(ownerId);
  for (const listener of getListeners(ownerId)) listener(status);
}

function log(state: ThreadsAutoState, ownerId: number, level: ThreadsAutoLog["level"], message: string) {
  state.logs.push({
    id: state.nextLogId++,
    level,
    message,
    createdAt: new Date().toISOString()
  });
  if (state.logs.length > 500) {
    state.logs.splice(0, state.logs.length - 500);
  }
  notify(ownerId);
}

function updateLog(state: ThreadsAutoState, ownerId: number, logId: number, level: ThreadsAutoLog["level"], message: string) {
  const entry = state.logs.find((item) => item.id === logId);
  if (!entry) return;
  entry.level = level;
  entry.message = message;
  entry.createdAt = new Date().toISOString();
  notify(ownerId);
}

function removeLog(state: ThreadsAutoState, ownerId: number, logId: number) {
  const index = state.logs.findIndex((item) => item.id === logId);
  if (index < 0) return;
  state.logs.splice(index, 1);
  notify(ownerId);
}

async function waitWithRealtimeDelay(state: ThreadsAutoState, ownerId: number, accountLabel: string, seconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds <= 0) return;
  log(state, ownerId, "info", `${accountLabel}: \u0110ang \u0111\u1ee3i ${totalSeconds}s`);
  const logId = state.logs[state.logs.length - 1]?.id ?? null;
  state.delayLogId = logId;
  for (let remaining = totalSeconds; remaining > 0; remaining -= 1) {
    if (state.stopRequested) break;
    if (logId !== null) updateLog(state, ownerId, logId, "info", `${accountLabel}: \u0110ang \u0111\u1ee3i ${remaining}s`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (state.delayLogId === logId) state.delayLogId = null;
  if (logId !== null) removeLog(state, ownerId, logId);
}

async function waitIfPaused(state: ThreadsAutoState, ownerId: number, job: PersistedThreadsJob) {
  let logged = false;
  while (state.paused && !state.stopRequested) {
    if (!logged) {
      logged = true;
      job.status = "paused";
      await writeCurrentJob(ownerId, job);
      log(state, ownerId, "info", "Bot Threads đang tạm dừng.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (logged && !state.stopRequested) {
    job.status = "running";
    await writeCurrentJob(ownerId, job);
    log(state, ownerId, "info", "Bot Threads tiếp tục chạy.");
  }
}

export function snapshot(ownerId: number): ThreadsAutoSnapshot {
  return snapshotFromState(getState(ownerId));
}

export function subscribeThreadsAutoStatus(listener: ThreadsAutoListener, ownerId: number) {
  const listeners = getListeners(ownerId);
  listeners.add(listener);
  listener(snapshot(ownerId));
  return () => listeners.delete(listener);
}

export function clearThreadsAutoStatus(ownerId: number) {
  const state = getState(ownerId);
  state.logs = [];
  state.progress = 0;
  state.currentPost = 0;
  state.totalPosts = 0;
  state.activeWorkers = 0;
  state.maxWorkers = 5;
  state.queuedWorkers = 0;
  state.activeAccountUserIds = [];
  state.accountProgress = {};
  state.startedAt = null;
  state.finishedAt = null;
  state.nextLogId = 1;
  state.delayLogId = null;
  state.stopRequested = false;
  state.runToken += 1;
  for (const controller of state.abortControllers) controller.abort();
  state.abortControllers.clear();
  getJobs().delete(ownerId);
  void clearCurrentJob(ownerId);
  notify(ownerId);
  return snapshot(ownerId);
}

export function stopThreadsAutoRun(ownerId: number) {
  const state = getState(ownerId);
  if (!state.running) return snapshot(ownerId);
  state.stopRequested = true;
  state.running = false;
  state.paused = false;
  state.activeWorkers = 0;
  state.queuedWorkers = 0;
  state.finishedAt = new Date().toISOString();
  state.runToken += 1;
  log(state, ownerId, "warn", "Đã dừng bot Threads ngay lập tức.");
  for (const controller of state.abortControllers) controller.abort();
  state.abortControllers.clear();
  getJobs().delete(ownerId);
  void writeCurrentJob(ownerId, null, "stopped");
  notify(ownerId);
  return snapshot(ownerId);
}

function actionsPerAccount(config: StartThreadsAutoConfig) {
  return (
    (config.enableGroupPost ? config.count : 0) +
    (config.enableFeedComment ? config.feedCommentCount : 0) +
    (config.enableSearchComment ? config.searchCommentCount : 0)
  );
}

async function resetThreadsRunState(ownerId: number, accounts: ThreadsAutoAccount[], config: StartThreadsAutoConfig, startedAt?: string) {
  const state = getState(ownerId);
  const configuredMaxWorkers = await getFacebookAutoMaxWorkers();
  const maxWorkers = Math.min(configuredMaxWorkers, Math.max(accounts.length, 1));
  const totalPosts = Math.max(0, accounts.length * actionsPerAccount(config));
  state.running = true;
  state.paused = false;
  state.progress = 0;
  state.currentPost = 0;
  state.totalPosts = totalPosts;
  state.activeWorkers = 0;
  state.maxWorkers = configuredMaxWorkers;
  state.queuedWorkers = Math.max(accounts.length - maxWorkers, 0);
  state.activeAccountUserIds = accounts.map((account) => account.userId).filter(Boolean);
  state.accountProgress = Object.fromEntries(accounts.map((account) => [account.userId, 0]));
  state.startedAt = startedAt || new Date().toISOString();
  state.finishedAt = null;
  state.logs = [];
  state.nextLogId = 1;
  state.delayLogId = null;
  state.stopRequested = false;
  state.runToken += 1;
  for (const controller of state.abortControllers) controller.abort();
  state.abortControllers.clear();
  return { state, maxWorkers, totalPosts, runToken: state.runToken };
}

async function runThreadsJob(ownerId: number, accounts: ThreadsAutoAccount[], config: StartThreadsAutoConfig, job: PersistedThreadsJob, runToken: number) {
  const state = getState(ownerId);
  const maxWorkers = Math.min(await getFacebookAutoMaxWorkers(), Math.max(accounts.length, 1));
  const perAccount = actionsPerAccount(config);
  const totalPosts = Math.max(0, accounts.length * perAccount);
  job.completedByAccount = accounts.map((_, index) => Math.min(Math.max(job.completedByAccount[index] || 0, 0), perAccount));
  let completed = job.completedByAccount.reduce((sum, count) => sum + count, 0);
  let nextAccountIndex = 0;
  state.currentPost = completed;
  state.progress = Math.round((completed / Math.max(totalPosts, 1)) * 100);

  const commentedPostUrls = new Set(await listThreadsAutoCommentedPostUrls(ownerId).catch(() => []));
  try {
    async function runAccount(account: ThreadsAutoAccount, accountIndex: number) {
      if (state.stopRequested || state.runToken !== runToken) return;
      await waitIfPaused(state, ownerId, job);
      if (state.stopRequested || state.runToken !== runToken) return;
      const abortController = new AbortController();
      state.abortControllers.add(abortController);
      const accountLabel = account.name || account.userId || "Threads";
      let accountCompleted = Math.min(Math.max(job.completedByAccount[accountIndex] || 0, 0), perAccount);
      if (accountCompleted >= perAccount) {
        state.accountProgress[account.userId] = 100;
        notify(ownerId);
        return;
      }
      log(state, ownerId, "info", "====================");
      log(state, ownerId, "info", `${accountLabel}: Bắt đầu tài khoản.`);
      try {
        await runThreadsAutoPostActions(
          {
            cookie: account.cookie,
            proxy: account.proxy || "",
            signal: abortController.signal,
            enableGroupPost: config.enableGroupPost,
            enableFeedComment: config.enableFeedComment,
            enableSearchComment: config.enableSearchComment,
            randomizeTasks: config.randomizeTasks,
            topics: config.topics,
            contents: config.contents,
            count: config.count,
            delaySeconds: config.delaySeconds,
            feedCommentContents: config.feedCommentContents,
            feedCommentCount: config.feedCommentCount,
            feedCommentDelaySeconds: config.feedCommentDelaySeconds,
            searchKeyword: config.searchKeyword,
            searchCommentContents: config.searchCommentContents,
            searchCommentCount: config.searchCommentCount,
            searchCommentDelaySeconds: config.searchCommentDelaySeconds,
            skipCompletedActions: accountCompleted
          },
          {
            beforeAction() {
              return waitIfPaused(state, ownerId, job);
            },
            onLog(entry) {
              if (/^Thực hiện tác vụ /i.test(entry.message)) {
                log(state, ownerId, "info", "====================");
              }
              log(state, ownerId, entry.level, `${accountLabel}: ${entry.message}`);
              if (/^Đã (?:đăng post|comment newfeed|comment search) /i.test(entry.message)) {
                completed += 1;
                accountCompleted += 1;
                job.completedByAccount[accountIndex] = accountCompleted;
                job.status = state.paused ? "paused" : "running";
                void writeCurrentJob(ownerId, job);
                state.currentPost = completed;
                state.accountProgress[account.userId] = Math.round((accountCompleted / Math.max(perAccount, 1)) * 100);
                state.progress = Math.round((completed / Math.max(totalPosts, 1)) * 100);
                notify(ownerId);
              }
            },
            onDelay(seconds) {
              return waitWithRealtimeDelay(state, ownerId, accountLabel, seconds);
            },
            getCommentedPostUrls() {
              return [...commentedPostUrls];
            },
            async onCommentedPost(postUrl, taskType) {
              commentedPostUrls.add(postUrl);
              await saveThreadsAutoCommentedPostUrl({
                ownerId,
                accountUserId: account.userId,
                postUrl,
                taskType
              });
            }
          }
        );
        state.accountProgress[account.userId] = 100;
        state.currentPost = completed;
        state.progress = Math.round((completed / Math.max(totalPosts, 1)) * 100);
        log(state, ownerId, "success", `${accountLabel}: Hoàn tất tài khoản.`);
      } catch (error) {
        if (!state.stopRequested && state.runToken === runToken) {
          log(state, ownerId, "error", `${accountLabel}: ${error instanceof Error ? error.message : "Lỗi không xác định khi chạy Auto Threads."}`);
        }
      } finally {
        state.abortControllers.delete(abortController);
      }
    }

    async function worker() {
      while (true) {
        await waitIfPaused(state, ownerId, job);
        const accountIndex = nextAccountIndex++;
        if (accountIndex >= accounts.length || state.stopRequested || state.runToken !== runToken) return;
        state.activeWorkers += 1;
        state.queuedWorkers = Math.max(accounts.length - nextAccountIndex, 0);
        notify(ownerId);
        try {
          if (!state.stopRequested) await runAccount(accounts[accountIndex], accountIndex);
        } finally {
          state.activeWorkers = Math.max(state.activeWorkers - 1, 0);
          state.queuedWorkers = Math.max(accounts.length - nextAccountIndex, 0);
          notify(ownerId);
        }
      }
    }

    await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
    log(state, ownerId, "info", "====================");
    if (state.stopRequested) {
      log(state, ownerId, "warn", `Đã dừng Auto Threads: ${completed}/${totalPosts} tác vụ.`);
    } else {
      log(state, ownerId, completed > 0 ? "success" : "warn", `Hoàn tất Auto Threads: ${completed}/${totalPosts} tác vụ.`);
    }
  } finally {
    if (state.runToken !== runToken) return;
    const stopped = state.stopRequested;
    state.running = false;
    state.paused = false;
    state.activeWorkers = 0;
    state.queuedWorkers = 0;
    state.stopRequested = false;
    state.abortControllers.clear();
    state.finishedAt = new Date().toISOString();
    state.currentPost = completed;
    state.progress = Math.round((completed / Math.max(totalPosts, 1)) * 100);
    const allCompleted = job.completedByAccount.every((count) => count >= perAccount);
    if (!stopped && allCompleted) {
      getJobs().delete(ownerId);
      await writeCurrentJob(ownerId, null);
    }
    notify(ownerId);
  }
}

export async function startThreadsAutoRun(ownerId: number, accounts: ThreadsAutoAccount[], config: StartThreadsAutoConfig) {
  const current = getState(ownerId);
  getResumeCheckedOwners().add(ownerId);
  if (current.running) throw new Error("Auto Threads đang chạy.");

  const { state, totalPosts, runToken } = await resetThreadsRunState(ownerId, accounts, config);
  const job: PersistedThreadsJob = {
    accountIds: accounts.map((account) => account.id),
    config,
    completedByAccount: accounts.map(() => 0),
    status: "running",
    startedAt: state.startedAt || new Date().toISOString()
  };
  getJobs().set(ownerId, job);
  await writeCurrentJob(ownerId, job);
  log(state, ownerId, "info", `Bắt đầu Auto Threads với ${accounts.length} tài khoản và ${totalPosts} tác vụ.`);

  void runThreadsJob(ownerId, accounts, config, job, runToken);
  notify(ownerId);
  return snapshot(ownerId);
}

export async function togglePauseThreadsAutoRun(ownerId: number) {
  const state = getState(ownerId);
  if (!state.running) throw new Error("Bot Threads chưa chạy.");
  state.paused = !state.paused;
  const job = getJobs().get(ownerId);
  if (job) {
    job.status = state.paused ? "paused" : "running";
    await writeCurrentJob(ownerId, job);
  }
  log(state, ownerId, "info", state.paused ? "Bot Threads đã tạm dừng." : "Bot Threads tiếp tục chạy.");
  notify(ownerId);
  return snapshot(ownerId);
}

export async function clearThreadsAutoResumeJob(ownerId: number) {
  const state = getState(ownerId);
  if (state.running) throw new Error("Bot Threads đang chạy. Hãy dừng bot trước khi xoá luồng.");
  getJobs().delete(ownerId);
  await clearCurrentJob(ownerId);
  return clearThreadsAutoStatus(ownerId);
}

export async function getThreadsAutoStatus(ownerId: number) {
  await ensureThreadsAutoResume(ownerId);
  const state = getState(ownerId);
  state.maxWorkers = await getFacebookAutoMaxWorkers().catch(() => state.maxWorkers || 5);
  return snapshot(ownerId);
}

export function bootstrapThreadsAutoResume() {
  if (!globalForThreads.threadsAutoResumeBootstrapPromise) {
    globalForThreads.threadsAutoResumeBootstrapPromise = (async () => {
      const ownerIds = await readResumableJobOwnerIds();
      await Promise.allSettled(ownerIds.map((ownerId) => ensureThreadsAutoResume(ownerId)));
    })();
  }
  return globalForThreads.threadsAutoResumeBootstrapPromise;
}

async function ensureThreadsAutoResume(ownerId: number) {
  const checkedOwners = getResumeCheckedOwners();
  if (checkedOwners.has(ownerId)) return;
  checkedOwners.add(ownerId);
  const saved = await readCurrentJob(ownerId);
  if (!saved) return;

  const accounts = await getThreadsAutoAccountsForRun(saved.accountIds, ownerId);
  if (!accounts.length) {
    await clearCurrentJob(ownerId);
    return;
  }

  saved.completedByAccount = accounts.map((_, index) => Number(saved.completedByAccount[index] || 0));
  const { state, totalPosts, runToken } = await resetThreadsRunState(ownerId, accounts, saved.config, saved.startedAt);
  const perAccount = actionsPerAccount(saved.config);
  const completed = saved.completedByAccount.reduce((sum, count) => sum + Math.min(Math.max(count || 0, 0), perAccount), 0);
  state.currentPost = completed;
  state.progress = Math.round((completed / Math.max(totalPosts, 1)) * 100);
  state.paused = saved.status === "paused";
  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index];
    const done = Math.min(Math.max(saved.completedByAccount[index] || 0, 0), perAccount);
    state.accountProgress[account.userId] = Math.round((done / Math.max(perAccount, 1)) * 100);
  }
  getJobs().set(ownerId, saved);
  log(state, ownerId, "warn", `Server đã khởi động lại. Tiếp tục từ tác vụ ${state.currentPost + 1}/${state.totalPosts}.`);
  void runThreadsJob(ownerId, accounts, saved.config, saved, runToken);
}
