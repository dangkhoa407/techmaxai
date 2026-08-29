import { existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, request as httpRequest, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import net from "node:net";
import tls from "node:tls";
import { AsyncLocalStorage } from "node:async_hooks";
import { Builder, By, Key, until, WebDriver, WebElement } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import { ensureFacebookAutoDatabase, getFacebookAutoDatabase, getFacebookAutoHeadlessChrome, getFacebookAutoLowResourceMode, getFacebookAutoMaxWorkers } from "./database";
import { getFacebookAutoAccountLabelByUserId, reserveFacebookAutoAutomationUsage, updateFacebookAutoAccountStatus } from "./accounts";

export type BotConfig = {
  cookie: string;
  cookieList: string[];
  accountProxies: string[];
  proxy?: string;
  enableReact: boolean;
  enableComment: boolean;
  enableGroup: boolean;
  enableGroupComment: boolean;
  enableGroupPost: boolean;
  enablePokes: boolean;
  headlessChrome: boolean;
  lowResourceMode: boolean;
  totalPosts: number;
  reactCount: number;
  commentCount: number;
  groupCount: number;
  groupCommentCount: number;
  groupPostCount: number;
  pokesCount: number;
  reactDelaySeconds: number;
  commentDelaySeconds: number;
  groupDelaySeconds: number;
  groupCommentDelaySeconds: number;
  groupPostDelaySeconds: number;
  pokesDelaySeconds: number;
  randomizeTasks: boolean;
  comments: string[];
  groupPostContents: string[];
  groupPostTargetMode: "links" | "keyword";
  groupPostKeyword: string;
  groupPostLinks: string[];
  reactions: string[];
  groupMode: "links" | "keyword";
  groupLinks: string[];
  groupKeyword: string;
  refreshGroupPostLinks: boolean;
  groupComments: string[];
  groupCommentKeyword: string;
};

export type BotLog = {
  id: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  createdAt: string;
};

export type BotSnapshot = {
  running: boolean;
  paused: boolean;
  progress: number;
  currentPost: number;
  totalPosts: number;
  joinedGroups: number;
  groupPosts: number;
  pokes: number;
  activeWorkers: number;
  queuedWorkers: number;
  maxWorkers: number;
  nextQueuePosition: number | null;
  estimatedNextStartAt: string | null;
  activeAccountUserIds: string[];
  accountProgress: Record<string, { current: number; total: number; progress: number; running: boolean }>;
  startedAt: string | null;
  finishedAt: string | null;
  account: { name: string; userId: string } | null;
  logs: BotLog[];
};

type BotState = BotSnapshot & {
  stopRequested: boolean;
  driver?: WebDriver;
  activeDrivers: Set<WebDriver>;
  completedTasks: number;
  nextLogId: number;
  runToken: number;
  earlyReleasedWorkerSlots: number;
  delayLogId: number | null;
};
type BotStatusListener = (status: BotSnapshot) => void;

type ReactablePost = {
  button: WebElement;
  key: string;
  postId: string | null;
  groupId: string | null;
  url: string | null;
};

type BotTask = "react" | "comment" | "group" | "groupComment" | "groupPost" | "pokes";
type PersistedJob = {
  config: BotConfig;
  tasksByAccount: BotTask[][];
  completedByAccount: number[];
  status: "running" | "paused";
  startedAt: string;
};
type PersistedLog = {
  ownerId: number;
  accountUserId: string | null;
  level: BotLog["level"];
  message: string;
};
type WorkerLogContext = {
  accountUserId: string;
  accountName: string;
  delayLogId: number | null;
};
type JoinCandidate = {
  element: WebElement;
  label: string;
  groupName?: string;
  groupUrl?: string;
  top: number;
};

const globalForBot = globalThis as typeof globalThis & {
  facebookAutoBots?: Map<number, BotState>;
  facebookAutoBotListeners?: Map<number, Set<BotStatusListener>>;
  facebookAutoWorkerSemaphore?: { active: number; max: number; observedActive: number; queue: Array<() => void> };
  facebookAutoJobs?: Map<number, PersistedJob>;
  facebookAutoResumeBootstrapPromise?: Promise<void>;
};

const accountContext = new AsyncLocalStorage<number>();
const ownerContext = new AsyncLocalStorage<number>();
const workerLogContext = new AsyncLocalStorage<WorkerLogContext>();
const resumeCheckedOwners = new Set<number>();
let jobWriteQueue = Promise.resolve();
let logWriteQueue = Promise.resolve();

function getSemaphore() {
  if (!globalForBot.facebookAutoWorkerSemaphore) {
    globalForBot.facebookAutoWorkerSemaphore = { active: 0, max: 5, observedActive: 0, queue: [] };
  }

  globalForBot.facebookAutoWorkerSemaphore.observedActive ??= 0;
  return globalForBot.facebookAutoWorkerSemaphore;
}

async function syncWorkerSemaphoreMax() {
  const maxWorkers = await getFacebookAutoMaxWorkers();
  getSemaphore().max = maxWorkers;
  return maxWorkers;
}

async function syncObservedRunningJobs() {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT COUNT(*) AS total FROM facebook_auto_jobs WHERE status = 'running'"
    );
    const total = Number((rows as Array<{ total: number }>)[0]?.total || 0);
    getSemaphore().observedActive = Number.isFinite(total) ? total : 0;
  } catch {
    getSemaphore().observedActive = 0;
  }
}

async function syncWorkerSemaphoreRuntime() {
  const maxWorkers = await syncWorkerSemaphoreMax();
  await syncObservedRunningJobs();
  return maxWorkers;
}

function notifyAllStatuses() {
  const listenerMap = globalForBot.facebookAutoBotListeners;
  if (!listenerMap) return;

  for (const [ownerId, listeners] of listenerMap) {
    const status = snapshot(ownerId);
    for (const listener of listeners) {
      listener(status);
    }
  }
}

async function acquireWorkerSlot() {
  const semaphore = getSemaphore();
  if (semaphore.active < semaphore.max) {
    semaphore.active += 1;
    notifyAllStatuses();
    return;
  }

  await new Promise<void>((resolve) => {
    semaphore.queue.push(() => {
      semaphore.active += 1;
      notifyAllStatuses();
      resolve();
    });
  });
}

function releaseWorkerSlot() {
  const semaphore = getSemaphore();
  semaphore.active = Math.max(semaphore.active - 1, 0);
  notifyAllStatuses();
  const next = semaphore.queue.shift();
  if (next) {
    next();
  }
}

function releaseWorkerSlotsNow(count: number) {
  if (count <= 0) return;
  const semaphore = getSemaphore();
  semaphore.active = Math.max(semaphore.active - count, 0);
  notifyAllStatuses();
  while (semaphore.active < semaphore.max) {
    const next = semaphore.queue.shift();
    if (!next) break;
    next();
  }
}

function jobKey(ownerId: number) {
  return `owner:${ownerId}`;
}

function writeCurrentJob(ownerId: number, job: PersistedJob | null, finalStatus: "completed" | "stopped" = "completed") {
  const snapshot = job ? JSON.stringify(job) : null;
  jobWriteQueue = jobWriteQueue.then(async () => {
    await ensureFacebookAutoDatabase();
    await getFacebookAutoDatabase().execute(
      `INSERT INTO facebook_auto_jobs (job_key, status, job_json, started_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), job_json = VALUES(job_json),
         started_at = VALUES(started_at), updated_at = CURRENT_TIMESTAMP`,
      [jobKey(ownerId), job?.status ?? finalStatus, snapshot, job?.startedAt ? new Date(job.startedAt) : null]
    );
  }).catch((error) => console.error("Không thể lưu checkpoint Facebook Auto vào database:", error));
  return jobWriteQueue;
}

function clearCurrentJob(ownerId: number) {
  jobWriteQueue = jobWriteQueue.then(async () => {
    await ensureFacebookAutoDatabase();
    await getFacebookAutoDatabase().execute(
      "DELETE FROM facebook_auto_jobs WHERE job_key = ?",
      [jobKey(ownerId)]
    );
  }).catch((error) => console.error("Không thể xoá checkpoint Facebook Auto trong database:", error));
  return jobWriteQueue;
}

async function cancelBotAndClearResumeJob(ownerId: number, state: BotState) {
  state.stopRequested = true;
  state.paused = false;
  getJobs().delete(ownerId);
  await clearCurrentJob(ownerId);
  notifyStatus(ownerId);
}

async function readCurrentJob(ownerId: number) {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT status, job_json FROM facebook_auto_jobs WHERE job_key = ? LIMIT 1",
      [jobKey(ownerId)]
    );
    const row = (rows as Array<{ status: string; job_json: string | null }>)[0];
    if (!row?.job_json || (row.status !== "running" && row.status !== "paused")) return null;
    const value = JSON.parse(row.job_json) as Partial<PersistedJob>;
    if ((value.status !== "running" && value.status !== "paused") || !value.config || !Array.isArray(value.tasksByAccount) || !Array.isArray(value.completedByAccount)) return null;
    return value as PersistedJob;
  } catch {
    return null;
  }
}

async function readResumableJobOwnerIds() {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT job_key FROM facebook_auto_jobs WHERE status IN ('running', 'paused') AND job_json IS NOT NULL"
    );
    return (rows as Array<{ job_key: string }>)
      .map((row) => /^owner:(\d+)$/.exec(String(row.job_key || ""))?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (error) {
    console.error("Không thể đọc danh sách job Auto Facebook cần resume:", error);
    return [];
  }
}

const reactionXpaths: Record<string, string> = {
  "Thích": '//*[@aria-label="Thích"]/ancestor::div[1]',
  "Yêu thích": '//*[@aria-label="Yêu thích"]/ancestor::div[1]',
  "Thuong thuong": '//*[@aria-label="Thuong thuong"]/ancestor::div[1]',
  Haha: '//*[@aria-label="Haha"]/ancestor::div[1]',
  Wow: '//*[@aria-label="Wow"]/ancestor::div[1]',
  "Buồn": '//*[@aria-label="Buồn"]/ancestor::div[1]',
  "Phẫn nộ": '//*[@aria-label="Phẫn nộ"]/ancestor::div[1]'
};

const reactionLabels: Record<string, string[]> = {
  "Thích": ["Like", "Thích"],
  "Yêu thích": ["Love", "Yêu thích"],
  "Thuong thuong": ["Care", "Thuong thuong"],
  Haha: ["Haha"],
  Wow: ["Wow"],
  "Buồn": ["Sad", "Buồn"],
  "Phẫn nộ": ["Angry", "Phẫn nộ"]
};

function createInitialState(): BotState {
  return {
    running: false,
    paused: false,
    progress: 0,
    currentPost: 0,
    totalPosts: 0,
    joinedGroups: 0,
    groupPosts: 0,
    pokes: 0,
    activeWorkers: 0,
    queuedWorkers: 0,
    maxWorkers: 5,
    nextQueuePosition: null,
    estimatedNextStartAt: null,
    activeAccountUserIds: [],
    accountProgress: {},
    startedAt: null,
    finishedAt: null,
    account: null,
    logs: [],
    stopRequested: false,
    activeDrivers: new Set(),
    completedTasks: 0,
    nextLogId: 1,
    runToken: 0,
    earlyReleasedWorkerSlots: 0,
    delayLogId: null
  };
}

function getOwnerId(explicitOwnerId?: number) {
  return explicitOwnerId ?? ownerContext.getStore() ?? 0;
}

function getState(ownerId = getOwnerId()) {
  if (!globalForBot.facebookAutoBots) {
    globalForBot.facebookAutoBots = new Map();
  }

  if (!globalForBot.facebookAutoBots.has(ownerId)) {
    globalForBot.facebookAutoBots.set(ownerId, createInitialState());
  }

  const state = globalForBot.facebookAutoBots.get(ownerId)!;
  state.activeDrivers ??= new Set();
  state.completedTasks ??= state.currentPost ?? 0;
  state.runToken ??= 0;
  state.earlyReleasedWorkerSlots ??= 0;
  state.delayLogId ??= null;
  state.activeWorkers ??= 0;
  state.pokes ??= 0;
  state.queuedWorkers ??= 0;
  state.maxWorkers ??= 5;
  state.nextQueuePosition ??= null;
  state.estimatedNextStartAt ??= null;
  state.activeAccountUserIds ??= [];
  state.accountProgress ??= {};

  return state;
}

function getListeners(ownerId = getOwnerId()) {
  if (!globalForBot.facebookAutoBotListeners) {
    globalForBot.facebookAutoBotListeners = new Map();
  }

  if (!globalForBot.facebookAutoBotListeners.has(ownerId)) {
    globalForBot.facebookAutoBotListeners.set(ownerId, new Set());
  }

  return globalForBot.facebookAutoBotListeners.get(ownerId)!;
}

function getJobs() {
  if (!globalForBot.facebookAutoJobs) {
    globalForBot.facebookAutoJobs = new Map();
  }

  return globalForBot.facebookAutoJobs;
}

function getJob(ownerId = getOwnerId()) {
  return getJobs().get(ownerId) ?? null;
}

function notifyStatus(ownerId = getOwnerId()) {
  const status = snapshot(ownerId);
  for (const listener of getListeners(ownerId)) {
    listener(status);
  }
}

function resetState(config: BotConfig, maxWorkers = 5) {
  const state = getState();
  state.running = true;
  state.paused = false;
  state.progress = 0;
  state.currentPost = 0;
  state.totalPosts = config.totalPosts * Math.max(config.cookieList.length, 1);
  state.joinedGroups = 0;
  state.groupPosts = 0;
  state.pokes = 0;
  state.activeWorkers = 0;
  state.maxWorkers = maxWorkers;
  state.queuedWorkers = Math.max(config.cookieList.length - maxWorkers, 0);
  state.nextQueuePosition = state.queuedWorkers > 0 ? 1 : null;
  state.estimatedNextStartAt = null;
  state.activeAccountUserIds = [];
  state.accountProgress = {};
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.account = null;
  state.logs = [];
  state.stopRequested = false;
  state.completedTasks = 0;
  state.activeDrivers = new Set();
  state.nextLogId = 1;
  state.runToken += 1;
  state.earlyReleasedWorkerSlots = 0;
  state.delayLogId = null;
  state.driver = undefined;
  notifyStatus();
  return state;
}

function log(
  state: BotState,
  level: BotLog["level"],
  message: string,
  meta?: { ownerId?: number; accountUserId?: string | null; accountName?: string | null }
) {
  const ownerId = meta?.ownerId ?? ownerContext.getStore() ?? 0;
  const workerContext = workerLogContext.getStore();
  message = repairVietnameseLogText(cleanupVietnameseLogText(message));
  const accountName = (meta?.accountName ?? workerContext?.accountName ?? state.account?.name ?? "").trim();
  const accountUserId = (meta?.accountUserId ?? workerContext?.accountUserId ?? state.account?.userId ?? "").trim();
  const logLabel = accountName && accountName !== "Không rõ" ? accountName : accountUserId;
  const logPrefix = logLabel ? `${logLabel}: ` : "";
  const renderedMessage = `${logPrefix}${message}`;
  const persistedLog: PersistedLog | null = ownerId > 0 ? {
    ownerId,
    accountUserId: accountUserId || null,
    level,
    message: renderedMessage
  } : null;

  if (persistedLog) {
    logWriteQueue = logWriteQueue.then(async () => {
      await ensureFacebookAutoDatabase();
      await getFacebookAutoDatabase().execute(
        `INSERT INTO facebook_auto_logs (owner_id, account_user_id, level, message, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [persistedLog.ownerId, persistedLog.accountUserId, persistedLog.level, persistedLog.message]
      );
    }).catch((error) => console.error("Không thể lưu log Facebook Auto vào database:", error));
  }

  state.logs.push({
    id: state.nextLogId++,
    level,
    message: renderedMessage,
    createdAt: new Date().toISOString()
  });

  if (state.logs.length > 500) {
    state.logs.splice(0, state.logs.length - 500);
  }

  notifyStatus();
}

function addTransientLog(state: BotState, level: BotLog["level"], message: string) {
  const workerContext = workerLogContext.getStore();
  const accountName = (workerContext?.accountName ?? state.account?.name ?? "").trim();
  const accountUserId = (workerContext?.accountUserId ?? state.account?.userId ?? "").trim();
  const logLabel = accountName && accountName !== "Không rõ" ? accountName : accountUserId;
  const logPrefix = logLabel ? `${logLabel}: ` : "";
  const entry: BotLog = {
    id: state.nextLogId++,
    level,
    message: `${logPrefix}${repairVietnameseLogText(cleanupVietnameseLogText(message))}`,
    createdAt: new Date().toISOString()
  };
  state.logs.push(entry);
  if (state.logs.length > 500) {
    state.logs.splice(0, state.logs.length - 500);
  }
  notifyStatus();
  return entry.id;
}

function updateTransientLog(state: BotState, logId: number, level: BotLog["level"], message: string) {
  const entry = state.logs.find((item) => item.id === logId);
  if (!entry) return;
  const workerContext = workerLogContext.getStore();
  const accountName = (workerContext?.accountName ?? state.account?.name ?? "").trim();
  const accountUserId = (workerContext?.accountUserId ?? state.account?.userId ?? "").trim();
  const logLabel = accountName && accountName !== "Không rõ" ? accountName : accountUserId;
  const logPrefix = logLabel ? `${logLabel}: ` : "";
  entry.level = level;
  entry.message = `${logPrefix}${repairVietnameseLogText(cleanupVietnameseLogText(message))}`;
  notifyStatus();
}

function removeTransientLog(state: BotState, logId: number) {
  const index = state.logs.findIndex((item) => item.id === logId);
  if (index < 0) return;
  state.logs.splice(index, 1);
  notifyStatus();
}

export function addFacebookAutoLog(
  message: string,
  level: BotLog["level"] = "info",
  meta?: { ownerId?: number; accountUserId?: string | null; accountName?: string | null }
) {
  if (meta?.ownerId && meta.ownerId > 0) {
    log(getState(meta.ownerId), level, message, meta);
    return;
  }

  log(getState(), level, message, meta);
}

export function clearFacebookAutoLogs(ownerId?: number) {
  const state = getState(ownerId);
  state.logs = [];
  state.nextLogId = 1;
  notifyStatus(ownerId);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countdownDelay(state: BotState, seconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds <= 0 || state.stopRequested) return;
  const workerContext = workerLogContext.getStore();
  const currentDelayLogId = workerContext ? workerContext.delayLogId : state.delayLogId;
  if (currentDelayLogId !== null) {
    removeTransientLog(state, currentDelayLogId);
    if (workerContext) workerContext.delayLogId = null;
    else state.delayLogId = null;
  }
  const logId = addTransientLog(state, "info", `Đang đợi ${totalSeconds}s`);
  if (workerContext) workerContext.delayLogId = logId;
  else state.delayLogId = logId;
  try {
    for (let remaining = totalSeconds; remaining > 0 && !state.stopRequested; remaining -= 1) {
      updateTransientLog(state, logId, "info", `Đang đợi ${remaining}s`);
      await sleep(1000);
    }
  } finally {
    removeTransientLog(state, logId);
    if (workerContext?.delayLogId === logId) {
      workerContext.delayLogId = null;
    } else if (!workerContext && state.delayLogId === logId) {
      state.delayLogId = null;
    }
  }
}

function sleepRandom(minMs: number, maxMs: number) {
  const lower = Math.min(minMs, maxMs);
  const upper = Math.max(minMs, maxMs);
  const delayMs = lower + Math.floor(Math.random() * (upper - lower + 1));
  return sleep(delayMs);
}

async function removeTempDirBestEffort(dir: string) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (!/EBUSY|ENOTEMPTY|EPERM|resource busy|locked/i.test(message) || attempt === 5) {
        console.warn(`[facebook-auto] Không xóa được thư mục tạm Chrome ${dir}: ${message}`);
        return;
      }
      await sleep(350 * attempt);
    }
  }
}

function isCookieAttributeName(name: string) {
  return new Set([
    "domain",
    "path",
    "expires",
    "max-age",
    "secure",
    "httponly",
    "samesite",
    "priority",
    "sameparty",
    "partitioned"
  ]).has(name.toLowerCase());
}

function decodeCookieValue(value: string) {
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function parseFacebookCookieParts(cookie: string) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const equalsIndex = part.indexOf("=");
      if (equalsIndex <= 0) return null;
      const name = part.slice(0, equalsIndex).trim();
      const value = part.slice(equalsIndex + 1);
      if (!name || name.startsWith("$") || isCookieAttributeName(name)) return null;
      return { name, value: decodeCookieValue(value) };
    })
    .filter((item): item is { name: string; value: string } => Boolean(item));
}

async function loadFacebookCookieIntoDriver(
  driver: WebDriver,
  cookie: string,
  state?: BotState,
  options?: { initialDelayMs?: number; refreshDelayMs?: number }
) {
  await driver.get("https://www.facebook.com/");
  if ((options?.initialDelayMs ?? 2000) > 0) {
    await sleep(options?.initialDelayMs ?? 2000);
  }

  for (const part of parseFacebookCookieParts(cookie)) {
    try {
      await driver.manage().addCookie({
        name: part.name,
        value: part.value,
        domain: ".facebook.com",
        path: "/"
      });
    } catch {
      try {
        await driver.manage().addCookie({
          name: part.name,
          value: part.value,
          path: "/"
        });
      } catch {
        if (state) {
          log(state, "warn", `Không thêm được cookie: ${part.name}`);
        }
      }
    }
  }
}

function executeBrowserScript<T>(driver: WebDriver, script: string, ...args: unknown[]) {
  const wrapped = `return (function () {\n${script}\n}).apply(null, arguments);`;
  return driver.executeScript(wrapped, ...args) as Promise<T>;
}

async function waitWhilePaused(state: BotState) {
  while (state.paused && !state.stopRequested) {
    await sleep(250);
  }
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function sanitizeAutomationText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPostLogTarget(post: ReactablePost) {
  const raw = (post.url || post.key || "").replace(/\s+/g, " ").trim();
  const compacted = raw
    .replace(/\b(Facebook)(?:\s+\1\b){2,}/gi, "$1")
    .replace(/^(?:Facebook\s+)+/i, "")
    .replace(/\b([^\s]{2,})(?:\s+\1\b){3,}/gi, "$1");

  if (compacted.length <= 140) return compacted;
  return `${compacted.slice(0, 137).trim()}...`;
}

function isInvalidTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Invalid or unexpected token/i.test(message) || /javascript error/i.test(message);
}

function normalizeVietnameseLogText(value: string) {
  return repairVietnameseLogText(value);
}

function cleanupVietnameseLogText(value: string) {
  return repairVietnameseLogText(value);
}

function repairVietnameseLogText(value: string) {
  return value
    .replace(/^Lu.ng (\d+)\/(\d+) b.t d.u ch.y t. t.*c v. (\d+)\/(\d+)\.$/i, "Lu\u1ed3ng $1/$2 b\u1eaft \u0111\u1ea7u ch\u1ea1y t\u1eeb t\u00e1c v\u1ee5 $3/$4.")
    .replace(/^Lu.ng (\d+)\/(\d+) d. d.ng\.$/i, "Lu\u1ed3ng $1/$2 \u0111\u00e3 d\u1eebng.")
    .replace(/^Lu.ng (\d+)\/(\d+) d. ho.n t.t\.$/i, "Lu\u1ed3ng $1/$2 \u0111\u00e3 ho\u00e0n t\u1ea5t.")
    .replace(/^Lu.ng (\d+)\/(\d+):/i, "Lu\u1ed3ng $1/$2:")
    .replace(/^B.t d.u t.*c v. (\d+)\/(\d+): (.+)\.$/i, "B\u1eaft \u0111\u1ea7u t\u00e1c v\u1ee5 $1/$2: $3.")
    .replace(/^B. qua t.*c v. (\d+)\/(\d+) \((.+)\): (.+)$/i, "B\u1ecf qua t\u00e1c v\u1ee5 $1/$2 ($3): $4")
    .replace(/^Ho.n t.t t.*c v. (\d+)\.$/i, "Ho\u00e0n t\u1ea5t t\u00e1c v\u1ee5 $1.")
    .replace(/^Dang tim bai viet trong group theo keyword: (.+)$/i, "\u0110ang t\u00ecm b\u00e0i vi\u1ebft trong group theo keyword: $1")
    .replace(/^Dang comment feed cua tat ca group da tham gia\.$/i, "\u0110ang comment feed c\u1ee7a t\u1ea5t c\u1ea3 group \u0111\u00e3 tham gia.")
    .replace(/^Chua tim thay bai group phu hop, tai lai trang search \(lan (\d+)\/3\)\.$/i, "Ch\u01b0a t\u00ecm th\u1ea5y b\u00e0i group ph\u00f9 h\u1ee3p, t\u1ea3i l\u1ea1i trang search (l\u1ea7n $1/3).")
    .replace(/^Da chon bai group: (.+)$/i, "\u0110\u00e3 ch\u1ecdn b\u00e0i group: $1")
    .replace(/^Khong tim thay bai viet group phu hop de comment\.$/i, "Kh\u00f4ng t\u00ecm th\u1ea5y b\u00e0i vi\u1ebft group ph\u00f9 h\u1ee3p \u0111\u1ec3 comment.")
    .replace(/^Khong the comment bai viet group\.$/i, "Kh\u00f4ng th\u1ec3 comment b\u00e0i vi\u1ebft group.")
    .replace(/^L.i kh.ng x.c ..nh$/i, "L\u1ed7i kh\u00f4ng x\u00e1c \u0111\u1ecbnh")
    .replace(/^Bot g.p l.i kh.ng x.c ..nh\.$/i, "Bot g\u1eb7p l\u1ed7i kh\u00f4ng x\u00e1c \u0111\u1ecbnh.");
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildTasks(config: BotConfig): BotTask[] {
  const tasks: BotTask[] = [];

  if (config.enableReact) {
    tasks.push(...Array.from({ length: config.reactCount }, () => "react" as const));
  }

  if (config.enableComment) {
    tasks.push(...Array.from({ length: config.commentCount }, () => "comment" as const));
  }

  if (config.enableGroup) {
    tasks.push(...Array.from({ length: config.groupCount }, () => "group" as const));
  }

  if (config.enableGroupComment) {
    tasks.push(...Array.from({ length: config.groupCommentCount }, () => "groupComment" as const));
  }

  if (config.enableGroupPost) {
    tasks.push(...Array.from({ length: config.groupPostCount }, () => "groupPost" as const));
  }

  if (config.enablePokes) {
    tasks.push(...Array.from({ length: config.pokesCount }, () => "pokes" as const));
  }

  return config.randomizeTasks ? shuffleItems(tasks) : tasks;
}

function updateProgress(state: BotState, _completedTasks: number, _totalTasks: number) {
  state.completedTasks += 1;
  state.currentPost = state.completedTasks;
  state.progress = state.totalPosts > 0 ? Math.round((state.completedTasks / state.totalPosts) * 100) : 0;
  const accountIndex = accountContext.getStore();
  const ownerId = ownerContext.getStore();
  const currentAccount = getCurrentWorkerAccount(state);
  const job = ownerId !== undefined ? getJob(ownerId) : null;
  if (job && accountIndex !== undefined && ownerId !== undefined) {
    const nextCompleted = Math.min(
      (job.completedByAccount[accountIndex] ?? 0) + 1,
      job.tasksByAccount[accountIndex]?.length ?? 0
    );
    job.completedByAccount[accountIndex] = nextCompleted;
    if (currentAccount?.userId) {
      const total = job.tasksByAccount[accountIndex]?.length ?? _totalTasks;
      state.accountProgress[currentAccount.userId] = {
        current: nextCompleted,
        total,
        progress: total > 0 ? Math.round((nextCompleted / total) * 100) : 0,
        running: nextCompleted < total && !state.stopRequested
      };
    }
    void writeCurrentJob(ownerId, job);
  }
  notifyStatus();
}

function finishCurrentAccountProgress(state: BotState, totalTasks: number) {
  const accountIndex = accountContext.getStore();
  const ownerId = ownerContext.getStore();
  const currentAccount = getCurrentWorkerAccount(state);
  const job = ownerId !== undefined ? getJob(ownerId) : null;
  if (!job || accountIndex === undefined || ownerId === undefined) return;

  const currentCompleted = job.completedByAccount[accountIndex] ?? 0;
  const targetCompleted = job.tasksByAccount[accountIndex]?.length ?? totalTasks;
  if (targetCompleted > currentCompleted) {
    state.completedTasks += targetCompleted - currentCompleted;
    state.currentPost = state.completedTasks;
    state.progress = state.totalPosts > 0 ? Math.round((state.completedTasks / state.totalPosts) * 100) : 0;
  }
  job.completedByAccount[accountIndex] = targetCompleted;
  if (currentAccount?.userId) {
    state.accountProgress[currentAccount.userId] = {
      current: targetCompleted,
      total: targetCompleted,
      progress: 100,
      running: false
    };
  }
  void writeCurrentJob(ownerId, job);
  notifyStatus();
}

function getCurrentWorkerAccount(state: BotState) {
  const workerContext = workerLogContext.getStore();
  if (workerContext?.accountUserId) {
    return {
      name: workerContext.accountName || workerContext.accountUserId,
      userId: workerContext.accountUserId
    };
  }
  return state.account;
}

function normalizeFacebookGroupUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL group không hợp lệ.");
  }

  const allowedHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);
  if (!allowedHosts.has(parsed.hostname.toLowerCase()) || !parsed.pathname.toLowerCase().startsWith("/groups/")) {
    throw new Error("Chỉ chấp nhận URL group Facebook.");
  }

  return parsed.toString();
}

function cleanGroupPostCacheScope(scope = "all") {
  return scope.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "all";
}

async function loadCachedGroupPostLinks(userId: string, scope = "all") {
  try {
    await ensureFacebookAutoDatabase();
    const [rows] = await getFacebookAutoDatabase().execute(
      "SELECT links_json FROM facebook_auto_group_cache WHERE facebook_user_id = ? AND cache_scope = ? LIMIT 1",
      [userId, cleanGroupPostCacheScope(scope)]
    );
    const row = (rows as Array<{ links_json: string }>)[0];
    const links = row?.links_json ? JSON.parse(row.links_json) as unknown : [];
    return Array.isArray(links)
      ? links.filter((item): item is string => typeof item === "string").map(normalizeFacebookGroupUrl)
      : [];
  } catch {
    return [];
  }
}

async function saveCachedGroupPostLinks(userId: string, scope: string, links: string[]) {
  const uniqueLinks = [...new Set(links.map(normalizeFacebookGroupUrl))];
  await ensureFacebookAutoDatabase();
  await getFacebookAutoDatabase().execute(
    `INSERT INTO facebook_auto_group_cache (facebook_user_id, cache_scope, links_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE links_json = VALUES(links_json), updated_at = CURRENT_TIMESTAMP`,
    [userId, cleanGroupPostCacheScope(scope), JSON.stringify(uniqueLinks)]
  );
  return uniqueLinks;
}

function buildMyGroupsScanUrl(mode: "all" | "keyword", keyword: string) {
  if (mode === "all") {
    return "https://www.facebook.com/groups/joins/";
  }

  const cleanKeyword = keyword.trim();
  return `https://www.facebook.com/groups/search/groups?q=${encodeURIComponent(cleanKeyword)}&filters=eyJteV9ncm91cHM6MCI6IntcIm5hbWVcIjpcIm15X2dyb3Vwc1wiLFwiYXJnc1wiOlwiXCJ9In0%3D`;
}

function buildGroupPostsSearchUrl(keyword: string) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) {
    return "https://www.facebook.com/groups/feed/";
  }

  const filters = "eyJycF9hdXRob3I6MCI6IntcIm5hbWVcIjpcIm15X2dyb3Vwc19wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9IiwicmVjZW50X3Bvc3RzOjAiOiJ7XCJuYW1lXCI6XCJyZWNlbnRfcG9zdHNcIixcImFyZ3NcIjpcIlwifSJ9";
  return `https://www.facebook.com/groups/search/group_posts/?q=${encodeURIComponent(cleanKeyword)}&filters=${filters}`;
}

function getUrlPathname(rawUrl: string) {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return "";
  }
}

function configureSeleniumManager() {
  const binaryName = process.platform === "win32" ? "selenium-manager.exe" : "selenium-manager";
  const platformDir =
    process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
  const managerPath = path.join(
    process.cwd(),
    "node_modules",
    "selenium-webdriver",
    "bin",
    platformDir,
    binaryName
  );

  if (existsSync(managerPath)) {
    process.env.SE_MANAGER_PATH = managerPath;
  }
}

async function buildDriver(config: BotConfig) {
  configureSeleniumManager();

  const options = new chrome.Options();
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--disable-notifications");
  options.addArguments("--mute-audio");
  options.addArguments("--window-size=1280,900");
  options.addArguments("--log-level=3");
  options.excludeSwitches("enable-automation", "enable-logging");
  options.setUserPreferences({ credentials_enable_service: false });

  const tempDirs: string[] = [];
  const proxyCleanup = await applyChromeProxyOptions(options, config.proxy || "");
  if (proxyCleanup.extensionDir) tempDirs.push(proxyCleanup.extensionDir);

  if (config.headlessChrome && !proxyCleanup.requiresVisibleChrome) {
    options.addArguments("--headless=new");
  }

  if (config.lowResourceMode || await getFacebookAutoLowResourceMode()) {
    applyLowResourceChromeOptions(options);
  }

  const bundledChrome = path.join(process.cwd(), "chrome", "chrome.exe");
  if (process.platform === "win32" && existsSync(bundledChrome)) {
    options.setChromeBinaryPath(bundledChrome);
  }

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  attachChromeTempCleanup(driver, tempDirs, proxyCleanup.close);
  return driver;
}

function applyLowResourceChromeOptions(options: chrome.Options) {
  options.addArguments("--blink-settings=imagesEnabled=false");
  options.addArguments("--disable-background-networking");
  options.addArguments("--disable-background-timer-throttling");
  options.addArguments("--disable-client-side-phishing-detection");
  options.addArguments("--disable-default-apps");
  options.addArguments("--disable-features=Translate,MediaRouter,OptimizationHints,PreloadMediaEngagementData");
  options.addArguments("--disable-renderer-backgrounding");
  options.addArguments("--disable-sync");
  options.addArguments("--disable-translate");
  options.setUserPreferences({
    credentials_enable_service: false,
    "profile.default_content_setting_values.automatic_downloads": 2,
    "profile.default_content_setting_values.geolocation": 2,
    "profile.default_content_setting_values.images": 2,
    "profile.default_content_setting_values.media_stream": 2,
    "profile.default_content_setting_values.notifications": 2,
    "profile.default_content_setting_values.plugins": 2,
    "profile.default_content_setting_values.popups": 2
  });
}

type ChromeProxySettings = {
  server: string;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  extensionDir?: string;
};

type ChromeProxyCleanup = {
  extensionDir?: string;
  close?: () => Promise<void>;
  requiresVisibleChrome?: boolean;
};

function parseChromeProxy(proxy: string): ChromeProxySettings | null {
  const value = proxy.trim();
  if (!value) return null;
  const fallbackProtocol = "http";
  let protocol = fallbackProtocol;
  let host = "";
  let port = "";
  let username = "";
  let password = "";

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const protocolMatch = value.match(/^([a-z][a-z0-9+.-]*):\/\/(.+)$/i);
    protocol = (protocolMatch?.[1] || fallbackProtocol).toLowerCase();
    const rest = protocolMatch?.[2] || "";
    if (rest.includes("@")) {
      const parsed = new URL(value);
      host = parsed.hostname;
      port = parsed.port;
      username = decodeURIComponent(parsed.username || "");
      password = decodeURIComponent(parsed.password || "");
    } else {
      const parts = rest.split(":");
      if (parts.length >= 4) {
        [host, port, username] = parts;
        password = parts.slice(3).join(":");
      } else {
        [host, port] = parts;
      }
    }
  } else {
    const parts = value.split(":");
    if (parts.length >= 4) {
      [host, port, username] = parts;
      password = parts.slice(3).join(":");
    } else {
      [host, port] = parts;
    }
  }

  host = host.trim();
  port = port.trim();
  if (!host || !port) return null;
  if (!/^(https?|socks4|socks5)$/i.test(protocol)) protocol = fallbackProtocol;
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) return null;
  const server = `${protocol}://${host}:${port}`;
  return { server, protocol, host, port: numericPort, username: username.trim(), password: password.trim() };
}

function createChromeProxyAuthExtension(settings: ChromeProxySettings) {
  if (!settings.username || !settings.password) return "";
  const extensionDir = mkdtempSync(path.join(tmpdir(), "facebook-auto-proxy-auth-"));
  const manifest = {
    version: "1.0.0",
    manifest_version: 2,
    name: "Facebook Auto Proxy Auth",
    permissions: ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
    background: { scripts: ["background.js"] },
    minimum_chrome_version: "22.0.0"
  };
  const background = `
chrome.proxy.settings.set({
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: ${JSON.stringify(settings.protocol.replace(/^socks4$/i, "socks4").replace(/^socks5$/i, "socks5"))},
        host: ${JSON.stringify(settings.host)},
        port: ${JSON.stringify(settings.port)}
      },
      bypassList: ["localhost", "127.0.0.1"]
    }
  },
  scope: "regular"
});

chrome.webRequest.onAuthRequired.addListener(
  function(details) {
    return {
      authCredentials: {
        username: ${JSON.stringify(settings.username)},
        password: ${JSON.stringify(settings.password)}
      }
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
`;
  writeFileSync(path.join(extensionDir, "manifest.json"), JSON.stringify(manifest), "utf8");
  writeFileSync(path.join(extensionDir, "background.js"), background, "utf8");
  return extensionDir;
}

function connectViaUpstreamProxy(upstream: ChromeProxySettings, target: string) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(upstream.port, upstream.host);
    const auth = upstream.username || upstream.password
      ? Buffer.from(`${upstream.username || ""}:${upstream.password || ""}`).toString("base64")
      : "";
    let buffer = "";
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(30000, () => fail(new Error("Proxy bridge timeout.")));
    socket.once("error", fail);
    socket.once("connect", () => {
      const lines = [
        `CONNECT ${target} HTTP/1.1`,
        `Host: ${target}`,
        "Proxy-Connection: Keep-Alive",
      ];
      if (auth) lines.push(`Proxy-Authorization: Basic ${auth}`);
      lines.push("", "");
      socket.write(lines.join("\r\n"));
    });
    socket.on("data", function onData(chunk) {
      buffer += chunk.toString("latin1");
      if (!buffer.includes("\r\n\r\n")) return;
      socket.off("data", onData);
      const [headerText, rest] = buffer.split("\r\n\r\n");
      if (!/^HTTP\/1\.[01] 2\d\d\b/i.test(headerText)) {
        fail(new Error(`Upstream proxy refused CONNECT: ${headerText.split("\r\n")[0] || "unknown"}`));
        return;
      }
      socket.setTimeout(0);
      socket.removeListener("error", fail);
      if (rest) socket.unshift(Buffer.from(rest, "latin1"));
      resolve(socket);
    });
  });
}

async function startLocalProxyBridge(upstream: ChromeProxySettings) {
  if (!upstream.username || !upstream.password || !/^https?$/i.test(upstream.protocol)) return null;
  const server = createServer();
  const auth = Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");

  server.on("request", (req, res) => {
    const upstreamSocket = net.connect(upstream.port, upstream.host, () => {
      const headers = { ...req.headers, "proxy-authorization": `Basic ${auth}` };
      const headerLines = Object.entries(headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
      upstreamSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join("\r\n")}\r\n\r\n`);
      req.pipe(upstreamSocket);
    });
    upstreamSocket.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    upstreamSocket.pipe(res.socket!);
  });

  server.on("connect", (req, clientSocket, head) => {
    connectViaUpstreamProxy(upstream, req.url || "")
      .then((upstreamSocket) => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstreamSocket.write(head);
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      })
      .catch(() => {
        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        clientSocket.destroy();
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    return null;
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

async function applyChromeProxyOptions(options: chrome.Options, proxy: string): Promise<ChromeProxyCleanup> {
  const settings = parseChromeProxy(proxy);
  if (!settings) return {};
  const bridge = await startLocalProxyBridge(settings);
  if (bridge) {
    options.addArguments(`--proxy-server=${bridge.server}`);
    return { close: bridge.close };
  }
  const extensionDir = createChromeProxyAuthExtension(settings);
  if (extensionDir) {
    options.addArguments(`--load-extension=${extensionDir}`);
    options.addArguments(`--disable-extensions-except=${extensionDir}`);
    return { extensionDir, requiresVisibleChrome: true };
  } else {
    options.addArguments(`--proxy-server=${settings.server}`);
  }
  return {};
}

function attachChromeTempCleanup(driver: WebDriver, dirs: string[], closeProxy?: () => Promise<void>) {
  const originalQuit = driver.quit.bind(driver);
  driver.quit = async () => {
    try {
      return await originalQuit();
    } finally {
      await sleep(500);
      await closeProxy?.().catch(() => undefined);
      await Promise.all(dirs.filter(Boolean).map((dir) => removeTempDirBestEffort(dir)));
    }
  };
}

function maskProxyForLog(proxy: string) {
  const value = proxy.trim();
  if (!value) return "";
  const parsed = parseChromeProxy(value);
  if (!parsed) return value;
  if (!parsed.username) return parsed.server;
  return `${parsed.protocol}://${parsed.host}:${parsed.port}:${parsed.username}:***`;
}

function extractPublicIpFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate = parsed.ip || parsed.IP || parsed.query || parsed.address;
    if (candidate) return String(candidate).trim();
  } catch {
    // Some IP services return plain text instead of JSON.
  }
  return trimmed.match(/[0-9a-fA-F:.]{7,}/)?.[0] || "";
}

function samePublicIp(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function cleanIpInfoValue(value: unknown) {
  return String(value || "").trim();
}

function ipInfoTextFromPayload(payload: Record<string, unknown>, fallbackIp = "") {
  const city = cleanIpInfoValue(payload.city);
  const region = cleanIpInfoValue(payload.region_name || payload.region || payload.state || payload.province);
  const country = cleanIpInfoValue(payload.country_name || payload.country || payload.country_iso || payload.country_code);
  const timezone = cleanIpInfoValue(payload.time_zone || payload.timezone);
  return [city, region, country].filter(Boolean).join(", ") || timezone || fallbackIp;
}

async function fetchText(url: string, options: { proxyServer?: string; timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 12000;
  return new Promise<string>((resolve, reject) => {
    const target = new URL(url);
    const proxy = options.proxyServer ? new URL(options.proxyServer) : null;
    const isHttpsTarget = target.protocol === "https:";
    const transport = proxy ? httpRequest : isHttpsTarget ? httpsRequest : httpRequest;
    const requestOptions = proxy
      ? {
          protocol: proxy.protocol,
          hostname: proxy.hostname,
          port: proxy.port,
          method: "GET",
          path: url,
          headers: { Host: target.host, "User-Agent": "TechMax-FacebookAuto/1.0" }
        }
      : {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          method: "GET",
          path: `${target.pathname}${target.search}`,
          headers: { "User-Agent": "TechMax-FacebookAuto/1.0" }
        };
    const req = transport(requestOptions, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1024 * 64) {
          req.destroy(new Error("Phản hồi kiểm tra IP quá lớn."));
        }
      });
      res.on("end", () => resolve(body));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Timeout kiểm tra IP.")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchTextViaProxyConnect(url: string, proxy: ChromeProxySettings, timeoutMs = 12000) {
  const target = new URL(url);
  if (target.protocol !== "https:") {
    return fetchText(url, { proxyServer: proxy.server, timeoutMs });
  }

  const startedAt = Date.now();
  const targetPort = target.port || (target.protocol === "https:" ? "443" : "80");
  const proxySocket = await connectViaUpstreamProxy(proxy, `${target.hostname}:${targetPort}`);
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let raw = "";
    const finish = (error?: Error, body = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      secureSocket.destroy();
      if (error) reject(error);
      else resolve(body);
    };
    const timer = setTimeout(
      () => finish(new Error("Timeout kiểm tra IP qua proxy.")),
      Math.max(1000, timeoutMs - (Date.now() - startedAt))
    );
    const secureSocket = tls.connect({
      socket: proxySocket,
      servername: target.hostname,
      rejectUnauthorized: true
    }, () => {
      secureSocket.write([
        `GET ${target.pathname}${target.search} HTTP/1.1`,
        `Host: ${target.host}`,
        "User-Agent: TechMax-FacebookAuto/1.0",
        "Accept: application/json,text/plain,*/*",
        "Connection: close",
        "",
        ""
      ].join("\r\n"));
    });
    secureSocket.setEncoding("utf8");
    secureSocket.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 64) {
        finish(new Error("Phản hồi kiểm tra IP qua proxy quá lớn."));
      }
    });
    secureSocket.on("end", () => {
      const [headerText, ...bodyParts] = raw.split("\r\n\r\n");
      const status = headerText.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/i)?.[1];
      if (status && Number(status) >= 400) {
        finish(new Error(`HTTP ${status}`));
        return;
      }
      finish(undefined, bodyParts.join("\r\n\r\n") || raw);
    });
    secureSocket.on("error", (error) => finish(error));
  });
}

const ipLocationCache = new Map<string, { location: string; expiresAt: number }>();

async function lookupIpLocation(ip: string) {
  const normalized = ip.trim();
  if (!normalized) return "";
  const cached = ipLocationCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.location;

  const targets = [
    `https://ipconfig.io/json?ip=${encodeURIComponent(normalized)}`,
    `https://ipwho.is/${encodeURIComponent(normalized)}`
  ];
  for (const target of targets) {
    try {
      const text = await fetchText(target, { timeoutMs: 8000 });
      const payload = JSON.parse(text) as Record<string, unknown>;
      const location = ipInfoTextFromPayload(payload, normalized);
      if (location) {
        ipLocationCache.set(normalized, { location, expiresAt: Date.now() + 10 * 60 * 1000 });
        return location;
      }
    } catch {
      // Try the next lookup service.
    }
  }
  return "";
}

let directPublicIpCache: { ip: string; expiresAt: number } | null = null;

async function getDirectPublicIp() {
  if (directPublicIpCache && directPublicIpCache.expiresAt > Date.now()) {
    return directPublicIpCache.ip;
  }
  const targets = [
    "https://ipconfig.io/json",
    "https://api.ipify.org?format=json",
    "https://ifconfig.co/json"
  ];
  for (const target of targets) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(target, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      const ip = extractPublicIpFromText(await response.text());
      if (ip) {
        directPublicIpCache = { ip, expiresAt: Date.now() + 5 * 60 * 1000 };
        return ip;
      }
    } catch {
      // Try the next service.
    }
  }
  return "";
}

async function getProxyPublicIp(proxy: string) {
  const settings = parseChromeProxy(proxy);
  if (!settings) return { ip: "", error: "Proxy không hợp lệ." };
  if (!/^https?$/i.test(settings.protocol)) {
    return { ip: "", error: "Chưa hỗ trợ xác nhận IP backend cho SOCKS proxy." };
  }

  const targets = [
    "https://ipconfig.io/json",
    "https://api.ipify.org?format=json",
    "https://ifconfig.co/json"
  ];
  let lastError = "";
  for (const target of targets) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const text = await fetchTextViaProxyConnect(target, settings, 15000);
        const ip = extractPublicIpFromText(text);
        if (ip) return { ip, source: new URL(target).hostname };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Không kiểm tra được IP proxy.";
        await sleep(400 * attempt);
      }
    }
  }
  return { ip: "", error: lastError || "Không đọc được IP proxy." };
}

async function checkChromeProxyUsage(driver: WebDriver, proxy: string) {
  const startedAt = Date.now();
  const previousTimeouts = await driver.manage().getTimeouts().catch(() => null);
  try {
    await driver.manage().setTimeouts({ pageLoad: 15000, script: 15000, implicit: 0 });
    const targets = ["https://ipconfig.io/json"];
    let ip = "";
    let source = "";
    let lastError = "";
    for (const target of targets) {
      try {
        await driver.get(target);
        const bodyText = String(await driver.executeScript("return document.body ? document.body.innerText : ''")).trim();
        ip = extractPublicIpFromText(bodyText);
        source = new URL(target).hostname;
        if (ip) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Không đọc được IP.";
      }
    }
    if (!ip) throw new Error(lastError || "Không đọc được IP từ trang kiểm tra.");
    const [directIp, proxyIpResult] = await Promise.all([
      getDirectPublicIp(),
      getProxyPublicIp(proxy)
    ]);
    const proxyIp = proxyIpResult.ip || "";
    const verifiedExactProxy = samePublicIp(ip, proxyIp);
    const bypassedProxy = Boolean(directIp && samePublicIp(ip, directIp));
    const verifiedProxy = verifiedExactProxy;
    const proxyLocation = await lookupIpLocation(proxyIp || ip);
    return {
      ok: Boolean(ip),
      ip,
      directIp,
      proxyIp,
      proxyLocation,
      proxyIpError: proxyIpResult.error || "",
      verifiedExactProxy,
      bypassedProxy,
      verifiedProxy,
      source,
      latencyMs: Date.now() - startedAt,
      proxy: maskProxyForLog(proxy)
    };
  } catch (error) {
    return {
      ok: false,
      ip: "",
      latencyMs: Date.now() - startedAt,
      proxy: maskProxyForLog(proxy),
      error: error instanceof Error ? error.message : "Không kiểm tra được proxy."
    };
  } finally {
    if (previousTimeouts) {
      await driver.manage().setTimeouts(previousTimeouts).catch(() => undefined);
    }
  }
}

type ChromeProxyCheckResult = Awaited<ReturnType<typeof checkChromeProxyUsage>>;

function proxyCheckLogLevel(result: ChromeProxyCheckResult): BotLog["level"] {
  if (!result.ok) return "error";
  if (result.verifiedExactProxy) return "success";
  return "warn";
}

function formatProxyCheckMessage(prefix: string, result: ChromeProxyCheckResult) {
  if (!result.ok) {
    return `${prefix} proxy lỗi: ${result.proxy} - ping ${result.latencyMs}ms - ${result.error || "Không kết nối được."}`;
  }

  const details = [
    `${prefix}: ${result.proxy}`,
    `IP Chrome ${result.ip}`,
    result.proxyIp ? `IP proxy ${result.proxyIp}` : "",
    result.proxyLocation ? `Vị trí proxy ${result.proxyLocation}` : "",
    result.directIp ? `IP máy chủ ${result.directIp}` : "",
    `ping ${result.latencyMs}ms`
  ].filter(Boolean).join(" - ");

  if (result.verifiedExactProxy) {
    return `${details} - IP ipconfig.io trùng IP proxy, xác nhận Chrome đang dùng proxy.`;
  }
  if (result.bypassedProxy) {
    return `${details} - cảnh báo: IP Chrome trùng IP máy chủ, Chrome chưa dùng proxy.`;
  }
  if (result.proxyIp) {
    return `${details} - cảnh báo: IP ipconfig.io của Chrome không trùng IP proxy, chưa duyệt là đã dùng proxy.`;
  }
  return `${details}${result.proxyIpError ? ` - không kiểm tra được IP proxy qua ipconfig.io (${result.proxyIpError})` : ""} - chưa duyệt là đã dùng proxy.`;
}

async function getFacebookUserInfo(cookie: string) {
  const userId = cookie.match(/c_user=(\d+)/)?.[1];
  if (!userId) {
    throw new Error("Không tìm thấy c_user trong cookie.");
  }

  const response = await fetch("https://www.facebook.com/me", {
    headers: {
      cookie,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    cache: "no-store"
  });

  const html = await response.text();
  const session = inspectFacebookHtml(response.url || "https://www.facebook.com/me", html);
  return { name: session.facebookName, userId };
}

function inspectFacebookHtml(currentUrl: string, html: string): FacebookSessionInspection {
  const lowerUrl = currentUrl.toLowerCase();
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim() || "";
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || "";
  const profileName = extractFacebookProfileNameFromHtml(html);
  const candidate = [profileName, ogTitle, title]
    .map((value) => value.replace(/\s*\|\s*Facebook\s*$/i, "").trim())
    .find((value) => isKnownFacebookName(value)) || "Không rõ";
  const checkpointCode = lowerUrl.match(/checkpoint\/(\d+)/i)?.[1] ?? null;
  if (checkpointCode || lowerUrl.includes("checkpoint") || /security check|kiểm tra bảo mật|checkpoint/i.test(title)) {
    return { facebookName: "Không rõ", status: "checkpoint", checkpointCode: checkpointCode ? `Checkpoint${checkpointCode.slice(-3).padStart(3, "0")}` : null };
  }

  const hasLoginWall =
    /log in|đăng nhập|create new account|tạo tài khoản/i.test(title) ||
    /\/login|\/recover|\/checkpoint/i.test(lowerUrl);
  if (hasLoginWall) {
    return { facebookName: "Không rõ", status: "invalid", checkpointCode: null };
  }

  if (candidate !== "Không rõ") {
    return { facebookName: candidate, status: "active", checkpointCode: null };
  }

  if (lowerUrl.includes("/me") || lowerUrl.includes("profile.php")) {
    return { facebookName: "Không rõ", status: "active", checkpointCode: null };
  }

  return { facebookName: "Không rõ", status: "unknown", checkpointCode: null };
}

type FacebookSessionInspection = {
  status: "active" | "checkpoint" | "invalid" | "unknown";
  facebookName: string;
  checkpointCode: string | null;
};

function decodeFacebookJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/\r?\n/g, "\\n")}"`);
  } catch {
    return value.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\\//g, "/")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
}

function normalizeFacebookName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*Facebook\s*$/i, "")
    .replace(/\s*\([^)]{1,40}\)\s*$/i, "")
    .trim();
}

function extractFacebookProfileNameFromHtml(html: string) {
  const patterns = [
    /"profile_header_renderer"\s*:\s*\{[\s\S]{0,20000}?"user"\s*:\s*\{[\s\S]{0,5000}?"name"\s*:\s*"((?:\\.|[^"\\])+)"/i,
    /"header_top_row"\s*:\s*\{[\s\S]{0,20000}?"profile_user"\s*:\s*\{[\s\S]{0,5000}?"name"\s*:\s*"((?:\\.|[^"\\])+)"/i,
    /"profile_user"\s*:\s*\{[\s\S]{0,5000}?"name"\s*:\s*"((?:\\.|[^"\\])+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const name = match?.[1] ? normalizeFacebookName(decodeFacebookJsonString(match[1])) : "";
    if (isKnownFacebookName(name)) return name;
  }

  return "";
}

function extractFacebookCheckpointCode(url: string) {
  const match = url.match(/checkpoint\/(\d+)/i);
  if (!match) return null;
  return `Checkpoint${match[1].slice(-3).padStart(3, "0")}`;
}

async function inspectFacebookSession(driver: WebDriver): Promise<FacebookSessionInspection> {
  const currentUrl = (await driver.getCurrentUrl().catch(() => "")).toLowerCase();
  const pageSource = await driver.getPageSource().catch(() => "");
  return inspectFacebookHtml(currentUrl, pageSource || "");
}

async function assertFacebookCheckpoint(driver: WebDriver, ownerId?: number, userId?: string) {
  const session = await inspectFacebookSession(driver);
  if (session.status !== "checkpoint") {
    return session;
  }

  if (ownerId && userId) {
    await updateFacebookAutoAccountStatus(ownerId, userId, "checkpoint");
  }

  throw new Error(session.checkpointCode || "Checkpoint");
}

function isKnownFacebookName(name: string) {
  return Boolean(
    name
    && name !== "Không rõ"
    && !/^(facebook|error|log in|đăng nhập|đăng nhập facebook)$/i.test(name)
  );
}

async function addCookieString(driver: WebDriver, cookie: string, state: BotState) {
  await loadFacebookCookieIntoDriver(driver, cookie, state);
}

export async function inspectFacebookCookieWithChrome(cookie: string, userId: string, proxy = "") {
  configureSeleniumManager();
  const options = new chrome.Options();
  const tempProfileDir = mkdtempSync(path.join(tmpdir(), "facebook-auto-checklive-"));
  options.addArguments("--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage");
  options.addArguments("--window-size=1280,900", "--lang=vi-VN");
  options.addArguments(`--user-data-dir=${tempProfileDir}`);
  const tempDirs = [tempProfileDir];
  const proxyCleanup = await applyChromeProxyOptions(options, proxy);
  if (proxyCleanup.extensionDir) tempDirs.push(proxyCleanup.extensionDir);
  if (await getFacebookAutoHeadlessChrome() && !proxyCleanup.requiresVisibleChrome) {
    options.addArguments("--headless=new");
  }
  if (await getFacebookAutoLowResourceMode()) {
    applyLowResourceChromeOptions(options);
  }
  const bundledChrome = path.join(process.cwd(), "chrome", "chrome.exe");
  if (process.platform === "win32" && existsSync(bundledChrome)) options.setChromeBinaryPath(bundledChrome);

  let driver: WebDriver | undefined;
  try {
    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    attachChromeTempCleanup(driver, tempDirs, proxyCleanup.close);
    await driver.manage().setTimeouts({ pageLoad: 30000, script: 30000, implicit: 0 });
    if (proxy.trim()) {
      const ownerId = getOwnerId();
      const proxyCheck = await checkChromeProxyUsage(driver, proxy);
      addFacebookAutoLog(
        formatProxyCheckMessage("Check live dùng proxy", proxyCheck),
        proxyCheckLogLevel(proxyCheck),
        { ownerId, accountUserId: userId }
      );
    }
    await loadFacebookCookieIntoDriver(driver, cookie, undefined, { initialDelayMs: 500 });
    await driver.get("https://www.facebook.com/me?locale=vi_VN");
    await driver.wait(async () => {
      const url = (await driver!.getCurrentUrl().catch(() => "")).toLowerCase();
      const ready = await driver!.executeScript("return document.readyState === 'complete'").catch(() => false);
      const hasBody = await driver!.executeScript("return Boolean(document.body && document.body.innerText && document.body.innerText.trim().length > 0)").catch(() => false);
      return Boolean(ready && hasBody && (url.includes('/me') || url.includes('profile.php') || url.includes('checkpoint') || url.includes('login')));
    }, 8000).catch(() => undefined);
    const currentUrl = (await driver.getCurrentUrl()).toLowerCase();
    const isFacebookHomeOnly = /^https?:\/\/(www\.)?facebook\.com\/?(?:\?.*)?$/.test(currentUrl);

    if (isFacebookHomeOnly && !currentUrl.includes("/me") && !currentUrl.includes("profile.php")) {
      return { facebookName: "Không rõ", status: "invalid" as const };
    }

    const profile = await executeBrowserScript<{
      name: string;
      title: string;
      canonical: string;
      ogTitle: string;
      text: string;
      hasFriendsLink: boolean;
    }>(driver, `
      const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const fold = (value) => clean(value).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
      const normalize = (value) => clean(value)
        .replace(/\\s*\\|\\s*Facebook\\s*$/i, '')
        .replace(/\\s*\\([^)]{1,40}\\)\\s*$/i, '')
        .trim();
      const genericPatterns = [
        /^(facebook|profile|edit profile|add to story|see recommendations|friends?|following|followers?|about|posts?|photos?|videos?|reels?|more|settings|privacy|help|log in|đăng nhập|đăng xuất|tạo tài khoản)$/i,
        /^(add|edit|see|view|share|follow|message|send|more|story|profile|recommendations)(\\b|\\s)/i
      ];
      const genericFoldPatterns = [
        /^(facebook|profile|edit profile|add to story|see recommendations|friends?|following|followers?|about|posts?|photos?|videos?|reels?|more|settings|privacy|help|log in|dang nhap|dang xuat|tao tai khoan)$/i,
        /^(add|edit|see|view|share|follow|message|send|more|story|profile|recommendations|chia se|bang dieu khien|chinh sua|xem de xuat|hanh dong|nguoi theo doi|dang theo doi)(\\b|\\s)/i,
        /(add to story|edit profile|see recommendations|share a thought|profile picture actions|nguoi theo doi|dang theo doi|chi tiet neu bat|web designer|programmer|nguoi sang tao noi dung|dashboard|professional dashboard)/i
      ];
      const isLikelyName = (value) => {
        const text = normalize(value);
        const folded = fold(text);
        if (!text) return false;
        if (text.length < 2 || text.length > 80) return false;
        if (genericPatterns.some((pattern) => pattern.test(text))) return false;
        if (genericFoldPatterns.some((pattern) => pattern.test(folded))) return false;
        if (/^\\d+$/.test(text)) return false;
        if (/^[\\d\\s,.KMk]+$/.test(text)) return false;
        if (!/[\\p{L}]/u.test(text)) return false;
        return true;
      };
      const nameCandidates = [];
      const pushCandidate = (value) => {
        const candidate = normalize(value);
        if (isLikelyName(candidate) && !nameCandidates.includes(candidate)) {
          nameCandidates.push(candidate);
        }
      };
      const title = clean(document.title || '');
      const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
      const ogTitle = clean(document.querySelector('meta[property="og:title"]')?.content || '');
      const friendsLink = Array.from(document.querySelectorAll('a[href]')).find((link) => {
        const href = link.getAttribute('href') || '';
        return /friends_all/i.test(href) || /\\/friends\\/all/i.test(href);
      });

      let hasFriendsLink = Boolean(friendsLink);

      const actionNodes = Array.from(document.querySelectorAll('[aria-label], [role="button"], a[href]')).filter((node) => {
        const label = fold([
          node.getAttribute?.('aria-label') || '',
          node.textContent || '',
          node.getAttribute?.('href') || ''
        ].join(' '));
        return /(add to story|edit profile|see recommendations|profile picture actions|chinh sua|xem de xuat|hanh dong voi anh dai dien|stories\\/create|profile_edit)/i.test(label);
      });
      for (const actionNode of actionNodes) {
        const actionRect = actionNode.getBoundingClientRect?.() || { top: Number.POSITIVE_INFINITY };
        let scope = actionNode.parentElement;
        for (let hop = 0; hop < 10 && scope; hop += 1) {
          const nodes = Array.from(scope.querySelectorAll('[role="button"], h1, h2, h3, span[dir="auto"]'))
            .map((node) => {
              const rect = node.getBoundingClientRect?.() || { top: 0, width: 0, height: 0 };
              return {
                text: normalize(node.textContent || ''),
                top: rect.top,
                size: Number.parseFloat(getComputedStyle(node).fontSize || '0') || 0,
                width: rect.width,
                height: rect.height
              };
            })
            .filter((item) => item.top <= actionRect.top + 4)
            .filter((item) => item.width > 20 && item.height > 10)
            .filter((item) => isLikelyName(item.text))
            .sort((a, b) => b.size - a.size || b.width - a.width || b.top - a.top);
          if (nodes.length > 0) {
            pushCandidate(nodes[0].text);
            break;
          }
          scope = scope.parentElement;
        }
        if (nameCandidates.length > 0) break;
      }

      const socialLinks = Array.from(document.querySelectorAll('a[href]')).filter((link) => {
        const href = link.getAttribute('href') || '';
        const text = fold(link.textContent || '');
        return /\\/(followers|following|friends)(\\/|$)/i.test(href) || /(nguoi theo doi|dang theo doi|friends|followers|following)/i.test(text);
      });
      for (const socialLink of socialLinks) {
        let scope = socialLink.parentElement;
        for (let hop = 0; hop < 8 && scope; hop += 1) {
          const nodes = Array.from(scope.querySelectorAll('[role="button"], h1, h2, h3, span[dir="auto"], strong'))
            .map((node) => ({
              text: normalize(node.textContent || ''),
              top: node.getBoundingClientRect?.().top ?? 0,
              size: Number.parseFloat(getComputedStyle(node).fontSize || '0') || 0
            }))
            .filter((item) => isLikelyName(item.text))
            .sort((a, b) => b.size - a.size || a.top - b.top);
          if (nodes.length > 0) {
            pushCandidate(nodes[0].text);
            break;
          }
          scope = scope.parentElement;
        }
        if (nameCandidates.length > 0) break;
      }

      if (friendsLink) {
        let node = friendsLink;
        for (let hop = 0; hop < 6 && node; hop += 1) {
          const parent = node.parentElement;
          const previous = parent?.previousElementSibling;
          if (previous) {
            const button = previous.querySelector('[role="button"]');
            const beforeCount = nameCandidates.length;
            pushCandidate(button?.textContent || previous.textContent || '');
            if (nameCandidates.length > beforeCount) {
              break;
            }
          }
          node = parent;
        }
      }

      if (nameCandidates.length === 0) {
        const heading = document.querySelector('h1');
        pushCandidate(heading?.textContent || '');
      }

      if (nameCandidates.length === 0) {
        const profileButtons = Array.from(document.querySelectorAll('[role="button"], [role="link"], a[href], strong, h1, h2, h3'))
          .map((node) => normalize(node.textContent || ''))
          .filter((candidate) => isLikelyName(candidate))
          .filter((candidate) => !/^(add to story|edit profile|see recommendations)$/i.test(candidate))
          .filter((candidate) => !/^(chia se|bang dieu khien|chinh sua|xem de xuat)/i.test(fold(candidate)));
        if (profileButtons.length > 0) {
          pushCandidate(profileButtons[0]);
        }
      }

      if (nameCandidates.length === 0 && ogTitle) {
        pushCandidate(ogTitle);
      }

      return {
        name: nameCandidates[0] || '',
        title,
        canonical,
        ogTitle,
        text: (document.body?.innerText || '').slice(0, 4000),
        hasFriendsLink
      };
    `);
    const profileNameFromHtml = extractFacebookProfileNameFromHtml(await driver.getPageSource().catch(() => ""));

    const candidates = [
      profileNameFromHtml,
      profile.name,
      profile.ogTitle,
      profile.title,
      profile.canonical.match(/\/([^/?#]+)\/?$/)?.[1] || "",
    ]
      .map((value) => String(value || "")
        .replace(/\s*\|\s*Facebook\s*$/i, "")
        .replace(/\s*\([^)]{1,40}\)\s*$/i, "")
        .trim())
      .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);

    const hasCheckpoint = currentUrl.includes("checkpoint") || /security check|kiểm tra bảo mật|checkpoint/i.test(profile.text);
    const hasLoginWall = /log in|đăng nhập|create new account|tạo tài khoản/i.test(profile.title) || /log in|đăng nhập|tạo tài khoản/i.test(profile.text);
    const detectedName = candidates[0] || "Không rõ";
    const hasLoggedInSignals =
      currentUrl.includes("/me") ||
      currentUrl.includes("profile.php") ||
      profile.hasFriendsLink ||
      /logout|đăng xuất/i.test(profile.text) ||
      candidates.length > 0;

    if (hasCheckpoint) {
      return { facebookName: "Không rõ", status: "checkpoint" as const };
    }

    if (currentUrl.includes("/me") && detectedName !== "Không rõ") {
      return { facebookName: detectedName, status: "active" as const };
    }

    if (hasLoggedInSignals && !hasLoginWall) {
      return { facebookName: detectedName, status: "active" as const };
    }

    if (hasLoginWall) {
      return { facebookName: "Không rõ", status: "invalid" as const };
    }

    return { facebookName: detectedName, status: "unknown" as const };
  } catch {
    return { facebookName: "Không rõ", status: "invalid" as const };
  } finally {
    await driver?.quit().catch(() => undefined);
    if (!driver) {
      await proxyCleanup.close?.().catch(() => undefined);
      await Promise.all(tempDirs.map((dir) => removeTempDirBestEffort(dir)));
    }
  }
}

async function scrollUntilText(driver: WebDriver, text: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await driver.findElement(By.xpath(`//span[normalize-space(text())="${text}"]`));
    } catch {
      await driver.executeScript("window.scrollBy(0, 500)");
      await sleep(500);
    }
  }

  return null;
}

async function scrollPageSlowly(driver: WebDriver, fraction = 0.35, steps = 5, delayMs = 260) {
  const viewportHeight = await driver.executeScript<number>("return window.innerHeight || 900").catch(() => 900);
  const distance = Math.max(120, Math.floor(viewportHeight * fraction));
  const stepDistance = Math.max(80, Math.floor(distance / Math.max(1, steps)));

  for (let step = 0; step < steps; step += 1) {
    await driver.executeScript("window.scrollBy({ top: arguments[0], left: 0, behavior: 'smooth' });", stepDistance);
    await sleep(delayMs);
  }
}

async function findLikeButton(driver: WebDriver, timeoutMs = 20000) {
  const markerScript = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const pickClickableParent = (marker) => {
      let element = marker.closest('[role="button"], [tabindex="0"], a, button') || marker.parentElement;
      let hops = 0;

      while (element && hops < 6) {
        const rect = element.getBoundingClientRect();
        if (isVisible(element) && rect.width >= 18 && rect.height >= 18) {
          return element;
        }
        element = element.parentElement;
        hops += 1;
      }

      return marker.parentElement || marker;
    };

    const selectors = [
      '[data-ad-rendering-role="like_button"]',
      '[aria-label="Thích"]',
      '[aria-label="Like"]',
      '[aria-label*="Thích"]',
      '[aria-label*="Like"]'
    ];
    const candidates = [];

    for (const selector of selectors) {
      for (const marker of document.querySelectorAll(selector)) {
        const target = pickClickableParent(marker);
        if (!isVisible(target)) {
          continue;
        }

        const rect = target.getBoundingClientRect();
        const aria = target.getAttribute("aria-label") || marker.getAttribute("aria-label") || "";
        const role = target.getAttribute("role") || "";
        const text = (target.innerText || target.textContent || "").trim();
        const link = target.closest("a");
        let score = 0;

        if (role === "button" || target.tagName === "BUTTON") score += 60;
        if (target.tabIndex >= 0) score += 20;
        if (/^(Thích|Like)$/i.test(aria)) score += 50;
        if (/Thích|Like/i.test(text)) score += 25;
        if (selector.includes("data-ad-rendering-role")) score += 20;
        if (rect.width >= 24 && rect.width <= 260 && rect.height >= 20 && rect.height <= 80) score += 15;
        if (rect.top > window.innerHeight * 0.35) score += 10;
        if (link && /reaction|ufi/i.test(link.href)) score -= 35;
        if (/^\\d+$/.test(text)) score -= 25;

        candidates.push({ target, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]?.target || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }
    return best;
  `;
  const fallbackXpaths = [
    '//*[@data-ad-rendering-role="like_button"]/ancestor::*[@role="button"][1]',
    '//*[@data-ad-rendering-role="like_button"]/parent::*',
    '//*[@aria-label="Thích" or @aria-label="Like"]',
    '//span[normalize-space(text())="Thích"]/ancestor::*[@role="button"][1]',
    '//span[normalize-space(text())="Like"]/ancestor::*[@role="button"][1]'
  ];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const marker = await executeBrowserScript<WebElement | null>(driver, markerScript);
    if (marker) {
      return marker;
    }

    for (const xpath of fallbackXpaths) {
      const elements = await driver.findElements(By.xpath(xpath));
      if (elements.length > 0) {
        await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant', block:'center'});", elements[0]);
        return elements[0];
      }
    }

    await driver.executeScript("window.scrollBy(0, 500)");
    await sleep(500);
  }

  return null;
}

async function findNextReactablePost(
  driver: WebDriver,
  seenPosts: Set<string>,
  state: BotState,
  timeoutMs = 20000,
  scrollOptions?: {
    fraction?: number;
    steps?: number;
    delayMs?: number;
    settleMs?: number;
    scrollIntoViewBehavior?: "instant" | "smooth";
    requireCommentAction?: boolean;
  }
) {
  const scrollIntoViewBehavior = scrollOptions?.scrollIntoViewBehavior || "instant";
  const requireCommentAction = Boolean(scrollOptions?.requireCommentAction);
  const finderScript = `
    const seen = new Set(arguments[0] || []);
    const scrollIntoViewBehavior = arguments[1] || "instant";
    const requireCommentAction = Boolean(arguments[2]);
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const getClickable = (marker) => {
      let element = marker.closest('[role="button"], [tabindex="0"], button, a') || marker.parentElement;
      let hops = 0;

      while (element && hops < 8) {
        const rect = element.getBoundingClientRect();
        if (isVisible(element) && rect.width >= 18 && rect.height >= 18) {
          return element;
        }
        element = element.parentElement;
        hops += 1;
      }

      return marker;
    };

    const getPost = (element) => {
      const direct =
        element.closest('[role="article"]') ||
        element.closest('[aria-posinset]') ||
        element.closest('[data-pagelet*="FeedUnit"]') ||
        element.closest('[data-pagelet*="ProfileTimeline"]');
      if (direct) return direct;

      let current = element.parentElement;
      let best = null;
      let bestArea = 0;
      let hops = 0;
      while (current && hops < 14) {
        const rect = current.getBoundingClientRect();
        const text = (current.innerText || current.textContent || "").replace(/\\s+/g, " ").trim();
        const hasPostAction = Boolean(current.querySelector?.([
          '[data-ad-rendering-role="comment_button"]',
          '[aria-label="Leave a comment"]',
          '[aria-label="Comment"]',
          '[aria-label*="comment" i]',
          '[aria-label*="Bình luận"]',
          '[data-ad-rendering-role="like_button"]',
          '[aria-label="Thích"]',
          '[aria-label="Like"]'
        ].join(",")));
        const area = rect.width * rect.height;
        const isFeedShell = current.matches?.('[role="feed"], [role="main"], [aria-label="Search results"]');
        if (!isFeedShell && rect.width >= 300 && rect.height >= 90 && (text.length >= 12 || hasPostAction) && area > bestArea) {
          best = current;
          bestArea = area;
        }
        current = current.parentElement;
        hops += 1;
      }
      return best || element.closest('div');
    };

    const isPostLink = (href) => {
      try {
        const url = new URL(href, window.location.href);
        const host = url.hostname.toLowerCase().startsWith("www.") ? url.hostname.toLowerCase().slice(4) : url.hostname.toLowerCase();
        if (host !== "facebook.com") return false;
        const path = url.pathname.toLowerCase();
        const hasPostShape =
          path.includes("/photo") ||
          path.includes("/permalink") ||
          path.includes("/posts/") ||
          path.includes("/videos/") ||
          path.includes("/story.php") ||
          path === "/";
        const hasPostParams = url.searchParams.has("fbid") || url.searchParams.has("story_fbid");
        const isGroupPostPath = /^\\/groups\\/[^/]+\\/(?:posts|permalink)\\/[^/]+/i.test(path);
        return (hasPostShape && hasPostParams) || isGroupPostPath;
      } catch {
        return false;
      }
    };

    const getPostMetadata = (post, button) => {
      const links = [...(post?.querySelectorAll('a[href]') || [])];
      const scoredLinks = links
        .map((candidate) => {
          const href = candidate.href || "";
          let score = 0;
          if (!isPostLink(href)) return null;

          try {
            const url = new URL(href, window.location.href);
            const path = url.pathname.toLowerCase();
            const hasFbid = url.searchParams.has("fbid") || url.searchParams.has("story_fbid");
            const hasSet = url.searchParams.has("set");
            const text = (candidate.innerText || candidate.textContent || "").replace(/\s+/g, " ").trim();

            if (path.includes("/photo")) score += 100;
            if (/^\\/groups\\/[^/]+\\/(?:posts|permalink)\\//i.test(path)) score += 110;
            if (path.includes("/permalink")) score += 90;
            if (path.includes("/posts/")) score += 90;
            if (path.includes("/videos/")) score += 85;
            if (path.includes("/story.php")) score += 80;
            if (hasFbid) score += 60;
            if (hasSet) score += 20;
            if (candidate.querySelector('img')) score += 15;
            if (text.length > 0 && text.length < 80) score += 5;
            if (href.toLowerCase().includes("hashtag")) score -= 20;
            if (href.includes("__cft__") || href.includes("__tn__")) score -= 5;

            return { candidate, href, score };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      const link = scoredLinks[0]?.candidate || null;
      const href = link?.href || "";

      if (href) {
        try {
          const url = new URL(href, window.location.href);
          const path = url.pathname;
          const pathParts = path.split("/").filter(Boolean);
          const groupIndex = pathParts.findIndex((part) => part.toLowerCase() === "groups");
          const groupId = groupIndex >= 0 ? pathParts[groupIndex + 1] || null : null;
          const route = (pathParts[0] || "").toLowerCase();
          const groupPostRoute = groupIndex >= 0 ? (pathParts[groupIndex + 2] || "").toLowerCase() : "";
          const groupPostId = groupIndex >= 0 && (groupPostRoute === "posts" || groupPostRoute === "permalink")
            ? pathParts[groupIndex + 3] || null
            : null;
          const postIdFromPath = route === "posts" || route === "videos" || route === "permalink"
            ? pathParts[1] || null
            : null;
          const postId = url.searchParams.get("story_fbid") || url.searchParams.get("fbid") || groupPostId || postIdFromPath || null;
          const setId = url.searchParams.get("set") || "";
          ["__cft__", "__tn__", "comment_id"].forEach((name) => url.searchParams.delete(name));
          return {
            key: postId ? \`post:\${groupId ? groupId + ":" : ""}\${postId}\${setId ? ":" + setId : ""}\` : url.href,
            postId,
            groupId,
            url: url.href
          };
        } catch {
          // Fall through to the text-based key.
        }
      }

      const text = (post?.innerText || post?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
      const rect = post?.getBoundingClientRect?.() || button.getBoundingClientRect();
      const posinset = post?.getAttribute?.("aria-posinset") || "";
      return {
        key: posinset ? \`\${window.location.href}:pos:\${posinset}\` : (text || \`\${Math.round(window.scrollY + rect.top)}:\${Math.round(rect.left)}\`),
        postId: null,
        groupId: null,
        url: null
      };
    };

    const markers = [
      ...[...document.querySelectorAll('[aria-label="Thích"], [aria-label="Like"], [data-ad-rendering-role="like_button"]')]
        .map((marker) => ({ marker, kind: "like" })),
      ...[...document.querySelectorAll('[aria-label="Leave a comment"], [aria-label="Comment"], [aria-label*="comment" i], [aria-label*="Bình luận"], [data-ad-rendering-role="comment_button"]')]
        .map((marker) => ({ marker, kind: "comment" }))
    ];
    const candidates = [];

    for (const { marker, kind } of markers) {
      if (requireCommentAction && kind !== "comment") continue;
      const button = getClickable(marker);
      if (!isVisible(button)) continue;

      const rect = button.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

      const post = getPost(button);
      if (post?.dataset?.codexGroupCommented === "1") continue;
      const metadata = getPostMetadata(post, button);
      if (seen.has(metadata.key)) continue;

      const aria = button.getAttribute("aria-label") || marker.getAttribute("aria-label") || "";
      const text = (button.innerText || button.textContent || "").trim();
      const role = button.getAttribute("role") || "";
      const link = button.closest("a");
      let score = 0;

      if (/^(Thích|Like)$/i.test(aria)) score += 90;
      if (/^(Leave a comment|Comment|Bình luận)$/i.test(aria)) score += 90;
      if (role === "button" || button.tagName === "BUTTON") score += 50;
      if (/Thích|Like/i.test(text)) score += 30;
      if (/comment|bình luận|binh luan/i.test(aria + " " + text)) score += 35;
      if (marker.matches('[data-ad-rendering-role="like_button"]')) score += 15;
      if (marker.matches('[data-ad-rendering-role="comment_button"]')) score += 25;
      if (kind === "like") score += 20;
      if (rect.width >= 30 && rect.width <= 260 && rect.height >= 20 && rect.height <= 70) score += 15;
      if (rect.top > 80 && rect.bottom < window.innerHeight - 30) score += 20;
      if (link && /reaction|ufi/i.test(link.href)) score -= 60;
      if (/^\\d+$/.test(text) && kind !== "comment") score -= 50;

      candidates.push({ button, ...metadata, score, top: rect.top });
    }

    candidates.sort((a, b) => b.score - a.score || a.top - b.top);
    const best = candidates[0];
    if (!best) return null;

    best.button.scrollIntoView({ behavior: scrollIntoViewBehavior, block: "center", inline: "center" });
    return {
      button: best.button,
      key: best.key,
      postId: best.postId,
      groupId: best.groupId,
      url: best.url
    };
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && !state.stopRequested) {
    const result = await executeBrowserScript<ReactablePost | null>(
      driver,
      finderScript,
      [...seenPosts],
      scrollIntoViewBehavior,
      requireCommentAction
    );
    if (result?.button && result.key) {
      seenPosts.add(result.key);
      return result;
    }

    if (scrollOptions) {
      await scrollPageSlowly(driver, scrollOptions.fraction ?? 0.35, scrollOptions.steps ?? 5, scrollOptions.delayMs ?? 260);
      await sleep(scrollOptions.settleMs ?? 700);
    } else {
      await driver.executeScript("window.scrollBy(0, Math.floor(window.innerHeight * 0.75))");
      await sleep(650);
    }
  }

  return null;
}

async function markGroupCommentedPost(driver: WebDriver, post: ReactablePost) {
  await executeBrowserScript<boolean>(
    driver,
    `
    const button = arguments[0];
    const key = arguments[1];
    const findPostContainer = (element) => {
      const direct =
        element?.closest?.('[role="article"]') ||
        element?.closest?.('[aria-posinset]') ||
        element?.closest?.('[data-pagelet*="FeedUnit"]') ||
        element?.closest?.('[data-pagelet*="ProfileTimeline"]');
      if (direct) return direct;

      let current = element?.parentElement || null;
      let best = null;
      let bestArea = 0;
      let hops = 0;
      while (current && hops < 14) {
        const rect = current.getBoundingClientRect();
        const text = (current.innerText || current.textContent || "").replace(/\\s+/g, " ").trim();
        const hasPostAction = Boolean(current.querySelector?.('[data-ad-rendering-role="comment_button"], [aria-label="Leave a comment"], [aria-label="Comment"], [aria-label*="comment" i], [aria-label*="Bình luận"], [data-ad-rendering-role="like_button"], [aria-label="Thích"], [aria-label="Like"]'));
        const area = rect.width * rect.height;
        const isFeedShell = current.matches?.('[role="feed"], [role="main"], [aria-label="Search results"]');
        if (!isFeedShell && rect.width >= 300 && rect.height >= 90 && (text.length >= 12 || hasPostAction) && area > bestArea) {
          best = current;
          bestArea = area;
        }
        current = current.parentElement;
        hops += 1;
      }
      return best || element?.closest?.('div');
    };

    const post = findPostContainer(button);

    if (!post) return false;

    post.dataset.codexGroupCommented = "1";
    post.dataset.codexGroupCommentedKey = key || "";
    post.style.outline = "4px solid #22c55e";
    post.style.outlineOffset = "6px";
    post.style.boxShadow = "0 0 0 8px rgba(34, 197, 94, 0.18), 0 18px 45px rgba(15, 23, 42, 0.18)";
    post.style.backgroundColor = "rgba(34, 197, 94, 0.08)";
    post.style.borderRadius = "12px";
    post.style.transition = "outline 160ms ease, box-shadow 160ms ease, background-color 160ms ease";
    return true;
    `,
    post.button,
    post.key
  ).catch(() => false);
}

async function highlightPostContainer(driver: WebDriver, anchor: WebElement, color = "#0ea5e9") {
  await executeBrowserScript<boolean>(
    driver,
    `
    const anchor = arguments[0];
    const color = arguments[1];
    const findPostContainer = (element) => {
      const direct =
        element?.closest?.('[role="article"]') ||
        element?.closest?.('[aria-posinset]') ||
        element?.closest?.('[data-pagelet*="FeedUnit"]') ||
        element?.closest?.('[data-pagelet*="ProfileTimeline"]');
      if (direct) return direct;

      let current = element?.parentElement || null;
      let best = null;
      let bestArea = 0;
      let hops = 0;
      while (current && hops < 14) {
        const rect = current.getBoundingClientRect();
        const text = (current.innerText || current.textContent || "").replace(/\\s+/g, " ").trim();
        const hasPostAction = Boolean(current.querySelector?.('[data-ad-rendering-role="comment_button"], [aria-label="Leave a comment"], [aria-label="Comment"], [aria-label*="comment" i], [aria-label*="Bình luận"], [data-ad-rendering-role="like_button"], [aria-label="Thích"], [aria-label="Like"]'));
        const area = rect.width * rect.height;
        const isFeedShell = current.matches?.('[role="feed"], [role="main"], [aria-label="Search results"]');
        if (!isFeedShell && rect.width >= 300 && rect.height >= 90 && (text.length >= 12 || hasPostAction) && area > bestArea) {
          best = current;
          bestArea = area;
        }
        current = current.parentElement;
        hops += 1;
      }
      return best || element?.closest?.('div');
    };

    const post = findPostContainer(anchor);

    if (!post) return false;

    post.dataset.codexPostHighlighted = "1";
    post.style.outline = \`4px solid \${color}\`;
    post.style.outlineOffset = "6px";
    post.style.boxShadow = \`0 0 0 8px \${color}30, 0 18px 45px rgba(15, 23, 42, 0.18)\`;
    post.style.backgroundColor = \`\${color}14\`;
    post.style.borderRadius = "12px";
    post.style.transition = "outline 160ms ease, box-shadow 160ms ease, background-color 160ms ease";
    post.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    return true;
    `,
    anchor,
    color
  ).catch(() => false);
}

async function findNextReactablePostWithReload(
  driver: WebDriver,
  seenPosts: Set<string>,
  state: BotState,
  maxAttempts = 3,
  scrollOptions?: Parameters<typeof findNextReactablePost>[4]
) {
  for (let attempt = 1; attempt <= maxAttempts && !state.stopRequested; attempt++) {
    const currentUrl = await driver.getCurrentUrl().catch(() => "");
    const currentPath = getUrlPathname(currentUrl);
    const isFeedPage = currentPath === "/" || currentPath === "";

    if (!isFeedPage) {
      await driver.get("https://www.facebook.com/");
      await assertFacebookCheckpoint(driver);
      await sleep(2000);
    } else if (attempt > 1) {
      await driver.navigate().refresh();
      await assertFacebookCheckpoint(driver);
      await sleep(2500);
    }

    if (attempt > 1) {
      log(state, "info", `Không tìm thấy bài phù hợp, tải lại Facebook để tìm tiếp (lần ${attempt}/${maxAttempts}).`);
    }

    const post = await findNextReactablePost(driver, seenPosts, state, 20000, scrollOptions);
    if (post) {
      return post;
    }
  }

  return null;
}

async function findNextGroupReactablePostWithReload(
  driver: WebDriver,
  seenPosts: Set<string>,
  state: BotState,
  groupUrl: string,
  maxAttempts = 3
): Promise<ReactablePost | null> {
  for (let attempt = 1; attempt <= maxAttempts && !state.stopRequested; attempt++) {
    if (attempt > 1) {
      log(state, "info", `Không tìm thấy bài phù hợp trong group, tải lại để tìm tiếp (lần ${attempt}/${maxAttempts}).`);
      await driver.get(groupUrl);
      await assertFacebookCheckpoint(driver);
      await sleep(2500);
    }

    const post = await findNextReactablePost(driver, seenPosts, state, 15000);
    if (post) {
      return post;
    }
  }

  return null;
}

function cleanFacebookPostLink(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(host)) return null;

    const path = parsed.pathname.toLowerCase();
    const hasPostPath =
      path.includes("/photo") ||
      path.includes("/permalink") ||
      path.includes("/posts/") ||
      path.includes("/videos/") ||
      path.includes("/story.php") ||
      path === "/";
    const hasPostParams = parsed.searchParams.get("fbid") || parsed.searchParams.get("story_fbid");
    if (!hasPostPath || !hasPostParams) return null;

    ["__cft__", "__tn__", "comment_id"].forEach((name) => parsed.searchParams.delete(name));
    return parsed.toString();
  } catch {
    return null;
  }
}

async function findPost(driver: WebDriver, seenPosts: Set<string>, state: BotState, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && !state.stopRequested) {
    const elements = await driver.findElements(
      By.xpath(
        '//a[contains(@href, "facebook.com/") and (contains(@href, "fbid=") or contains(@href, "story_fbid=") or contains(@href, "/photo") or contains(@href, "/permalink") or contains(@href, "/posts/") or contains(@href, "/videos/") or contains(@href, "story.php"))]'
      )
    );

    for (const element of elements) {
      const href = await element.getAttribute("href");
      const postLink = href ? cleanFacebookPostLink(href) : null;
      if (postLink && !seenPosts.has(postLink)) {
        seenPosts.add(postLink);
        await driver.get(postLink);
        await assertFacebookCheckpoint(driver);
        log(state, "info", `Tương tác với bài viết: ${postLink}`);
        return postLink;
      }
    }

    await driver.executeScript("window.scrollBy(0, 500)");
    await sleep(500);
  }

  return null;
}

async function clickElement(driver: WebDriver, element: WebElement) {
  try {
    await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant', block:'center', inline:'center'});", element);
    await sleep(150);
    await element.click();
  } catch {
    try {
      await driver.actions({ async: true }).move({ origin: element }).click().perform();
    } catch {
      await driver.executeScript(`
        const element = arguments[0];
        element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const target = document.elementFromPoint(x, y) || element;
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
          }));
        }
      `, element);
    }
  }
}

async function pokeFriendTask(driver: WebDriver, state: BotState) {
  const currentUrl = await driver.getCurrentUrl().catch(() => "");
  const currentPath = getUrlPathname(currentUrl);
  if (currentPath !== "/pokes") {
    log(state, "info", "Đang mở danh sách chọc bạn bè.");
    await driver.get("https://www.facebook.com/pokes");
    await assertFacebookCheckpoint(driver);
    await sleep(2500);
  } else {
    log(state, "info", "Tiếp tục tìm nút Chọc trên danh sách hiện tại.");
  }

  for (let attempt = 0; attempt < 24 && !state.stopRequested; attempt++) {
    const result = await executeBrowserScript<{
      clicked: boolean;
      label: string;
      name: string;
      disabledCount: number;
      bottom: boolean;
    }>(driver, `
      const labels = new Set(["Chọc", "Chọc lại", "Poke", "Poke Back"]);
      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
      const buttons = Array.from(document.querySelectorAll('[role="button"][aria-label]'))
        .filter((element) => {
          const label = clean(element.getAttribute("aria-label"));
          return labels.has(label) && isVisible(element);
        });
      const disabledCount = buttons.filter((element) => element.getAttribute("aria-disabled") === "true").length;
      const target = buttons.find((element) =>
        element.getAttribute("aria-disabled") !== "true" &&
        !element.hasAttribute("disabled") &&
        !element.closest('[aria-disabled="true"]')
      );
      if (!target) {
        const maxScroll = Math.max(
          document.body?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0
        );
        return {
          clicked: false,
          label: "",
          name: "",
          disabledCount,
          bottom: window.scrollY + window.innerHeight >= maxScroll - 12
        };
      }

      let card = target;
      for (let index = 0; index < 10 && card?.parentElement; index += 1) {
        const text = clean(card.innerText);
        if (text && text.length > 0 && text.length < 320 && labels.has(clean(target.getAttribute("aria-label")))) {
          const hasTargetText = text.includes(clean(target.getAttribute("aria-label")));
          const hasNameLikeText = text.replace(clean(target.getAttribute("aria-label")), "").trim().length > 0;
          if (hasTargetText && hasNameLikeText) break;
        }
        card = card.parentElement;
      }
      const label = clean(target.getAttribute("aria-label"));
      const lines = String(card?.innerText || "")
        .split(/\\n|\\s{2,}/)
        .map(clean)
        .filter(Boolean)
        .filter((line) => !labels.has(line) && !/^\\d+\\s+Tháng\\s+/i.test(line) && line !== "Lượt chọc");
      const name = lines[0] || "";
      target.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      target.click();
      return { clicked: true, label, name, disabledCount, bottom: false };
    `).catch(() => ({ clicked: false, label: "", name: "", disabledCount: 0, bottom: false }));

    if (result.clicked) {
      state.pokes += 1;
      log(state, "success", result.name ? `Đã ${result.label.toLowerCase()} ${result.name}.` : `Đã bấm nút ${result.label || "Chọc"}.`);
      await sleep(1800);
      return;
    }

    if (result.bottom && attempt >= 2) {
      break;
    }

    if (attempt === 0 || (attempt + 1) % 6 === 0) {
      log(state, "info", `Chưa thấy nút Chọc khả dụng, đang scroll tiếp. Bỏ qua ${result.disabledCount} nút đang disable.`);
    }
    await driver.executeScript("window.scrollBy({ top: Math.floor(window.innerHeight * 0.85), left: 0, behavior: 'smooth' })");
    await sleep(900);
  }

  throw new Error("Không tìm thấy nút Chọc khả dụng trong danh sách pokes.");
}

async function findReactionButton(driver: WebDriver, reactionName: string, timeoutMs = 6000) {
  const labels = reactionLabels[reactionName] ?? reactionLabels["Thích"];
  const script = `
    const labels = arguments[0] || [];
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const candidates = [];

    for (const element of document.querySelectorAll('[role="button"][aria-label], [aria-label]')) {
      if (!isVisible(element)) continue;

      const aria = normalize(element.getAttribute("aria-label"));
      const text = normalize(element.innerText || element.textContent);
      const rect = element.getBoundingClientRect();
      const inReactionBar = rect.width >= 30 && rect.width <= 80 && rect.height >= 30 && rect.height <= 80;
      let score = inReactionBar ? 20 : 0;

      for (const label of labels) {
        if (aria === label) score += 100;
        if (text === label) score += 70;
      }

      if (score > 0) {
        candidates.push({ element, score, aria, text });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best) {
      best.element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      return { element: best.element, aria: best.aria, text: best.text };
    }

    const removeLike = [...document.querySelectorAll('[role="button"][aria-label="Remove Like"]')]
      .find((element) => isVisible(element));
    if (labels.includes("Like") && removeLike) {
      return { element: null, aria: "Remove Like", text: "Like", alreadyActive: true };
    }

    return null;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await executeBrowserScript<
      | { element?: WebElement; aria?: string; text?: string; alreadyActive?: boolean }
      | null>(driver, script, labels);

    if (result?.alreadyActive) {
      return result;
    }

    if (result?.element) {
      return result;
    }

    await sleep(250);
  }

  return null;
}

async function findCommentButton(driver: WebDriver, timeoutMs = 7000, postAnchor?: WebElement) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const findPostContainer = (element) => {
      const direct =
        element?.closest?.('[role="article"]') ||
        element?.closest?.('[aria-posinset]') ||
        element?.closest?.('[data-pagelet*="FeedUnit"]') ||
        element?.closest?.('[data-pagelet*="ProfileTimeline"]');
      if (direct) return direct;

      let current = element?.parentElement || null;
      let best = null;
      let bestArea = 0;
      let hops = 0;
      while (current && hops < 14) {
        const rect = current.getBoundingClientRect();
        const text = (current.innerText || current.textContent || "").replace(/\\s+/g, " ").trim();
        const hasPostAction = Boolean(current.querySelector?.('[data-ad-rendering-role="comment_button"], [aria-label="Leave a comment"], [aria-label="Comment"], [aria-label*="comment" i], [aria-label*="Bình luận"], [data-ad-rendering-role="like_button"], [aria-label="Thích"], [aria-label="Like"]'));
        const area = rect.width * rect.height;
        const isFeedShell = current.matches?.('[role="feed"], [role="main"], [aria-label="Search results"]');
        if (!isFeedShell && rect.width >= 300 && rect.height >= 90 && (text.length >= 12 || hasPostAction) && area > bestArea) {
          best = current;
          bestArea = area;
        }
        current = current.parentElement;
        hops += 1;
      }
      return best || element?.closest?.('div') || document;
    };

    const pickClickableParent = (marker) => {
      let element = marker.closest('[role="button"], [tabindex="0"], button, a') || marker.parentElement;
      let hops = 0;

      while (element && hops < 8) {
        const rect = element.getBoundingClientRect();
        if (isVisible(element) && rect.width >= 18 && rect.height >= 18) {
          return element;
        }
        element = element.parentElement;
        hops += 1;
      }

      return marker;
    };

    const selectors = [
      '[data-ad-rendering-role="comment_button"]',
      '[aria-label="Leave a comment"]',
      '[aria-label="Comment"]',
      '[aria-label*="comment" i]',
      '[aria-label*="Bình luận"]'
    ];
    const scope = arguments[0] ? findPostContainer(arguments[0]) : document;
    const candidates = [];

    for (const selector of selectors) {
      for (const marker of scope.querySelectorAll(selector)) {
        const button = pickClickableParent(marker);
        if (!isVisible(button)) continue;

        const rect = button.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        const aria = button.getAttribute("aria-label") || marker.getAttribute("aria-label") || "";
        const text = (button.innerText || button.textContent || "").trim();
        let score = 0;

        if (/^(Leave a comment|Comment|Bình luận)$/i.test(aria)) score += 90;
        if (/comment|bình luận|binh luan/i.test(aria)) score += 50;
        if (/comment|bình luận|binh luan/i.test(text)) score += 35;
        if (marker.matches('[data-ad-rendering-role="comment_button"]')) score += 35;
        if (rect.width >= 24 && rect.width <= 260 && rect.height >= 20 && rect.height <= 80) score += 15;

        candidates.push({ button, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]?.button || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }
    return best;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, script, postAnchor ?? null);
    if (button) {
      return button;
    }

    await sleep(300);
  }

  return null;
}

async function findCommentTextbox(driver: WebDriver, timeoutMs = 10000, postAnchor?: WebElement) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const findPostContainer = (element) => {
      const direct =
        element?.closest?.('[role="article"]') ||
        element?.closest?.('[aria-posinset]') ||
        element?.closest?.('[data-pagelet*="FeedUnit"]') ||
        element?.closest?.('[data-pagelet*="ProfileTimeline"]');
      if (direct) return direct;

      let current = element?.parentElement || null;
      let best = null;
      let bestArea = 0;
      let hops = 0;
      while (current && hops < 14) {
        const rect = current.getBoundingClientRect();
        const text = (current.innerText || current.textContent || "").replace(/\\s+/g, " ").trim();
        const hasPostAction = Boolean(current.querySelector?.('[data-ad-rendering-role="comment_button"], [aria-label="Leave a comment"], [aria-label="Comment"], [aria-label*="comment" i], [aria-label*="Bình luận"], [data-ad-rendering-role="like_button"], [aria-label="Thích"], [aria-label="Like"]'));
        const area = rect.width * rect.height;
        const isFeedShell = current.matches?.('[role="feed"], [role="main"], [aria-label="Search results"]');
        if (!isFeedShell && rect.width >= 300 && rect.height >= 90 && (text.length >= 12 || hasPostAction) && area > bestArea) {
          best = current;
          bestArea = area;
        }
        current = current.parentElement;
        hops += 1;
      }
      return best || element?.closest?.('div') || null;
    };

    const labels = [
      "Write a comment",
      "Leave a comment",
      "Comment as",
      "Viết bình luận",
      "Bình luận"
    ];

    const candidates = [];
    const scopes = [];
    const post = arguments[0] ? findPostContainer(arguments[0]) : null;
    if (post) scopes.push(post);
    scopes.push(...[...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="dialog"]')].filter(isVisible).reverse());
    scopes.push(document);
    const seen = new Set();

    for (const scope of scopes) for (const element of scope.querySelectorAll('[contenteditable="true"]')) {
      if (seen.has(element)) continue;
      seen.add(element);
      if (!isVisible(element)) continue;

      const aria = element.getAttribute("aria-label") || "";
      const text = element.innerText || element.textContent || "";
      const rect = element.getBoundingClientRect();
      let score = 0;

      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      for (const label of labels) {
        if (aria.includes(label)) score += 70;
        if (text.includes(label)) score += 20;
      }
      if (element.getAttribute("role") === "textbox") score += 25;
      if (rect.width >= 120 && rect.height >= 20) score += 15;

      candidates.push({ element, score, top: rect.top });
    }

    candidates.sort((a, b) => b.score - a.score || b.top - a.top);
    const best = candidates[0]?.element || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }
    return best;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, script, postAnchor ?? null);
    if (textbox) {
      return textbox;
    }

    await sleep(300);
  }

  return null;
}

async function closeOpenDialog(driver: WebDriver) {
  const hasOpenDialogScript = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="dialog"]')]
      .filter((dialog) => isVisible(dialog));
    return dialogs.length > 0;
  `;
  const closeScript = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();

    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="dialog"]')]
      .filter((dialog) => isVisible(dialog));
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return null;

    const closeButton = [...dialog.querySelectorAll('[aria-label], [role="button"], button')]
      .find((button) => {
        if (!isVisible(button)) return false;
        const label = normalize(button.getAttribute("aria-label")) + " " + normalize(button.innerText || button.textContent);
        return /^(close|đóng|dong)/i.test(label);
      });
    if (!closeButton) return null;

    closeButton.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    return closeButton;
  `;

  for (let attempt = 0; attempt < 3; attempt++) {
    const closeButton = await executeBrowserScript<WebElement | null>(driver, closeScript);
    if (closeButton) {
      await clickElement(driver, closeButton);
    } else {
      await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
    }

    await sleep(700);
    const hasOpenDialog = await executeBrowserScript<boolean>(driver, hasOpenDialogScript);
    if (!hasOpenDialog) {
      await driver.executeScript("document.activeElement instanceof HTMLElement && document.activeElement.blur()");
      await sleep(300);
      return true;
    }
  }

  return false;
}

async function reactToPost(driver: WebDriver, config: BotConfig, state: BotState, likeButton?: WebElement) {
  if (!config.enableReact || config.reactions.length === 0) {
    return false;
  }

  const targetButton = likeButton ?? (await findLikeButton(driver));
  if (!targetButton) {
    log(state, "warn", "Không tìm thấy nút react/like.");
    return false;
  }

  for (let attempt = 1; attempt <= 3 && !state.stopRequested; attempt++) {
    try {
      const actions = driver.actions({ async: true });
      await driver.executeScript("arguments[0].style.outline='3px solid orange'", targetButton);
      await actions.move({ origin: targetButton }).pause(1200).perform();

      const reactionName = randomItem(config.reactions);
      const reaction = await findReactionButton(driver, reactionName);
      if (reaction?.alreadyActive) {
        log(state, "success", "Bài này đã ở trạng thái Like, bỏ qua để không tự hủy.");
        return true;
      }

      if (!reaction?.element) {
        throw new Error(`Không tìm thấy cảm xúc ${reactionName} trên thanh reaction.`);
      }

      await driver.executeScript("arguments[0].style.outline='3px solid green'", reaction.element);
      await clickElement(driver, reaction.element);
      log(state, "success", `Đã thả cảm xúc ${reactionName} thành công.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không click được cảm xúc.";
      log(state, "warn", `${message} (thử ${attempt}/3).`);
      await sleep(1500);
    }
  }

  await highlightPostContainer(driver, targetButton, "#ef4444");
  return false;
}

async function commentOnPost(
  driver: WebDriver,
  config: BotConfig,
  state: BotState,
  commentPool: string[] = config.comments,
  selectedPost?: ReactablePost
) {
  if (commentPool.length === 0) {
    return false;
  }

  for (let attempt = 1; attempt <= 3 && !state.stopRequested; attempt++) {
    try {
      const commentButton = await findCommentButton(driver, 7000, selectedPost?.button);
      if (commentButton) {
        await clickElement(driver, commentButton);
        await sleep(900);
      } else {
        log(state, "warn", "Không tìm thấy nút mở comment, thử tìm ô nhập trực tiếp.");
      }

      const textbox = await findCommentTextbox(driver, 10000, selectedPost?.button);
      if (!textbox) {
        throw new Error("Không tìm thấy ô nhập comment.");
      }

      await driver.executeScript("arguments[0].scrollIntoView({behavior:'smooth', block:'center'});", textbox);
      await highlightPostContainer(driver, textbox, "#0ea5e9");
      await sleep(1000);
      await textbox.click();
      await textbox.sendKeys(sanitizeAutomationText(randomItem(commentPool)));
      await textbox.sendKeys(Key.ENTER);
      await sleepRandom(5000, 10000);
      const closedDialog = await closeOpenDialog(driver);
      if (!closedDialog) {
        log(state, "warn", "Đã gửi comment nhưng không xác nhận được popup comment đã đóng.");
      }
      log(state, "success", "Đã bình luận thành công.");
      return true;
    } catch {
      log(state, "warn", `Bình luận thất bại lần ${attempt}/3.`);
      await sleep(2000);
    }
  }

  if (selectedPost?.button) {
    await highlightPostContainer(driver, selectedPost.button, "#ef4444");
  }
  return false;
}

async function joinVisibleGroup(
  driver: WebDriver,
  state: BotState,
  completedTasks: number,
  totalTasks: number,
  maxJoins: number
) {
  const highlightJoinButton = async (button: WebElement, stateName: "pending" | "joined" | "question") => {
    const styles = {
      pending: {
        outline: "3px solid #f59e0b",
        boxShadow: "0 0 0 3px rgba(245, 158, 11, 0.25)",
        backgroundColor: "rgba(245, 158, 11, 0.12)"
      },
      joined: {
        outline: "3px solid #22c55e",
        boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.25)",
        backgroundColor: "rgba(34, 197, 94, 0.12)"
      },
      question: {
        outline: "3px solid #ef4444",
        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.25)",
        backgroundColor: "rgba(239, 68, 68, 0.12)"
      }
    } as const;

    await driver.executeScript(
      `
      const element = arguments[0];
      const style = arguments[1];
      const stateName = arguments[2];
      if (!element) return;
      element.dataset.codexJoinAttempted = "1";
      element.dataset.codexJoinState = stateName;
      element.style.outline = style.outline;
      element.style.outlineOffset = "2px";
      element.style.boxShadow = style.boxShadow;
      element.style.backgroundColor = style.backgroundColor;
    `,
      button,
      styles[stateName],
      stateName
    );
  };

  const findJoinButtons = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const candidates = [];
    const scopeRoot = document.querySelector('[role="feed"]') || document.body;

    const exactJoinPattern = /^(join|join group|tham gia|tham gia nhóm|tham gia nhom)$/i;
    const joinAriaPattern = /^(join|join group|tham gia|tham gia nhóm|tham gia nhom)\b/i;
    const negativePattern = /joined|đã tham gia|da tham gia|cancel|pending|requested|leave|rời|roi|ảnh đại diện|anh dai dien|profile picture|avatar/i;

    for (const element of scopeRoot.querySelectorAll('[role="button"], button, a[role="link"]')) {
      if (!isVisible(element) || element.dataset.codexJoinAttempted === "1") continue;

      const aria = normalize(element.getAttribute("aria-label"));
      const text = normalize(element.innerText || element.textContent);
      const label = text || aria;
      const combined = aria + " " + text;
      const rect = element.getBoundingClientRect();
      let score = 0;

      if (negativePattern.test(combined)) continue;
      if (!exactJoinPattern.test(text) && !joinAriaPattern.test(aria)) continue;

      if (exactJoinPattern.test(text)) score += 150;
      if (joinAriaPattern.test(aria)) score += 90;
      if (/group|nhóm|nhom/i.test(combined)) score += 20;
      if (rect.width >= 40 && rect.width <= 260 && rect.height >= 24 && rect.height <= 80) score += 20;
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) score += 25;

      if (score > 0) {
        const article = element.closest('[role="article"]') || element.closest('[data-visualcompletion]') || scopeRoot;
        const groupLinks = [...article.querySelectorAll('a[href*="/groups/"]')]
          .map((anchor) => {
            let normalizedUrl = "";
            try {
              const url = new URL(anchor.href, window.location.origin);
              const match = url.pathname.match(/^\\/groups\\/([^/?#]+)/i);
              if (match && !["search", "feed", "discover", "joins", "categories"].includes(match[1].toLowerCase())) {
                normalizedUrl = "https://www.facebook.com/groups/" + match[1];
              }
            } catch {
              normalizedUrl = "";
            }
            const anchorText = normalize(anchor.innerText || anchor.textContent);
            const anchorAria = normalize(anchor.getAttribute("aria-label"));
            const groupNameFromAvatar = anchorAria.replace(/^Ảnh đại diện của\\s+/i, "").replace(/^Anh dai dien cua\\s+/i, "").trim();
            return {
              url: normalizedUrl,
              text: anchorText || groupNameFromAvatar
            };
          })
          .filter((item) => item.url);
        const namedGroup = groupLinks.find((item) => item.text && !/ảnh đại diện|anh dai dien|profile picture|avatar/i.test(item.text));
        const fallbackGroup = groupLinks[0];
        const groupName = namedGroup?.text || fallbackGroup?.text || "";
        const groupUrl = namedGroup?.url || fallbackGroup?.url || "";
        candidates.push({ element, score, label: label || "Join", groupName, groupUrl, top: rect.top });
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.top - b.top);
    return candidates.map(({ element, label, groupName, groupUrl, top }) => ({ element, label, groupName, groupUrl, top }));
  `;
  const deadline = Date.now() + 15000;
  let joinedCount = 0;

  while (Date.now() < deadline && !state.stopRequested && joinedCount < maxJoins) {
    const buttons = await executeBrowserScript<JoinCandidate[]>(driver, findJoinButtons);

    if (buttons.length > 0) {
      for (const button of buttons) {
        if (state.stopRequested) {
          return joinedCount;
        }

        if (joinedCount >= maxJoins) {
          return joinedCount;
        }

        try {
          await driver.executeScript(
            "arguments[0].dataset.codexJoinAttempted='1'; arguments[0].dataset.codexJoinState='pending'; arguments[0].style.outline='3px solid #f59e0b'; arguments[0].style.outlineOffset='2px'; arguments[0].style.boxShadow='0 0 0 3px rgba(245, 158, 11, 0.25)'; arguments[0].style.backgroundColor='rgba(245, 158, 11, 0.12)'; arguments[0].scrollIntoView({behavior:'instant', block:'center', inline:'center'});",
            button.element
          );
          await clickElement(driver, button.element);
          await sleep(2000);
        } catch {
          continue;
        }

        const questionResult = await executeBrowserScript<{ hasQuestions?: boolean; closed?: boolean }>(driver, `
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
        const dialogs = [
          ...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [aria-hidden="false"]')
        ].filter(isVisible);
        const questionPattern = /question|questions|answer|membership questions|câu hỏi|cau hoi|trả lời|tra loi/i;
        const submitPattern = /submit|send|gửi|gui/i;
        const hasQuestionDialog = dialogs.some((dialog) => {
          const text = normalize(dialog.innerText || dialog.textContent);
          const inputs = dialog.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]').length;
          const submitLike = [...dialog.querySelectorAll('[role="button"], button')].some((button) =>
            submitPattern.test(normalize(button.getAttribute("aria-label")) + " " + normalize(button.innerText || button.textContent))
          );
          return questionPattern.test(text) || (inputs > 0 && submitLike);
        });

        if (!hasQuestionDialog) return { hasQuestions: false };

        for (const dialog of dialogs) {
          const closeButton = [...dialog.querySelectorAll('[aria-label], [role="button"], button')].find((button) => {
            if (!isVisible(button)) return false;
            const label = normalize(button.getAttribute("aria-label")) + " " + normalize(button.innerText || button.textContent);
            return /close|not now|cancel|đóng|dong|hủy|huy|để sau|de sau/i.test(label);
          });
          if (closeButton) {
            closeButton.click();
            return { hasQuestions: true, closed: true };
          }
        }

        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true });
        document.dispatchEvent(escapeEvent);
        return { hasQuestions: true, closed: false };
        `);

        if (questionResult.hasQuestions) {
          await highlightJoinButton(button.element, "question").catch(() => undefined);
          log(state, "warn", "Group có câu hỏi tham gia nên đã tắt popup và tìm nút Join khác.");
          continue;
        }

        await highlightJoinButton(button.element, "joined").catch(() => undefined);
        state.joinedGroups += 1;
        joinedCount += 1;
        updateProgress(state, completedTasks + joinedCount - 1, totalTasks);
        if (button.groupName && button.groupUrl) {
          log(state, "success", `Đã tham gia "${button.groupName}" (${button.groupUrl}).`);
        } else if (button.groupName) {
          log(state, "success", `Đã tham gia "${button.groupName}".`);
        } else {
          log(state, "success", `Đã tham gia group.`);
        }
      }

      if (joinedCount > 0) {
        return joinedCount;
      }
    }

    await driver.executeScript("window.scrollBy(0, Math.floor(window.innerHeight * 0.75))");
    await sleep(800);
  }

  if (joinedCount === 0) {
    log(state, "warn", "Không tìm thấy nút Join group.");
  }
  return joinedCount;
}

async function joinGroupTask(
  driver: WebDriver,
  config: BotConfig,
  state: BotState,
  groupIndex: number,
  completedTasks: number,
  totalTasks: number,
  maxJoins: number
) {
  if (!config.enableGroup) {
    return 0;
  }

  if (config.groupMode === "links") {
    const url = config.groupLinks[groupIndex % config.groupLinks.length];
    log(state, "info", `Đang mở group: ${url}`);
    await driver.get(url);
    await assertFacebookCheckpoint(driver);
    await sleep(2500);
    return joinVisibleGroup(driver, state, completedTasks, totalTasks, 1);
  }

  const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(config.groupKeyword)}`;
  const currentUrl = await driver.getCurrentUrl().catch(() => "");
  const isOnGroupSearch = currentUrl.includes("/search/groups/");

  if (groupIndex === 0 || !isOnGroupSearch) {
    log(state, "info", `Đang tìm group theo keyword: ${config.groupKeyword}`);
    await driver.get(searchUrl);
    await assertFacebookCheckpoint(driver);
    await sleep(3000);
  } else {
    log(state, "info", "Tiếp tục tìm nút Join trên trang kết quả hiện tại.");
  }

  return joinVisibleGroup(driver, state, completedTasks, totalTasks, maxJoins);
}

function cleanGroupLinkForPosting(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(parsed.hostname.toLowerCase())) {
      return null;
    }

    const match = parsed.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) {
      return null;
    }

    const groupKey = match[1].toLowerCase();
    if (["search", "feed", "discover", "joins", "categories"].includes(groupKey)) {
      return null;
    }

    return `https://www.facebook.com/groups/${match[1]}`;
  } catch {
    return null;
  }
}

async function scanMyGroupPostLinks(
  driver: WebDriver,
  state: BotState,
  userId: string,
  scope: string,
  mode: "all" | "keyword",
  keyword: string
) {
  const searchKeyword = keyword.trim();
  log(
    state,
    "info",
    mode === "keyword"
            ? `Đang quét group đã tham gia theo keyword: ${searchKeyword}`
            : "Đang quét tất cả group đã tham gia."
  );
  await driver.get(buildMyGroupsScanUrl(mode, searchKeyword));
  await assertFacebookCheckpoint(driver);
  await sleep(3500);

  const links = new Set<string>();
  const scanScript = `
    const results = [];
    for (const anchor of document.querySelectorAll('a[href*="/groups/"]')) {
      const href = anchor.href || "";
      const text = (anchor.innerText || anchor.textContent || "").replace(/\\s+/g, " ").trim();
      results.push({ href, text });
    }
    return results;
  `;

  for (let round = 0; round < 8 && !state.stopRequested; round++) {
    const found = await executeBrowserScript<Array<{ href?: string; text?: string }>>(driver, scanScript);
    for (const item of found) {
      const link = item.href ? cleanGroupLinkForPosting(item.href) : null;
      if (link) {
        links.add(link);
      }
    }

    await driver.executeScript("window.scrollBy(0, Math.floor(window.innerHeight * 0.9))");
    await sleep(900);
  }

  const savedLinks = await saveCachedGroupPostLinks(userId, scope, [...links]);
  log(state, savedLinks.length > 0 ? "success" : "warn", `Đã lưu ${savedLinks.length} link group vào cache.`);
  return savedLinks;
}

async function openGroupAndComment(
  driver: WebDriver,
  config: BotConfig,
  state: BotState,
  groupUrl: string,
  seenPosts: Set<string>
) {
  log(state, "info", `Đang mở group để comment: ${groupUrl}`);
  await driver.get(groupUrl);
  await assertFacebookCheckpoint(driver);
  await sleep(3000);

  const commentPool = config.groupComments.length > 0 ? config.groupComments : config.comments;
  let commentedCount = 0;
  log(state, "info", "Sẽ scroll và comment các bài phù hợp trong group đến khi hết bài tìm được.");

  while (!state.stopRequested) {
    const post = await findNextReactablePost(driver, seenPosts, state, 18000, {
      fraction: 0.28,
      steps: 6,
      delayMs: 320,
      settleMs: 900,
      scrollIntoViewBehavior: "smooth",
      requireCommentAction: true
    });
    if (!post) {
      if (commentedCount === 0) {
        throw new Error("Không tìm thấy bài viết phù hợp trong group.");
      }
      break;
    }

    log(state, "info", `Đã chọn bài trong group: ${formatPostLogTarget(post)}`);

    const success = await commentOnPost(driver, config, state, commentPool, post);
    if (success) {
      await markGroupCommentedPost(driver, post);
      commentedCount += 1;
    }

    if (!state.stopRequested) {
      await scrollPageSlowly(driver, 0.3, 6, 320);
      await sleep(900);
    }
  }

  if (commentedCount === 0) {
    throw new Error("Không thể comment bài viết trong group.");
  }
}

async function findGroupComposerButton(driver: WebDriver, timeoutMs = 12000) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const fold = (value) => normalize(value).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d");
    const hasAny = (value, phrases) => phrases.some((phrase) => value.includes(phrase));
    const composerPhrases = ["write something", "ban viet gi di", "viet gi di", "viet gi do", "create post", "create a post", "create public post", "tao bai viet"];
    const actionPhrases = ["cam xuc", "hoat dong", "check in", "tham do y kien"];
    const cardScopes = [...document.querySelectorAll("div")].filter((element) => {
      if (!isVisible(element)) return false;
      const text = fold(element.innerText || element.textContent);
      if (!hasAny(text, composerPhrases)) return false;
      if (!actionPhrases.some((phrase) => text.includes(phrase))) return false;
      const rect = element.getBoundingClientRect();
      return rect.width >= 260 && rect.height >= 70 && rect.height <= 260 && rect.top >= -80 && rect.top <= window.innerHeight;
    });
    const scopes = cardScopes.length ? cardScopes : [document];
    const candidates = [];

    for (const scope of scopes) for (const element of scope.querySelectorAll('[role="button"], button')) {
      if (!isVisible(element)) continue;

      const text = normalize(element.innerText || element.textContent);
      const aria = normalize(element.getAttribute("aria-label"));
      const folded = fold(text + " " + aria);
      const rect = element.getBoundingClientRect();
      let score = 0;

      if (hasAny(folded, ["write something", "ban viet gi di"])) score += 150;
      if (hasAny(folded, composerPhrases)) score += 100;
      if (hasAny(folded, actionPhrases)) score -= 160;
      if (cardScopes.some((scope) => scope.contains(element))) score += 80;
      if (rect.width >= 140 && rect.height >= 28 && rect.top >= 0 && rect.top <= window.innerHeight) score += 20;

      if (score > 0) {
        candidates.push({ element, score, top: rect.top });
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.top - b.top);
    const best = candidates[0]?.element || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }
    return best;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, script);
    if (button) {
      return button;
    }

    await driver.executeScript("window.scrollBy(0, Math.floor(window.innerHeight * 0.55))");
    await sleep(500);
  }

  return null;
}

async function findGroupPostTextbox(driver: WebDriver, timeoutMs = 12000) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none") {
        return true;
      }

      const visibleChild = [...element.querySelectorAll("*")].some((child) => {
        const childRect = child.getBoundingClientRect();
        const childStyle = window.getComputedStyle(child);
        return childRect.width > 0 && childRect.height > 0 && childStyle.visibility !== "hidden" && childStyle.display !== "none";
      });
      return visibleChild && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(isVisible);
    const createPostDialog =
      dialogs.find((dialog) => /create post|tạo bài viết|tao bai viet/i.test(normalize(dialog.innerText || dialog.textContent))) ||
      dialogs[dialogs.length - 1];
    const scope = createPostDialog || document;
    const candidates = [];

    for (const element of scope.querySelectorAll('[data-lexical-editor="true"], [contenteditable][role="textbox"], [contenteditable], [role="textbox"], textarea')) {
      if (!isVisible(element)) continue;

      const aria = normalize(element.getAttribute("aria-label"));
      const placeholder = normalize(element.getAttribute("aria-placeholder"));
      const dataPlaceholder = normalize(element.getAttribute("data-placeholder"));
      const text = normalize(element.innerText || element.textContent);
      const rect = element.getBoundingClientRect();
      const editable = element.getAttribute("contenteditable");
      let score = 0;

      if (/create a public post|what's on your mind|write something|write a post|bạn viết gì đi|ban viet gi di|viết gì đi|viet gi di|tạo bài viết|tao bai viet|bạn đang nghĩ gì|ban dang nghi gi/i.test(aria + " " + placeholder + " " + dataPlaceholder + " " + text)) score += 120;
      if (element.matches('[data-lexical-editor="true"]')) score += 90;
      if (editable && editable !== "false") score += 70;
      if (element.getAttribute("role") === "textbox") score += 30;
      if (rect.width >= 150 && rect.height >= 24) score += 20;
      if (createPostDialog && createPostDialog.contains(element)) score += 20;
      if (/comment|bình luận|binh luan/i.test(aria + " " + placeholder)) score -= 120;

      candidates.push({ element, score, top: rect.top });
    }

    candidates.sort((a, b) => b.score - a.score || a.top - b.top);
    const best = candidates[0]?.element || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      best.focus?.();
    }
    return best;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, script);
    if (textbox) {
      return textbox;
    }
    await sleep(400);
  }

  return null;
}

async function findEnabledPostButton(driver: WebDriver, timeoutMs = 12000) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(isVisible);
    const scope =
      dialogs.find((dialog) => /create post|tạo bài viết|tao bai viet/i.test(normalize(dialog.innerText || dialog.textContent))) ||
      dialogs[dialogs.length - 1] ||
      document;
    const candidates = [];

    for (const element of scope.querySelectorAll('[role="button"], button, input[type="submit"]')) {
      if (!isVisible(element)) continue;

      const label = normalize([
        element.getAttribute("aria-label"),
        element.getAttribute("value"),
        element.innerText,
        element.textContent
      ].filter(Boolean).join(" "));
      const disabled =
        element.getAttribute("aria-disabled") === "true" ||
        element.getAttribute("disabled") !== null ||
        element.disabled ||
        element.closest('[aria-disabled="true"]');
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      let score = 0;

      if (/^post$/i.test(label)) score += 140;
      if (/^post\\s+to\\b/i.test(label)) score += 130;
      if (/^đăng$/i.test(label)) score += 140;
      if (/^đăng\\s+bài/i.test(label)) score += 130;
      if (/post|đăng/i.test(label)) score += 50;
      if (/comment|reply|bình luận|binh luan/i.test(label)) score -= 200;
      if (disabled) score -= 500;
      if (rect.width >= 80 && rect.height >= 28) score += 20;
      if (/rgb\\(24, 119, 242\\)|rgb\\(8, 102, 255\\)/i.test(style.backgroundColor)) score += 20;

      if (score > 0) {
        candidates.push({ element, score, label });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]?.element || null;
    if (best) {
      best.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }
    return best;
  `;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, script);
    if (button) {
      return button;
    }
    await sleep(500);
  }

  return null;
}

async function fillGroupPostTextbox(driver: WebDriver, textbox: WebElement, content: string) {
  await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant', block:'center', inline:'center'});", textbox);
  await sleep(300);
  await textbox.click();
  await driver.actions({ async: true }).sendKeys(content).perform();
  await sleep(1200);

  const hasContent = await executeBrowserScript<boolean>(
    driver,
    `
    const element = arguments[0];
    const content = arguments[1];
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    return normalize(element.innerText || element.textContent || element.value).includes(normalize(content).slice(0, 20));
    `,
    textbox,
    content
  );

  if (hasContent) {
    return true;
  }

  return await executeBrowserScript<boolean>(
    driver,
    `
    const element = arguments[0];
    const content = arguments[1];
    element.focus?.();
    if ("value" in element) {
      element.value = content;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    const inserted = document.execCommand("insertText", false, content);
    element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: content }));
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: content }));
    return inserted || (element.innerText || element.textContent || "").length > 0;
    `,
    textbox,
    content
  );
}

async function postToGroup(driver: WebDriver, config: BotConfig, state: BotState, groupUrl: string) {
  const content = randomItem(config.groupPostContents);
  log(state, "info", `Đang mở group để đăng bài: ${groupUrl}`);
  await driver.get(groupUrl);
  await assertFacebookCheckpoint(driver);
  await sleep(3500);

  let composerButton = await findGroupComposerButton(driver);
  if (!composerButton) {
    throw new Error("Không tìm thấy nút Write something trong group.");
  }

  await driver.executeScript("arguments[0].style.outline='3px solid #0ea5e9'", composerButton);
  await clickElement(driver, composerButton);
  await sleep(1800);

  let textbox = await findGroupPostTextbox(driver, 6000);
  if (!textbox) {
    log(state, "warn", "Chưa thấy ô nhập bài đăng, thử mở composer lại.");
    composerButton = await findGroupComposerButton(driver, 5000);
    if (composerButton) {
      await clickElement(driver, composerButton);
      await sleep(2000);
    }
    textbox = await findGroupPostTextbox(driver, 10000);
  }

  if (!textbox) {
    throw new Error("Không tìm thấy ô nhập nội dung bài đăng.");
  }

  const typed = await fillGroupPostTextbox(driver, textbox, content);
  if (!typed) {
    log(state, "warn", "Không xác nhận được nội dung đã nhập vào editor, vẫn tiếp tục tìm nút Post.");
  }

  let postButton = await findEnabledPostButton(driver, 8000);
  if (!postButton) {
    log(state, "warn", "Chưa thấy nút Post bật, thử kích hoạt lại editor.");
    await textbox.click();
    await driver.actions({ async: true }).sendKeys(" ").sendKeys(Key.BACK_SPACE).perform();
    await sleep(1500);
    postButton = await findEnabledPostButton(driver, 10000);
  }
  if (!postButton) {
    throw new Error("Không tìm thấy nút Post đã bật.");
  }

  await driver.executeScript("arguments[0].style.outline='3px solid #22c55e'", postButton);
  await clickElement(driver, postButton);
  await sleepRandom(5000, 10000);
  state.groupPosts += 1;
  log(state, "success", "Đã gửi bài đăng vào group.");
}

async function groupPostTask(
  driver: WebDriver,
  config: BotConfig,
  state: BotState,
  postIndex: number,
  cachedLinks: string[]
) {
  const currentAccount = getCurrentWorkerAccount(state);
  if (!config.enableGroupPost || !currentAccount) {
    return;
  }

  let links = config.groupPostTargetMode === "links" ? config.groupPostLinks : cachedLinks;
  const cacheScope = config.groupPostTargetMode === "keyword" ? `keyword-${config.groupPostKeyword.toLowerCase()}` : "links";
  const scanKeyword = config.groupPostTargetMode === "keyword" ? config.groupPostKeyword : "";

  if (config.groupPostTargetMode === "keyword" && links.length === 0) {
    links = config.refreshGroupPostLinks ? [] : await loadCachedGroupPostLinks(currentAccount.userId, cacheScope);
    if (links.length === 0) {
      links = await scanMyGroupPostLinks(
        driver,
        state,
        currentAccount.userId,
        cacheScope,
        "keyword",
        scanKeyword
      );
    } else {
      log(state, "info", `Đã load ${links.length} link group từ cache.`);
    }

    cachedLinks.push(...links);
  }

  if (links.length === 0) {
    throw new Error("Không có link group nào để đăng bài.");
  }

  const groupUrl = links[postIndex % links.length];
  await postToGroup(driver, config, state, groupUrl);
}

async function groupCommentSearchTask(
  driver: WebDriver,
  config: BotConfig,
  state: BotState,
  commentIndex: number,
  seenPosts: Set<string>
) {
  if (!config.enableGroupComment || !getCurrentWorkerAccount(state)) {
    return;
  }

  const keyword = config.groupCommentKeyword.trim();
  const searchUrl = buildGroupPostsSearchUrl(keyword);
  const commentPool = config.groupComments.length > 0 ? config.groupComments : config.comments;

  const currentUrl = await driver.getCurrentUrl().catch(() => "");
  const isOnSearchPage = currentUrl.includes("/groups/search/group_posts/") || currentUrl.includes("/groups/feed/");

  if (commentIndex === 0 || !isOnSearchPage) {
    log(state, "info", keyword ? `Đang tìm bài viết trong group theo keyword: ${keyword}` : "Đang comment feed của tất cả group đã tham gia.");
    await driver.get(searchUrl);
    await assertFacebookCheckpoint(driver);
    await sleep(3000);
  }

  const post = await findNextReactablePost(driver, seenPosts, state, 30000, {
    fraction: 0.28,
    steps: 6,
    delayMs: 320,
    settleMs: 900,
    scrollIntoViewBehavior: "smooth",
    requireCommentAction: true
  });

  if (!post) {
    throw new Error("Không tìm thấy bài viết phù hợp trong group.");
  }

  log(state, "info", `Đã chọn bài group: ${formatPostLogTarget(post)}`);
  const success = await commentOnPost(driver, config, state, commentPool, post);
  if (!success) {
    await highlightPostContainer(driver, post.button, "#ef4444");
    throw new Error("Không thể comment bài viết group.");
  }

  await markGroupCommentedPost(driver, post);
}

async function verifyAccountAfterConsecutiveTaskErrors(
  config: BotConfig,
  state: BotState,
  ownerId: number,
  userId: string,
  accountLabel: string,
  consecutiveErrors: number,
  driver?: WebDriver
) {
  log(state, "warn", `Tài khoản ${accountLabel || userId} lỗi liên tiếp ${consecutiveErrors} lần. Đang check live trước khi chạy tiếp.`);
  let liveInfo: FacebookSessionInspection | null = null;

  if (driver) {
    liveInfo = await inspectFacebookSession(driver).catch(() => null);
    if (liveInfo?.status && liveInfo.status !== "unknown") {
      log(state, "info", `Check live bằng Chrome đang chạy: ${liveInfo.status}.`);
    }
  }

  if (!liveInfo || liveInfo.status === "unknown") {
    const cookieLiveInfo = await inspectFacebookCookieWithChrome(config.cookie, userId, config.proxy || "");
    liveInfo = { checkpointCode: null, ...cookieLiveInfo };
  }

  await updateFacebookAutoAccountStatus(ownerId, userId, liveInfo.status);

  if (liveInfo.status === "active") {
    log(state, "success", `Check live: tài khoản ${liveInfo.facebookName || accountLabel || userId} vẫn sống. Bot tiếp tục chạy.`);
    return true;
  }

  const statusLabel = liveInfo.status === "checkpoint"
    ? "checkpoint"
    : liveInfo.status === "invalid"
      ? "die"
      : "không xác định";
  log(state, "error", `Check live: tài khoản ${accountLabel || userId} ${statusLabel}. Dừng riêng luồng tài khoản này, các luồng khác tiếp tục chạy.`);
  return false;
}

async function run(
  config: BotConfig,
  state: BotState,
  accountIndex = 1,
  totalAccounts = 1,
  tasks = buildTasks(config),
  startIndex = 0
) {
  const seenPosts = new Set<string>();
  let groupIndex = tasks.slice(0, startIndex).filter((task) => task === "group").length;
  let groupCommentIndex = tasks.slice(0, startIndex).filter((task) => task === "groupComment").length;
  let groupPostIndex = tasks.slice(0, startIndex).filter((task) => task === "groupPost").length;
  const cachedGroupPostLinks: string[] = [];
  const seenGroupCommentPosts = new Set<string>();
  let failed = false;
  let driver: WebDriver | undefined;
  let consecutiveTaskErrors = 0;
  const userId = config.cookie.match(/(?:^|;\s*)c_user=(\d+)/)?.[1] || "";

  try {
    log(state, "info", `Luồng ${accountIndex}/${totalAccounts} bắt đầu chạy từ tác vụ ${startIndex + 1}/${tasks.length}.`);
    const currentOwnerId = getOwnerId();
    let accountLabel = await getFacebookAutoAccountLabelByUserId(currentOwnerId, userId);
    const workerContext = workerLogContext.getStore();
    if (workerContext) {
      workerContext.accountUserId = userId;
      workerContext.accountName = accountLabel || userId;
    }

    log(state, "info", "Đang check live trước khi chạy bot.");
    const preLiveInfo = await inspectFacebookCookieWithChrome(config.cookie, userId, config.proxy || "");
    await updateFacebookAutoAccountStatus(currentOwnerId, userId, preLiveInfo.status);
    if (preLiveInfo.facebookName && preLiveInfo.facebookName !== "Không rõ") {
      accountLabel = accountLabel || preLiveInfo.facebookName;
      if (workerContext) workerContext.accountName = accountLabel || userId;
    }
    if (preLiveInfo.status !== "active") {
      const statusLabel = preLiveInfo.status === "checkpoint"
        ? "checkpoint"
        : preLiveInfo.status === "invalid"
          ? "die"
          : "không xác định";
      log(state, "error", `Đăng nhập thất bại: tài khoản ${accountLabel || userId} ${statusLabel}.`);
      finishCurrentAccountProgress(state, tasks.length);
      return;
    }
    log(state, "success", `Check live: tài khoản ${preLiveInfo.facebookName || accountLabel || userId} vẫn sống. Bắt đầu chạy tác vụ.`);

    driver = await buildDriver(config);
    state.driver = driver;
    state.activeDrivers.add(driver);

    if (config.proxy?.trim()) {
      const proxyCheck = await checkChromeProxyUsage(driver, config.proxy);
      log(state, proxyCheckLogLevel(proxyCheck), formatProxyCheckMessage("Proxy đang dùng", proxyCheck));
    } else {
      log(state, "info", "Tài khoản này không dùng proxy.");
    }

    await addCookieString(driver, config.cookie, state);
    await driver.navigate().refresh();
    await sleep(2500);

    const session = await inspectFacebookSession(driver);
    accountLabel = accountLabel || (session.facebookName !== "Không rõ" ? session.facebookName : "");
    if (workerContext) {
      workerContext.accountUserId = userId;
      workerContext.accountName = accountLabel || userId;
    }
    if (session.status === "checkpoint") {
      await updateFacebookAutoAccountStatus(currentOwnerId, userId, "checkpoint");
      log(state, "error", `Đăng nhập thất bại: tài khoản ${accountLabel || userId} checkpoint.`);
      finishCurrentAccountProgress(state, tasks.length);
      return;
    }
    if (session.status === "invalid") {
      await updateFacebookAutoAccountStatus(currentOwnerId, userId, "invalid");
      log(state, "error", `Đăng nhập thất bại: tài khoản ${accountLabel || userId} die.`);
      finishCurrentAccountProgress(state, tasks.length);
      return;
    }

    state.account = { name: accountLabel || userId, userId };
    log(state, "info", `Đang nhập vào tài khoản: ${state.account.name} (ID: ${state.account.userId}).`);
    await sleep(3000);

    for (let index = startIndex; index < tasks.length && !state.stopRequested; index++) {
      await waitWhilePaused(state);
      if (state.stopRequested) break;
      const task = tasks[index];
      let completedTask = false;
      let skippedTask = false;
      log(state, "info", "=".repeat(40));
      log(state, "info", `Bắt đầu tác vụ ${index + 1}/${tasks.length}: ${task}.`);

      try {
        if (task === "pokes") {
          await pokeFriendTask(driver, state);
          completedTask = true;
        } else if (task === "group") {
          const joinedTasks = await joinGroupTask(
            driver,
            config,
            state,
            groupIndex,
            index + 1,
            tasks.length,
            1
          );
          groupIndex += 1;
          completedTask = joinedTasks > 0;
        } else if (task === "groupComment") {
          await groupCommentSearchTask(
            driver,
            config,
            state,
            groupCommentIndex,
            seenGroupCommentPosts
          );
          groupCommentIndex += 1;
          completedTask = true;
        } else if (task === "groupPost") {
          await groupPostTask(driver, config, state, groupPostIndex, cachedGroupPostLinks);
          groupPostIndex += 1;
          completedTask = true;
        } else {
          const currentUrl = await driver.getCurrentUrl().catch(() => "");
          const currentPath = getUrlPathname(currentUrl);
          const isFeedPage = currentPath === "/" || currentPath === "";

          if (!isFeedPage) {
            await driver.get("https://www.facebook.com/");
            await assertFacebookCheckpoint(driver, currentOwnerId, getCurrentWorkerAccount(state)?.userId || userId);
            await sleep(1500);
          }

          log(state, "info", "Đang tìm bài có nút reaction/comment...");

          const post = await findNextReactablePostWithReload(
            driver,
            seenPosts,
            state,
            3,
            task === "comment" ? { requireCommentAction: true, scrollIntoViewBehavior: "smooth" } : undefined
          );
          if (!post) {
            throw new Error("Không tìm thấy bài nào phù hợp trong thời gian chờ.");
          }

          const links = [
            post.groupId ? `Link group: https://www.facebook.com/groups/${post.groupId}` : null
          ].filter(Boolean);
          log(state, "info", `Đã chọn bài trong feed: ${formatPostLogTarget(post)}`);

          if (task === "react") {
            const success = await reactToPost(driver, config, state, post.button);
            if (!success) {
              await highlightPostContainer(driver, post.button, "#ef4444");
              throw new Error("Không thể thả reaction bài viết.");
            }
          } else {
            const success = await commentOnPost(driver, config, state, config.comments, post);
            if (!success) {
              await highlightPostContainer(driver, post.button, "#ef4444");
              throw new Error("Không thể comment bài viết.");
            }
          }
          completedTask = true;
        }
      } catch (error) {
        if (state.stopRequested) break;
        if (task === "groupPost") groupPostIndex += 1;
        if (task === "groupComment") groupCommentIndex += 1;
        if (task === "group") groupIndex += 1;
        completedTask = true;
        skippedTask = true;
        const reason = error instanceof Error ? error.message : "Lỗi không xác định";
        consecutiveTaskErrors += 1;
        log(state, "warn", `Bỏ qua tác vụ ${index + 1}/${tasks.length} (${task}): ${reason}`);

        if (consecutiveTaskErrors >= 3) {
          const canContinue = await verifyAccountAfterConsecutiveTaskErrors(
            config,
            state,
            currentOwnerId,
            userId,
            accountLabel || getCurrentWorkerAccount(state)?.name || "",
            consecutiveTaskErrors,
            driver
          );
          consecutiveTaskErrors = 0;
          if (!canContinue) {
            finishCurrentAccountProgress(state, tasks.length);
            break;
          }
        }
      }

      if (!completedTask && !skippedTask) {
        completedTask = true;
        skippedTask = true;
        consecutiveTaskErrors += 1;
        log(state, "warn", `Bỏ qua tác vụ ${index + 1}/${tasks.length} (${task}): tác vụ không hoàn tất.`);

        if (consecutiveTaskErrors >= 3) {
          const canContinue = await verifyAccountAfterConsecutiveTaskErrors(
            config,
            state,
            currentOwnerId,
            userId,
            accountLabel || getCurrentWorkerAccount(state)?.name || "",
            consecutiveTaskErrors,
            driver
          );
          consecutiveTaskErrors = 0;
          if (!canContinue) {
            finishCurrentAccountProgress(state, tasks.length);
            break;
          }
        }
      }

      if (completedTask) {
        updateProgress(state, index + 1, tasks.length);
        if (!skippedTask) {
          consecutiveTaskErrors = 0;
          log(state, "success", `Hoàn tất tác vụ ${index + 1}.`);
        }
      }

      if (index < tasks.length - 1) {
        await driver.executeScript("window.scrollBy(0, Math.floor(window.innerHeight * 0.9))");
        const delaySeconds = task === "react"
          ? config.reactDelaySeconds
          : task === "comment"
            ? config.commentDelaySeconds
            : task === "group"
              ? config.groupDelaySeconds
              : task === "groupComment"
                ? config.groupCommentDelaySeconds
                : task === "groupPost"
                  ? config.groupPostDelaySeconds
                  : config.pokesDelaySeconds;
        await countdownDelay(state, delaySeconds);
      }
    }

    log(
      state,
      state.stopRequested ? "warn" : "success",
      state.stopRequested ? `Luồng ${accountIndex}/${totalAccounts} đã dừng.` : `Luồng ${accountIndex}/${totalAccounts} đã hoàn tất.`
    );
  } catch (error) {
    failed = true;
    const reason = error instanceof Error ? error.message : "Lỗi không xác định";
  } finally {
    try {
      await driver?.quit();
    } catch {
      // The browser may already be closed.
    }
    if (driver) {
      state.activeDrivers.delete(driver);
    }
    if (state.driver === driver) {
      state.driver = undefined;
    }
    if (!state.stopRequested && !failed) {
      log(state, "info", `Đã đóng Chrome của luồng ${accountIndex}/${totalAccounts}.`);
    }
  }
}

async function runQueued(ownerId: number, config: BotConfig, state: BotState, job: PersistedJob, runToken: number) {
  const cookies = config.cookieList.length > 0 ? config.cookieList : [config.cookie];
  const totalAccounts = cookies.length;
  const maxWorkers = Math.min(state.maxWorkers, totalAccounts);
  const estimatedAccountMs = Math.max(
    (config.enableReact ? config.reactCount * (config.reactDelaySeconds + 5) : 0) +
    (config.enableComment ? config.commentCount * (config.commentDelaySeconds + 5) : 0) +
    (config.enableGroup ? config.groupCount * (config.groupDelaySeconds + 8) : 0) +
    (config.enableGroupComment ? config.groupCommentCount * 5 * (config.groupCommentDelaySeconds + 8) : 0) +
    (config.enableGroupPost ? config.groupPostCount * (config.groupPostDelaySeconds + 8) : 0) +
    (config.enablePokes ? config.pokesCount * (config.pokesDelaySeconds + 6) : 0),
    30
  ) * 1000;
  let nextIndex = 0;

  const updateQueueEstimate = () => {
    state.nextQueuePosition = state.queuedWorkers > 0 ? 1 : null;
    state.estimatedNextStartAt = state.queuedWorkers > 0
      ? new Date(Date.now() + estimatedAccountMs).toISOString()
      : null;
  };

  const takeNextCookie = () => {
    if (state.runToken !== runToken) return null;
    while (nextIndex < totalAccounts && (job.completedByAccount[nextIndex] ?? 0) >= (job.tasksByAccount[nextIndex]?.length ?? 0)) {
      nextIndex += 1;
    }
    if (state.stopRequested || nextIndex >= totalAccounts) {
      return null;
    }

    const index = nextIndex;
    nextIndex += 1;
    state.queuedWorkers = Math.max(totalAccounts - nextIndex, 0);
    updateQueueEstimate();
    notifyStatus();
    return { cookie: cookies[index], index };
  };

  const worker = async () => {
    while (!state.stopRequested && state.runToken === runToken) {
      await waitWhilePaused(state);
      if (state.stopRequested || state.runToken !== runToken) return;
      const next = takeNextCookie();
      if (!next) {
        return;
      }

      await acquireWorkerSlot();
      if (state.stopRequested || state.runToken !== runToken) {
        releaseWorkerSlot();
        return;
      }
      state.activeWorkers += 1;
      const activeUserId = next.cookie.match(/(?:^|;\s*)c_user=(\d+)/)?.[1] || "";
      if (activeUserId && !state.activeAccountUserIds.includes(activeUserId)) {
        state.activeAccountUserIds.push(activeUserId);
      }
      const tasks = job.tasksByAccount[next.index] ?? buildTasks(config);
      const startIndex = job.completedByAccount[next.index] ?? 0;
      if (activeUserId) {
        state.accountProgress[activeUserId] = {
          current: startIndex,
          total: tasks.length,
          progress: tasks.length > 0 ? Math.round((startIndex / tasks.length) * 100) : 0,
          running: true
        };
      }
      state.queuedWorkers = Math.max(totalAccounts - nextIndex, 0);
      updateQueueEstimate();
      notifyStatus();

      try {
        await workerLogContext.run({ accountUserId: activeUserId, accountName: activeUserId, delayLogId: null }, () => ownerContext.run(ownerId, () => accountContext.run(next.index, () => run(
          { ...config, cookie: next.cookie, proxy: config.accountProxies[next.index] || "" },
          state,
          next.index + 1,
          totalAccounts,
          tasks,
          startIndex
        ))));
      } finally {
        state.activeWorkers = Math.max(state.activeWorkers - 1, 0);
        if (activeUserId) {
          state.activeAccountUserIds = state.activeAccountUserIds.filter((userId) => userId !== activeUserId);
          const progress = state.accountProgress[activeUserId];
          if (progress) {
            progress.running = false;
          }
        }
        if (state.earlyReleasedWorkerSlots > 0) {
          state.earlyReleasedWorkerSlots -= 1;
        } else {
          releaseWorkerSlot();
        }
        state.queuedWorkers = Math.max(totalAccounts - nextIndex, 0);
        updateQueueEstimate();
        notifyStatus();
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
    log(state, state.stopRequested ? "warn" : "success", state.stopRequested ? "Bot đã dừng." : "Tất cả luồng đã chạy hoàn tất.");
  } finally {
    if (state.runToken !== runToken) {
      return;
    }
    state.running = false;
    state.paused = false;
    state.activeWorkers = 0;
    state.queuedWorkers = 0;
    state.nextQueuePosition = null;
    state.estimatedNextStartAt = null;
    state.activeAccountUserIds = [];
    for (const progress of Object.values(state.accountProgress)) {
      progress.running = false;
    }
    state.finishedAt = new Date().toISOString();
    const allCompleted = job.tasksByAccount.every(
      (tasks, index) => (job.completedByAccount[index] ?? 0) >= tasks.length
    );
    if (!state.stopRequested && allCompleted) {
      getJobs().delete(ownerId);
      await writeCurrentJob(ownerId, null);
      await syncObservedRunningJobs();
    }
    notifyStatus();
  }
}
export function validateConfig(raw: unknown): BotConfig {
  const body = raw as Partial<BotConfig> & {
    comments?: unknown;
    groupComments?: unknown;
    reactions?: unknown;
    groupLinks?: unknown;
    groupPostContents?: unknown;
    groupCommentKeyword?: unknown;
    delaySeconds?: unknown;
  };
  const cookie = typeof body.cookie === "string" ? body.cookie.trim() : "";
  const cookieList = cookie
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const accountProxies = Array.isArray(body.accountProxies)
    ? body.accountProxies.map((item) => typeof item === "string" ? item.trim() : "")
    : [];
  const legacyDelaySeconds = Number(body.delaySeconds ?? 5);
  const reactDelaySeconds = Number(body.reactDelaySeconds ?? legacyDelaySeconds);
  const commentDelaySeconds = Number(body.commentDelaySeconds ?? legacyDelaySeconds);
  const groupDelaySeconds = Number(body.groupDelaySeconds ?? legacyDelaySeconds);
  const groupPostDelaySeconds = Number(body.groupPostDelaySeconds ?? legacyDelaySeconds);
  const pokesDelaySeconds = Number(body.pokesDelaySeconds ?? legacyDelaySeconds);
  const enableReact = Boolean(body.enableReact);
  const enableComment = Boolean(body.enableComment);
  const enableGroup = Boolean(body.enableGroup);
  const enableGroupComment = Boolean(body.enableGroupComment);
  const enableGroupPost = Boolean(body.enableGroupPost);
  const enablePokes = Boolean(body.enablePokes);
  const headlessChrome = body.headlessChrome !== false;
  const lowResourceMode = body.lowResourceMode !== false;
  const reactCount = Number(body.reactCount ?? body.totalPosts ?? 0);
  const comments = Array.isArray(body.comments) ? body.comments.filter((item): item is string => typeof item === "string") : [];
  const groupComments = Array.isArray(body.groupComments)
    ? body.groupComments.filter((item): item is string => typeof item === "string")
    : comments;
  const groupPostContents = Array.isArray(body.groupPostContents)
    ? body.groupPostContents.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const groupPostTargetMode = body.groupPostTargetMode === "keyword" ? "keyword" : "links";
  const groupPostKeyword = typeof body.groupPostKeyword === "string" ? body.groupPostKeyword.trim() : "";
  const groupPostLinks = Array.isArray(body.groupPostLinks)
    ? body.groupPostLinks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(normalizeFacebookGroupUrl)
    : [];
  const reactions = Array.isArray(body.reactions)
    ? body.reactions.filter((item): item is string => typeof item === "string" && item in reactionXpaths)
    : [];
  const groupMode = body.groupMode === "keyword" ? "keyword" : "links";
  const groupLinks = Array.isArray(body.groupLinks)
    ? body.groupLinks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(normalizeFacebookGroupUrl)
    : [];
  const groupKeyword = typeof body.groupKeyword === "string" ? body.groupKeyword.trim() : "";
  const commentCount = Number(body.commentCount ?? 0);
  const groupCount = Number(body.groupCount ?? 0);
  const groupCommentCount = Number(body.groupCommentCount ?? 0);
  const groupPostCount = Number(body.groupPostCount ?? 0);
  const pokesCount = Number(body.pokesCount ?? 0);
  const groupCommentDelaySeconds = Number(body.groupCommentDelaySeconds ?? legacyDelaySeconds);
  const groupCommentKeyword = typeof body.groupCommentKeyword === "string" ? body.groupCommentKeyword.trim() : "";

  if (!cookie) {
    throw new Error("Vui lòng nhập cookie Facebook.");
  }

  if (cookieList.length === 0) {
    throw new Error("Vui lòng nhập ít nhất một cookie Facebook.");
  }

  const invalidCookieIndex = cookieList.findIndex((item) => !/c_user=\d+/.test(item));
  if (invalidCookieIndex >= 0) {
    throw new Error(`Cookie dòng ${invalidCookieIndex + 1} cần có c_user.`);
  }

  if (!enableReact && !enableComment && !enableGroup && !enableGroupComment && !enableGroupPost && !enablePokes) {
    throw new Error("Hãy tích ít nhất một mục: reaction, comment, join group, comment group, đăng bài group hoặc chọc bạn bè.");
  }

  for (const [label, value, enabled] of [
    ["reaction", reactCount, enableReact],
    ["comment", commentCount, enableComment],
    ["group", groupCount, enableGroup],
    ["comment group", groupCommentCount, enableGroupComment],
    ["đăng bài group", groupPostCount, enableGroupPost],
    ["chọc bạn bè", pokesCount, enablePokes]
  ] as const) {
    if (enabled && (!Number.isInteger(value) || value < 1 || value > 500)) {
      throw new Error(`Số lượng ${label} phải từ 1 đến 500.`);
    }
  }

  for (const [label, value] of [
    ["reaction", reactDelaySeconds],
    ["comment", commentDelaySeconds],
    ["join group", groupDelaySeconds],
    ["comment group", groupCommentDelaySeconds],
    ["đăng group", groupPostDelaySeconds],
    ["chọc bạn bè", pokesDelaySeconds]
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 3600) {
      throw new Error(`Delay ${label} phải từ 0 đến 3600 giây.`);
    }
  }

  if (enableReact && reactions.length === 0) {
    throw new Error("Bạn đã bật reaction nhưng chưa chọn loại cảm xúc.");
  }

  if (enableComment && comments.length === 0) {
    throw new Error("Bạn đã bật comment nhưng chưa nhập nội dung comment.");
  }

  if (enableGroupPost && groupPostContents.length === 0) {
    throw new Error("Bạn đã bật đăng bài group nhưng chưa nhập nội dung bài đăng.");
  }

  if (enableGroupPost && groupPostTargetMode === "keyword" && groupPostKeyword.length < 2) {
    throw new Error("Keyword group cần ít nhất 2 ký tự.");
  }

  if (enableComment && (!Number.isInteger(commentCount) || commentCount < 1 || commentCount > 500)) {
    throw new Error("Số lượng comment phải từ 1 đến 500.");
  }

  if (enableGroup && (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > 500)) {
    throw new Error("Số lượng group phải từ 1 đến 500.");
  }

  if (enableGroupComment && groupComments.length === 0) {
    throw new Error("Bạn đã bật comment group nhưng chưa nhập nội dung comment group.");
  }

  if (enableGroupComment && (!Number.isInteger(groupCommentCount) || groupCommentCount < 1 || groupCommentCount > 500)) {
    throw new Error("Số lượng comment group phải từ 1 đến 500.");
  }

  if (enableGroupComment && groupCommentKeyword.length > 0 && groupCommentKeyword.length < 2) {
    throw new Error("Keyword comment group cần ít nhất 2 ký tự.");
  }

  if (enableGroupPost && (!Number.isInteger(groupPostCount) || groupPostCount < 1 || groupPostCount > 500)) {
    throw new Error("Số lượng bài đăng group phải từ 1 đến 500.");
  }

  if (enableGroupPost && groupPostTargetMode === "links" && groupPostLinks.length === 0) {
    throw new Error("Bạn đã bật đăng group nhưng chưa nhập link group.");
  }

  if (enableGroup && groupMode === "links" && groupLinks.length === 0) {
    throw new Error("Bạn đã bật group nhưng chưa nhập link group.");
  }

  if (enableGroup && groupMode === "keyword" && groupKeyword.length < 2) {
    throw new Error("Keyword group cần ít nhất 2 ký tự.");
  }

  const totalPosts =
    (enableReact ? reactCount : 0) +
    (enableComment ? commentCount : 0) +
    (enableGroup ? groupCount : 0) +
    (enableGroupComment ? groupCommentCount : 0) +
    (enableGroupPost ? groupPostCount : 0) +
    (enablePokes ? pokesCount : 0);

  if (totalPosts > 500) {
    throw new Error("Tổng tác vụ không được vượt quá 500.");
  }

  return {
    cookie,
    cookieList,
    accountProxies,
    enableReact,
    enableComment,
    enableGroup,
    enableGroupComment,
    enableGroupPost,
    enablePokes,
    headlessChrome,
    lowResourceMode,
    totalPosts,
    reactCount: enableReact ? reactCount : 0,
    commentCount: enableComment ? commentCount : 0,
    groupCount: enableGroup ? groupCount : 0,
    groupCommentCount: enableGroupComment ? groupCommentCount : 0,
    groupPostCount: enableGroupPost ? groupPostCount : 0,
    pokesCount: enablePokes ? pokesCount : 0,
    reactDelaySeconds,
    commentDelaySeconds,
    groupDelaySeconds,
    groupCommentDelaySeconds,
    groupPostDelaySeconds,
    pokesDelaySeconds,
    randomizeTasks: Boolean(body.randomizeTasks),
    comments,
    groupComments,
    groupCommentKeyword,
    groupPostContents,
    groupPostTargetMode,
    groupPostKeyword,
    groupPostLinks,
    reactions,
    groupMode,
    groupLinks,
    groupKeyword,
    refreshGroupPostLinks: Boolean(body.refreshGroupPostLinks)
  };
}
export async function startBot(ownerId: number, config: BotConfig) {
  return ownerContext.run(ownerId, async () => {
    resumeCheckedOwners.add(ownerId);
    const current = getState(ownerId);
    if (current.running) {
      throw new Error("Bot đang chạy.");
    }

    await reserveFacebookAutoAutomationUsage(ownerId, 1);

    if (current.driver) {
      void current.driver.quit().catch(() => undefined);
    }

    const maxWorkers = await syncWorkerSemaphoreRuntime();
    const state = resetState(config, maxWorkers);
    const cookies = config.cookieList.length > 0 ? config.cookieList : [config.cookie];
    const job: PersistedJob = {
      config,
      tasksByAccount: cookies.map(() => buildTasks(config)),
      completedByAccount: cookies.map(() => 0),
      status: "running",
      startedAt: state.startedAt ?? new Date().toISOString()
    };
    getJobs().set(ownerId, job);
    await writeCurrentJob(ownerId, job);
    await syncObservedRunningJobs();
    void runQueued(ownerId, config, state, job, state.runToken);
    return snapshot(ownerId);
  });
}

export async function stopBot(ownerId: number) {
  return ownerContext.run(ownerId, async () => {
    const state = getState(ownerId);
    const activeWorkerCount = state.activeWorkers;
    state.stopRequested = true;
    state.paused = false;
    state.running = false;
    state.activeWorkers = 0;
    state.queuedWorkers = 0;
    state.nextQueuePosition = null;
    state.estimatedNextStartAt = null;
    state.activeAccountUserIds = [];
    for (const progress of Object.values(state.accountProgress)) {
      progress.running = false;
    }
    state.finishedAt = new Date().toISOString();
    state.runToken += 1;
    state.earlyReleasedWorkerSlots += activeWorkerCount;
    releaseWorkerSlotsNow(activeWorkerCount);
    log(state, "warn", "Đã dừng bot ngay lập tức.");
    for (const driver of state.activeDrivers) {
      void driver.quit().catch(() => undefined);
    }
    state.activeDrivers.clear();
    state.driver = undefined;
    getJobs().delete(ownerId);
    await writeCurrentJob(ownerId, null, "stopped");
    await syncObservedRunningJobs();
    notifyAllStatuses();
    notifyStatus(ownerId);
    return snapshot(ownerId);
  });
}

export async function clearBotResumeJob(ownerId: number) {
  return ownerContext.run(ownerId, async () => {
    const state = getState(ownerId);
    if (state.running) {
      throw new Error("Bot đang chạy. Hãy dừng bot trước khi xoá luồng.");
    }
    getJobs().delete(ownerId);
    await clearCurrentJob(ownerId);
    return snapshot(ownerId);
  });
}

export async function togglePauseBot(ownerId: number) {
  return ownerContext.run(ownerId, async () => {
    const state = getState(ownerId);
    if (!state.running) {
      throw new Error("Bot chưa chạy.");
    }
    state.paused = !state.paused;
    const job = getJob(ownerId);
    if (job) {
      log(state, "info", state.paused ? "Bot đã tạm dừng." : "Bot tiếp tục chạy.");
      await writeCurrentJob(ownerId, job);
    }
    log(state, "info", state.paused ? "Bot đã tạm dừng." : "Bot tiếp tục chạy.");
    notifyStatus(ownerId);
    return snapshot(ownerId);
  });
}

export function subscribeBotStatus(listener: BotStatusListener, ownerId?: number) {
  const listeners = getListeners(getOwnerId(ownerId));
  listeners.add(listener);
  void getBotStatus(ownerId).then(listener).catch(() => listener(snapshot(ownerId)));

  return () => {
    listeners.delete(listener);
  };
}

export function snapshot(ownerId?: number): BotSnapshot {
  const state = getState(getOwnerId(ownerId));
  const semaphore = getSemaphore();
  const systemActiveWorkers = Math.max(semaphore.active, semaphore.observedActive || 0);
  return {
    running: state.running,
    paused: state.paused,
    progress: state.progress,
    currentPost: state.currentPost,
    totalPosts: state.totalPosts,
    joinedGroups: state.joinedGroups,
    groupPosts: state.groupPosts,
    pokes: state.pokes,
    activeWorkers: systemActiveWorkers,
    queuedWorkers: Math.max(state.queuedWorkers, semaphore.queue.length),
    maxWorkers: semaphore.max || state.maxWorkers,
    nextQueuePosition: state.nextQueuePosition,
    estimatedNextStartAt: state.estimatedNextStartAt,
    activeAccountUserIds: [...state.activeAccountUserIds],
    accountProgress: { ...state.accountProgress },
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    account: state.account,
    logs: [...state.logs]
  };
}

export async function getBotStatus(ownerId?: number): Promise<BotSnapshot> {
  await ensureAutoResume(ownerId);
  const maxWorkers = await syncWorkerSemaphoreRuntime();
  const state = getState(getOwnerId(ownerId));
  if (!state.running) {
    state.maxWorkers = maxWorkers;
    state.queuedWorkers = 0;
    state.nextQueuePosition = null;
    state.estimatedNextStartAt = null;
  }
  return snapshot(ownerId);
}

export function bootstrapFacebookAutoResume() {
  if (!globalForBot.facebookAutoResumeBootstrapPromise) {
    globalForBot.facebookAutoResumeBootstrapPromise = (async () => {
      const ownerIds = await readResumableJobOwnerIds();
      if (ownerIds.length === 0) {
        await syncObservedRunningJobs();
        return;
      }

      await syncWorkerSemaphoreRuntime();
      await Promise.allSettled(ownerIds.map(async (ownerId) => {
        try {
          await ensureAutoResume(ownerId);
        } catch (error) {
          console.error(`Không thể tự resume Auto Facebook cho owner ${ownerId}:`, error);
        }
      }));
      await syncObservedRunningJobs();
    })();
  }

  return globalForBot.facebookAutoResumeBootstrapPromise;
}

async function ensureAutoResume(ownerId?: number) {
  const resolvedOwnerId = getOwnerId(ownerId);
  if (resumeCheckedOwners.has(resolvedOwnerId)) return;
  resumeCheckedOwners.add(resolvedOwnerId);
  const saved = await readCurrentJob(resolvedOwnerId);
  if (!saved) return;

  await ownerContext.run(resolvedOwnerId, async () => {
    const config = saved.config;
    const state = resetState(config, await syncWorkerSemaphoreRuntime());
    getJobs().set(resolvedOwnerId, saved);
    state.startedAt = saved.startedAt;
    state.completedTasks = saved.completedByAccount.reduce((sum, count) => sum + count, 0);
    state.currentPost = state.completedTasks;
    state.progress = state.totalPosts > 0 ? Math.round((state.completedTasks / state.totalPosts) * 100) : 0;
    state.paused = saved.status === "paused";
    log(state, "warn", `Server đã khởi động lại. Tiếp tục từ tác vụ ${state.currentPost + 1}/${state.totalPosts}.`);
    void runQueued(resolvedOwnerId, config, state, saved, state.runToken);
  });
}
