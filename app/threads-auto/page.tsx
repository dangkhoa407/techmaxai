"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Cookie, Download, Pencil, Pause, Play, Plus, Power, RotateCcw, Search, Settings2, Trash2, Upload, Zap } from "lucide-react";
import { AppFrame, PageHeader, StatCard } from "../components";
import { fetchUserProxies, getToken, type UserProxy } from "../lib/auth";
import { showToast } from "../lib/swal";
import { getFacebookAutoDeviceId } from "../facebook-auto/lib/device";

type ThreadsAccount = {
  id: string;
  name: string;
  username: string;
  threadsId: string;
  userId?: string;
  threadsName?: string | null;
  proxy?: string | null;
  status: "active" | "checkpoint" | "invalid" | "unknown";
  sessionPreview?: string;
  cookiePreview?: string;
  createdAt: string;
  updatedAt: string;
};

type ThreadsLog = {
  id: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  createdAt: string;
};

type SaveThreadsAccountsResult = {
  accounts: ThreadsAccount[];
  savedCount?: number;
  skipped?: Array<{ line: number; status?: ThreadsAccount["status"]; reason: string }>;
};

type RunThreadsAutoResult = {
  status?: ThreadsAutoStatus;
};

type ThreadsAutoStatus = {
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
  logs: ThreadsLog[];
};

type ThreadsAutoSettings = {
  enableGroupPost: boolean;
  enableFeedComment: boolean;
  enableSearchComment: boolean;
  groupPostCount: number;
  feedCommentCount: number;
  searchCommentCount: number;
  groupPostDelaySeconds: number;
  feedCommentDelaySeconds: number;
  searchCommentDelaySeconds: number;
  randomizeTasks: boolean;
  groupPostTopic: string;
  groupPostContentDraft: string;
  groupPostItems: string[];
  feedComments: string;
  searchKeyword: string;
  searchComments: string;
};

type TaskModal = "groupPost" | "feedComment" | "searchComment" | null;

const MAX_TOTAL_ACTIONS = 500;
const GROUP_POST_PAGE_SIZE = 5;

const initialLogs: ThreadsLog[] = [];

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseImportedPostItems(text: string) {
  const items: string[] = [];
  let current: string[] = [];

  function flush() {
    const item = current.join("\n").replace(/^Nội dung\s+\d+\s*/i, "").trim();
    if (item) items.push(item);
    current = [];
  }

  for (const line of text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if (/^\s*-{10,}\s*$/.test(line)) {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();

  return items;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || "Không thể xử lý yêu cầu.");
  }
  return data as T;
}

function authHeaders(extra?: HeadersInit) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

function statusLabel(status?: ThreadsAccount["status"], running?: boolean) {
  if (running) return "Đang chạy bot";
  if (status === "active") return "Hoạt động";
  if (status === "checkpoint") return "Checkpoint";
  if (status === "invalid") return "Die";
  return "Không xác định";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="facebook-auto-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function ThreadsAutoPage() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [proxies, setProxies] = useState<UserProxy[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [sessionInput, setSessionInput] = useState("");
  const [editAccount, setEditAccount] = useState<ThreadsAccount | null>(null);
  const [editSession, setEditSession] = useState("");
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [exportPreviewContent, setExportPreviewContent] = useState("");
  const [exportPreviewFileName, setExportPreviewFileName] = useState("");
  const [showExportPreviewModal, setShowExportPreviewModal] = useState(false);
  const [activeTaskModal, setActiveTaskModal] = useState<TaskModal>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountBusy, setAccountBusy] = useState(false);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [enableGroupPost, setEnableGroupPost] = useState(true);
  const [enableFeedComment, setEnableFeedComment] = useState(false);
  const [enableSearchComment, setEnableSearchComment] = useState(false);
  const [groupPostCount, setGroupPostCount] = useState(1);
  const [feedCommentCount, setFeedCommentCount] = useState(1);
  const [searchCommentCount, setSearchCommentCount] = useState(1);
  const [groupPostDelaySeconds, setGroupPostDelaySeconds] = useState(5);
  const [feedCommentDelaySeconds, setFeedCommentDelaySeconds] = useState(5);
  const [searchCommentDelaySeconds, setSearchCommentDelaySeconds] = useState(5);
  const [randomizeTasks, setRandomizeTasks] = useState(false);

  const [groupPostTopic, setGroupPostTopic] = useState("");
  const [groupPostContentDraft, setGroupPostContentDraft] = useState("");
  const [groupPostItems, setGroupPostItems] = useState<string[]>([]);
  const [selectedGroupPostIndexes, setSelectedGroupPostIndexes] = useState<number[]>([]);
  const [groupPostPage, setGroupPostPage] = useState(1);
  const [feedComments, setFeedComments] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchComments, setSearchComments] = useState("");

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState(0);
  const [runtimeTotalActions, setRuntimeTotalActions] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [maxWorkers, setMaxWorkers] = useState(5);
  const [queuedWorkers, setQueuedWorkers] = useState(0);
  const [runtimeAccountUserIds, setRuntimeAccountUserIds] = useState<string[]>([]);
  const [runtimeAccountProgress, setRuntimeAccountProgress] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<ThreadsLog[]>(initialLogs);
  const [message, setMessage] = useState("Sẵn sàng.");
  const timerRef = useRef<number | null>(null);
  const logIdRef = useRef(1);
  const groupPostImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadAccounts();
    loadProxies();
    loadSettings();
    loadRuntimeSettings();
    loadRuntimeStatus();
  }, []);

  async function loadAccounts() {
    setAccountsLoading(true);
    try {
      const data = await readJson<{ accounts: ThreadsAccount[] }>(
        await fetch("/api/threads-auto/accounts", { headers: authHeaders() })
      );
      setAccounts(data.accounts || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải tài khoản Threads.");
    } finally {
      setAccountsLoading(false);
    }
  }

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );
  const activeSelectedAccounts = useMemo(
    () => selectedAccounts.filter((account) => account.status === "active"),
    [selectedAccounts]
  );
  const feedCommentList = useMemo(() => lines(feedComments), [feedComments]);
  const searchCommentList = useMemo(() => lines(searchComments), [searchComments]);
  const searchKeywordList = useMemo(() => lines(searchKeyword), [searchKeyword]);
  const groupPostTopicList = useMemo(() => lines(groupPostTopic), [groupPostTopic]);
  const groupPostPageCount = Math.max(1, Math.ceil(groupPostItems.length / GROUP_POST_PAGE_SIZE));
  const pagedGroupPostItems = useMemo(
    () => groupPostItems.slice((groupPostPage - 1) * GROUP_POST_PAGE_SIZE, groupPostPage * GROUP_POST_PAGE_SIZE),
    [groupPostItems, groupPostPage]
  );
  const totalActions = useMemo(
    () => (enableGroupPost ? groupPostCount : 0) + (enableFeedComment ? feedCommentCount : 0) + (enableSearchComment ? searchCommentCount : 0),
    [enableFeedComment, enableGroupPost, enableSearchComment, feedCommentCount, groupPostCount, searchCommentCount]
  );
  const totalActionsExceeded = totalActions > MAX_TOTAL_ACTIONS;
  const runtimeTotal = runtimeTotalActions || (running ? activeSelectedAccounts.length * totalActions : totalActions);
  const workerHelp = running
    ? queuedWorkers > 0
      ? `${queuedWorkers} tài khoản đang đợi`
      : "Không có tài khoản chờ"
    : "Dùng chung giới hạn luồng với Facebook";
  const estimatedCompletion = running
    ? paused
      ? "Phiên đang tạm dừng."
      : `Đang xử lý tác vụ ${currentAction}/${runtimeTotal || 0}.`
    : "Chưa có phiên đang chạy.";

  useEffect(() => {
    if (!settingsLoaded) return;
    setSettingsSaveState("saving");
    const timer = window.setTimeout(() => saveSettings(), 700);
    return () => window.clearTimeout(timer);
  }, [
    settingsLoaded,
    enableGroupPost,
    enableFeedComment,
    enableSearchComment,
    groupPostCount,
    feedCommentCount,
    searchCommentCount,
    groupPostDelaySeconds,
    feedCommentDelaySeconds,
    searchCommentDelaySeconds,
    randomizeTasks,
    groupPostTopic,
    groupPostContentDraft,
    groupPostItems,
    feedComments,
    searchKeyword,
    searchComments
  ]);

  useEffect(() => {
    setGroupPostPage((current) => Math.min(Math.max(current, 1), groupPostPageCount));
  }, [groupPostPageCount]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const events = new EventSource(`/api/threads-auto/events?token=${encodeURIComponent(token)}`);
    events.onmessage = (event) => {
      const result = JSON.parse(event.data) as { ok: boolean; status?: ThreadsAutoStatus };
      if (result.ok && result.status) applyRuntimeStatus(result.status);
    };
    return () => events.close();
  }, []);

  function applyRuntimeStatus(status: ThreadsAutoStatus) {
    setRunning(status.running);
    setPaused(status.paused);
    setProgress(status.progress);
    setCurrentAction(status.currentPost);
    setRuntimeTotalActions(status.totalPosts || 0);
    setActiveWorkers(status.activeWorkers || 0);
    setMaxWorkers(status.maxWorkers || 5);
    setQueuedWorkers(status.queuedWorkers || 0);
    setRuntimeAccountUserIds(status.activeAccountUserIds || []);
    setRuntimeAccountProgress(status.accountProgress || {});
    setLogs(status.logs);
    if (status.running) {
      setMessage(`Bot Threads đang chạy ${status.currentPost}/${status.totalPosts} tác vụ.`);
    } else if (status.finishedAt) {
      setMessage(`Bot Threads đã chạy xong ${status.currentPost}/${status.totalPosts} tác vụ.`);
    }
  }

  function pushLog(level: ThreadsLog["level"], text: string) {
    setLogs((current) => [
      { id: logIdRef.current++, level, message: text, createdAt: new Date().toISOString() },
      ...current
    ].slice(0, 120));
  }

  function currentSettings(): ThreadsAutoSettings {
    return {
      enableGroupPost,
      enableFeedComment,
      enableSearchComment,
      groupPostCount,
      feedCommentCount,
      searchCommentCount,
      groupPostDelaySeconds,
      feedCommentDelaySeconds,
      searchCommentDelaySeconds,
      randomizeTasks,
      groupPostTopic,
      groupPostContentDraft,
      groupPostItems,
      feedComments,
      searchKeyword,
      searchComments
    };
  }

  async function loadSettings() {
    const token = getToken();
    if (!token) {
      setSettingsLoaded(true);
      return;
    }
    try {
      const data = await readJson<{ settings?: Partial<ThreadsAutoSettings> | null }>(
        await fetch("/api/threads-auto/settings", {
          headers: authHeaders(),
          cache: "no-store"
        })
      );
      const saved = data.settings;
      if (saved) {
        if (typeof saved.enableGroupPost === "boolean") setEnableGroupPost(saved.enableGroupPost);
        if (typeof saved.enableFeedComment === "boolean") setEnableFeedComment(saved.enableFeedComment);
        if (typeof saved.enableSearchComment === "boolean") setEnableSearchComment(saved.enableSearchComment);
        if (Number.isFinite(saved.groupPostCount)) setGroupPostCount(Number(saved.groupPostCount));
        if (Number.isFinite(saved.feedCommentCount)) setFeedCommentCount(Number(saved.feedCommentCount));
        if (Number.isFinite(saved.searchCommentCount)) setSearchCommentCount(Number(saved.searchCommentCount));
        if (Number.isFinite(saved.groupPostDelaySeconds)) setGroupPostDelaySeconds(Number(saved.groupPostDelaySeconds));
        if (Number.isFinite(saved.feedCommentDelaySeconds)) setFeedCommentDelaySeconds(Number(saved.feedCommentDelaySeconds));
        if (Number.isFinite(saved.searchCommentDelaySeconds)) setSearchCommentDelaySeconds(Number(saved.searchCommentDelaySeconds));
        if (typeof saved.randomizeTasks === "boolean") setRandomizeTasks(saved.randomizeTasks);
        if (typeof saved.groupPostTopic === "string") setGroupPostTopic(saved.groupPostTopic);
        if (typeof saved.groupPostContentDraft === "string") setGroupPostContentDraft(saved.groupPostContentDraft);
        if (Array.isArray(saved.groupPostItems)) {
          setGroupPostItems(parseImportedPostItems(saved.groupPostItems.filter((item): item is string => typeof item === "string").join("\n------------------------------\n")));
        }
        if (typeof saved.feedComments === "string") setFeedComments(saved.feedComments);
        if (typeof saved.searchKeyword === "string") setSearchKeyword(saved.searchKeyword);
        if (typeof saved.searchComments === "string") setSearchComments(saved.searchComments);
      }
      setSettingsSaveState("saved");
    } catch (error) {
      setSettingsSaveState("error");
      setMessage(error instanceof Error ? error.message : "Không thể tải cấu hình Auto Threads.");
    } finally {
      setSettingsLoaded(true);
    }
  }

  async function loadProxies() {
    const token = getToken();
    if (!token) {
      setProxies([]);
      return;
    }
    try {
      const items = await fetchUserProxies();
      setProxies(items.filter((item) => item.status === "active"));
    } catch {
      setProxies([]);
    }
  }

  async function loadRuntimeSettings() {
    const token = getToken();
    if (!token) return;
    try {
      const data = await readJson<{ settings?: { max_workers?: number } }>(
        await fetch("/api/facebook-auto/system-settings", {
          headers: authHeaders(),
          cache: "no-store"
        })
      );
      const workers = Number(data.settings?.max_workers);
      if (Number.isFinite(workers)) setMaxWorkers(Math.min(Math.max(Math.floor(workers), 1), 100));
    } catch {
      setMaxWorkers(5);
    }
  }

  async function loadRuntimeStatus() {
    const token = getToken();
    if (!token) return;
    try {
      const data = await readJson<RunThreadsAutoResult>(
        await fetch("/api/threads-auto/status", {
          headers: authHeaders(),
          cache: "no-store"
        })
      );
      if (data.status) applyRuntimeStatus(data.status);
    } catch {
      // Trạng thái realtime vẫn sẽ được đồng bộ qua EventSource.
    }
  }
  async function saveSettings() {
    const token = getToken();
    if (!token) {
      setSettingsSaveState("error");
      return;
    }
    try {
      await readJson<{ success?: boolean }>(
        await fetch("/api/threads-auto/settings", {
          method: "PUT",
          headers: authHeaders({
            "Content-Type": "application/json",
            "x-facebook-auto-device-id": getFacebookAutoDeviceId()
          }),
          body: JSON.stringify({ settings: currentSettings() })
        })
      );
      setSettingsSaveState("saved");
    } catch (error) {
      setSettingsSaveState("error");
      setMessage(error instanceof Error ? error.message : "Không thể lưu cấu hình Auto Threads.");
    }
  }

  async function addAccount() {
    const session = sessionInput.trim();
    if (!session) {
      setMessage("Vui lòng nhập cookie Threads.");
      return;
    }
    setAccountBusy(true);
    setMessage("Đang check live cookie Threads...");
    try {
      const data = await readJson<SaveThreadsAccountsResult>(
        await fetch("/api/threads-auto/accounts", {
          method: "POST",
          headers: authHeaders({
            "Content-Type": "application/json",
            "x-facebook-auto-device-id": getFacebookAutoDeviceId()
          }),
          body: JSON.stringify({ cookies: session })
        })
      );
      setAccounts(data.accounts || []);
      const newest = data.accounts?.[0];
      if (newest) setSelectedAccountIds((current) => current.includes(newest.id) ? current : [newest.id, ...current]);
      setSessionInput("");
      setShowAddAccountModal(false);
      setMessage("Đã thêm tài khoản Threads.");
      showToast(`Đã lưu ${data.savedCount || 0} tài khoản Threads live.`);
      if (data.skipped?.length) {
        showToast(`${data.skipped.length} cookie Threads die/không live nên không lưu.`, "warning");
      }
      pushLog(newest?.status === "active" ? "success" : "warn", `Check live ${newest?.name || "Threads"}: ${statusLabel(newest?.status)}.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể thêm tài khoản Threads.";
      setMessage(text);
      showToast(text, "error");
      pushLog("error", text);
    } finally {
      setAccountBusy(false);
    }
  }

  function openEditAccountModal(account: ThreadsAccount) {
    setEditAccount(account);
    setEditSession("");
    setShowEditAccountModal(true);
  }

  async function saveEditedAccount() {
    if (!editAccount) return;
    const session = editSession.trim();
    if (!session) {
      setMessage("Vui lòng nhập cookie mới.");
      return;
    }
    setAccountBusy(true);
    setMessage("Đang cập nhật và check live cookie Threads...");
    try {
      const data = await readJson<{ accounts: ThreadsAccount[] }>(
        await fetch("/api/threads-auto/accounts", {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ id: editAccount.id, cookie: session })
        })
      );
      setAccounts(data.accounts || []);
      const updated = data.accounts?.find((account) => account.id === editAccount.id);
      setShowEditAccountModal(false);
      setEditAccount(null);
      setEditSession("");
      setMessage("Đã cập nhật cookie Threads.");
      pushLog(updated?.status === "active" ? "success" : "warn", `Cập nhật ${updated?.name || editAccount.name}: ${statusLabel(updated?.status)}.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể cập nhật cookie Threads.";
      setMessage(text);
      pushLog("error", text);
    } finally {
      setAccountBusy(false);
    }
  }

  async function deleteAccount(id: string) {
    setAccountBusy(true);
    try {
      const data = await readJson<{ accounts: ThreadsAccount[] }>(
        await fetch("/api/threads-auto/accounts", {
          method: "DELETE",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ id })
        })
      );
      setAccounts(data.accounts || []);
      setSelectedAccountIds((current) => current.filter((accountId) => accountId !== id));
      setMessage("Đã xoá tài khoản Threads.");
      pushLog("warn", "Đã xoá tài khoản Threads khỏi danh sách.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xoá tài khoản Threads.");
    } finally {
      setAccountBusy(false);
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((current) => current.includes(id) ? current.filter((accountId) => accountId !== id) : [...current, id]);
  }

  async function updateAccountProxy(account: ThreadsAccount, proxy: string) {
    const previousAccounts = accounts;
    setAccountBusy(true);
    setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, proxy: proxy || null } : item));
    try {
      const data = await readJson<{ accounts: ThreadsAccount[] }>(
        await fetch("/api/threads-auto/accounts", {
          method: "PUT",
          headers: authHeaders({
            "Content-Type": "application/json",
            "x-facebook-auto-device-id": getFacebookAutoDeviceId()
          }),
          body: JSON.stringify({ id: account.id, proxy })
        })
      );
      setAccounts(data.accounts || []);
      showToast(proxy ? "Đã áp dụng proxy cho tài khoản Threads." : "Đã bỏ proxy khỏi tài khoản Threads.");
    } catch (error) {
      setAccounts(previousAccounts);
      const text = error instanceof Error ? error.message : "Không thể cập nhật proxy tài khoản Threads.";
      setMessage(text);
      showToast(text, "error");
    } finally {
      setAccountBusy(false);
    }
  }

  async function checkLiveAccount(id: string) {
    const accountName = accounts.find((account) => account.id === id)?.name || id;
    setCheckingIds([id]);
    setMessage(`Đang check live ${accountName}.`);
    try {
      const data = await readJson<{ accounts: ThreadsAccount[] }>(
        await fetch("/api/threads-auto/accounts", {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ id })
        })
      );
      const latest = data.accounts || accounts;
      setAccounts(latest);
      const account = latest.find((item) => item.id === id);
      const text = `Check live ${account?.name || accountName}: ${statusLabel(account?.status)}.`;
      setMessage(text);
      pushLog(account?.status === "active" ? "success" : "error", text);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể check live tài khoản Threads.";
      setMessage(text);
      pushLog("error", text);
    } finally {
      setCheckingIds([]);
    }
  }

  async function checkLiveSelectedAccounts() {
    if (!selectedAccountIds.length) {
      setMessage("Hãy chọn ít nhất một tài khoản Threads.");
      return;
    }
    setCheckingIds(selectedAccountIds);
    setMessage(`Đang check live ${selectedAccountIds.length} tài khoản Threads...`);
    try {
      let latest = accounts;
      for (const id of selectedAccountIds) {
        const data = await readJson<{ accounts: ThreadsAccount[] }>(
          await fetch("/api/threads-auto/accounts", {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ id })
          })
        );
        latest = data.accounts || latest;
        setAccounts(latest);
        const account = latest.find((item) => item.id === id);
        pushLog(account?.status === "active" ? "success" : "error", `Check live ${account?.name || id}: ${statusLabel(account?.status)}.`);
      }
      setMessage(`Đã check live ${selectedAccountIds.length} tài khoản Threads.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể check live tài khoản Threads.";
      setMessage(text);
      pushLog("error", text);
    } finally {
      setCheckingIds([]);
    }
  }

  async function exportSelectedAccounts() {
    if (!selectedAccountIds.length) {
      setMessage("Hãy chọn ít nhất một tài khoản để xuất.");
      return;
    }
    setAccountBusy(true);
    setMessage(`Đang tạo dữ liệu xuất ${selectedAccountIds.length} tài khoản Threads...`);
    try {
      const data = await readJson<{ content: string; count: number }>(
        await fetch("/api/threads-auto/accounts/export", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ ids: selectedAccountIds })
        })
      );
      setExportPreviewContent(data.content || "");
      setExportPreviewFileName(`threads-auto-accounts-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
      setShowExportPreviewModal(true);
      setMessage(`Đã tạo dữ liệu xuất ${data.count} tài khoản Threads.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể xuất dữ liệu tài khoản Threads.";
      setMessage(text);
      showToast(text, "error");
    } finally {
      setAccountBusy(false);
    }
  }

  function downloadExportPreview() {
    if (!exportPreviewContent || !exportPreviewFileName) return;
    const blob = new Blob([exportPreviewContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportPreviewFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addGroupPostContent() {
    const content = groupPostContentDraft.trim();
    if (!content) {
      setMessage("Nhập nội dung bài đăng trước khi thêm.");
      return;
    }
    setGroupPostItems((current) => {
      const next = [...current, content];
      setGroupPostPage(Math.max(1, Math.ceil(next.length / GROUP_POST_PAGE_SIZE)));
      return next;
    });
    setGroupPostContentDraft("");
    setMessage("Đã thêm nội dung bài đăng group Threads.");
  }

  function exportGroupPostContents() {
    if (!groupPostItems.length) {
      setMessage("Chưa có nội dung bài đăng để xuất.");
      return;
    }
    const content = groupPostItems.join("\n\n------------------------------\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `threads-post-contents-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Đã xuất ${groupPostItems.length} nội dung bài đăng Threads.`);
  }

  async function importGroupPostContents(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const text = await file.text();
    const importedItems = parseImportedPostItems(text);
    if (!importedItems.length) {
      setMessage("File không có nội dung bài đăng hợp lệ.");
      return;
    }
    setGroupPostItems((current) => {
      const next = [...current, ...importedItems];
      setGroupPostPage(Math.max(1, Math.ceil(next.length / GROUP_POST_PAGE_SIZE)));
      return next;
    });
    setMessage(`Đã nhập ${importedItems.length} nội dung bài đăng Threads.`);
  }

  function toggleGroupPostContentSelection(index: number) {
    setSelectedGroupPostIndexes((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  function selectAllGroupPostContents() {
    setSelectedGroupPostIndexes(groupPostItems.map((_, index) => index));
  }

  function clearGroupPostContentSelection() {
    setSelectedGroupPostIndexes([]);
  }

  function removeSelectedGroupPostContents() {
    if (!selectedGroupPostIndexes.length) {
      setMessage("Chưa chọn nội dung để xoá.");
      return;
    }
    const selected = new Set(selectedGroupPostIndexes);
    setGroupPostItems((current) => {
      const next = current.filter((_, index) => !selected.has(index));
      setGroupPostPage(Math.min(Math.max(1, Math.ceil(next.length / GROUP_POST_PAGE_SIZE)), groupPostPage));
      return next;
    });
    setSelectedGroupPostIndexes([]);
    setMessage(`Đã xoá ${selected.size} nội dung bài đăng Threads.`);
  }

  function removeGroupPostContent(index: number) {
    setGroupPostItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedGroupPostIndexes([]);
  }

  function validateBeforeStart() {
    if (!activeSelectedAccounts.length) return "Chọn ít nhất một tài khoản Threads trạng thái hoạt động.";
    if (totalActionsExceeded) return `Tổng tác vụ không được vượt quá ${MAX_TOTAL_ACTIONS}.`;
    if (!totalActions) return "Bật ít nhất một tác vụ Threads.";
    if (enableGroupPost && !groupPostItems.length) return "Đăng Post cần ít nhất một nội dung bài đăng.";
    if (enableFeedComment && !feedCommentList.length) return "Comment newfeed cần danh sách comment.";
    if (enableSearchComment && !searchKeywordList.some((keyword) => keyword.length >= 2)) return "Comment search cần ít nhất 1 keyword từ 2 ký tự.";
    if (enableSearchComment && !searchCommentList.length) return "Comment search cần danh sách comment.";
    return "";
  }

  async function startBot() {
    const validation = validateBeforeStart();
    if (validation) {
      setMessage(validation);
      showToast(validation, "warning");
      pushLog("warn", validation);
      return;
    }
    setRunning(true);
    setPaused(false);
    setProgress(0);
    setCurrentAction(0);
    setRuntimeTotalActions(activeSelectedAccounts.length * totalActions);
    setActiveWorkers(0);
    setQueuedWorkers(Math.max(activeSelectedAccounts.length - maxWorkers, 0));
    setRuntimeAccountUserIds(activeSelectedAccounts.map((account) => account.userId || account.threadsId).filter(Boolean));
    setRuntimeAccountProgress(Object.fromEntries(activeSelectedAccounts.map((account) => [account.userId || account.threadsId, 0])));
    setLogs([]);
    setMessage("Bot Threads \u0111ang ch\u1ea1y t\u00e1c v\u1ee5.");

    try {
      const data = await readJson<RunThreadsAutoResult>(
        await fetch("/api/threads-auto/run", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            accountIds: activeSelectedAccounts.map((account) => account.id),
            enableGroupPost,
            enableFeedComment,
            enableSearchComment,
            randomizeTasks,
            groupPostCount,
            feedCommentCount,
            searchCommentCount,
            groupPostDelaySeconds,
            feedCommentDelaySeconds,
            searchCommentDelaySeconds,
            groupPostTopics: groupPostTopicList,
            groupPostContents: groupPostItems,
            feedComments: feedCommentList,
            searchKeyword,
            searchComments: searchCommentList
          })
        })
      );

      if (data.status) applyRuntimeStatus(data.status);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể chạy Auto Threads.";
      setMessage(text);
      showToast(text, "error");
      pushLog("error", text);
      setRunning(false);
      setPaused(false);
      setRuntimeTotalActions(0);
      setActiveWorkers(0);
      setQueuedWorkers(0);
      setRuntimeAccountUserIds([]);
      setRuntimeAccountProgress({});
    }
  }

  async function togglePauseBot() {
    try {
      const data = await readJson<RunThreadsAutoResult>(
        await fetch("/api/threads-auto/pause", {
          method: "POST",
          headers: authHeaders()
        })
      );
      if (data.status) applyRuntimeStatus(data.status);
      setMessage(data.status?.paused ? "Bot Threads đã tạm dừng." : "Bot Threads tiếp tục chạy.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể thay đổi trạng thái bot Threads.";
      setMessage(text);
      showToast(text, "error");
      pushLog("error", text);
    }
  }

  async function stopBot() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setPaused(false);
    setActiveWorkers(0);
    setQueuedWorkers(0);
    setRuntimeAccountUserIds([]);
    setRuntimeAccountProgress({});
    setMessage("Đang dừng bot Threads...");
    pushLog("warn", "Đã gửi yêu cầu dừng bot Threads.");
    try {
      const data = await readJson<RunThreadsAutoResult>(
        await fetch("/api/threads-auto/run", {
          method: "DELETE",
          headers: authHeaders()
        })
      );
      if (data.status) applyRuntimeStatus(data.status);
      setMessage("Đã gửi yêu cầu dừng bot Threads.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể dừng bot Threads.";
      setMessage(text);
      pushLog("error", text);
    }
  }

  async function clearResumeJob() {
    setMessage("Đang xoá luồng resume...");
    try {
      const data = await readJson<RunThreadsAutoResult>(
        await fetch("/api/threads-auto/clear", {
          method: "POST",
          headers: authHeaders()
        })
      );
      if (data.status) applyRuntimeStatus(data.status);
      setMessage("Đã xoá luồng resume.");
      showToast("Đã xoá luồng resume.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể xoá luồng resume Auto Threads.";
      setMessage(text);
      showToast(text, "error");
      pushLog("error", text);
    }
  }

  return (
    <AppFrame active="/threads-auto" title="Threads Auto">
      <PageHeader
        title="Auto Threads"
        desc="Lưu tài khoản bằng cookie, chọn tài khoản cần chạy, cấu hình tác vụ Threads và theo dõi tiến trình trong cùng một màn hình."
      />

      <form className="stack facebook-auto-page" onSubmit={(event) => event.preventDefault()}>
        <section className="grid-4">
          <StatCard label="Trạng thái" value={paused ? "Tạm dừng" : running ? "Đang chạy" : "Đang nghỉ"} help={message} icon="bolt" />
          <StatCard label="Tài khoản chọn" value={String(selectedAccounts.length)} help={selectedAccounts.length ? `${activeSelectedAccounts.length} tài khoản sẵn sàng chạy` : "Chưa chọn tài khoản"} icon="account_circle" />
          <StatCard label="Tiến độ" value={`${currentAction}/${runtimeTotal || 0}`} help={`${progress}% hoàn tất`} icon="monitoring" />
          <StatCard label="Luồng toàn hệ thống" value={`${activeWorkers}/${maxWorkers}`} help={workerHelp} icon="hub" />
        </section>

        <section className="card pad facebook-auto-progress-card">
          <div className="between">
            <div>
              <h2 style={{ margin: 0 }}>Tiến trình chạy</h2>
              <p className="facebook-auto-estimated-time">{estimatedCompletion}</p>
            </div>
            <strong>{progress}%</strong>
          </div>
          <div className="facebook-auto-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </section>

        <div className="facebook-auto-layout">
          <div className="stack">
            <section className="card pad facebook-auto-config-card">
              <div className="between facebook-auto-section-title">
                <div>
                  <h2><Cookie size={18} /> Tài khoản Threads</h2>
                  <p className="subtitle">Tài khoản phải ở trạng thái "Hoạt động" mới có thể chạy tác vụ .</p>
                </div>
                <button className="btn btn-secondary" type="button" disabled={running || accountBusy || showAddAccountModal} onClick={() => setShowAddAccountModal(true)}>
                  <Plus size={16} /> Thêm tài khoản
                </button>
              </div>

              <div className="facebook-auto-account-toolbar">
                <strong>Đã lưu {accounts.length} tài khoản</strong>
                <div className="row">
                  <button className="btn btn-secondary" disabled={!accounts.length} type="button" onClick={() => setSelectedAccountIds(accounts.map((account) => account.id))}>Chọn tất cả</button>
                  <button className="btn btn-secondary" disabled={!selectedAccountIds.length} type="button" onClick={() => setSelectedAccountIds([])}>Bỏ chọn</button>
                  <button className="btn btn-secondary" disabled={running || !selectedAccountIds.length || checkingIds.length > 0} type="button" onClick={checkLiveSelectedAccounts}><Zap size={16} /> {checkingIds.length ? "Đang check..." : "Check live đã chọn"}</button>
                  <button className="btn btn-secondary" disabled={!selectedAccountIds.length} type="button" onClick={exportSelectedAccounts}><Download size={16} /> Xuất dữ liệu</button>
                </div>
              </div>

              <div className="facebook-auto-account-table-wrap">
                {accountsLoading ? (
                  <div className="facebook-auto-empty-account">Đang tải tài khoản Threads...</div>
                ) : !accounts.length ? (
                  <div className="facebook-auto-empty-account">Chưa có tài khoản nào. Hãy thêm cookie Threads để check live và chạy tác vụ.</div>
                ) : (
                  <table className="facebook-auto-account-table">
                    <thead>
                      <tr>
                        <th>Chọn</th>
                        <th>ID</th>
                        <th>Tên Threads</th>
                        <th>Threads ID</th>
                        <th>Trạng thái</th>
                        <th>Tiến trình</th>
                        <th>Cookie</th>
                        <th>Proxy</th>
                        <th>Cập nhật</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => {
                        const accountRuntimeId = account.userId || account.threadsId;
                        const isRunning = running && runtimeAccountUserIds.includes(accountRuntimeId);
                        const isChecking = checkingIds.includes(account.id);
                        const accountProgress = isRunning ? Math.min(Math.max(Math.round(runtimeAccountProgress[accountRuntimeId] || 0), 0), 100) : 0;
                        const accountTotalActions = isRunning
                          ? Math.max(Math.round((runtimeTotalActions || 0) / Math.max(runtimeAccountUserIds.length, 1)), totalActions || 0)
                          : totalActions;
                        const accountDone = isRunning ? Math.round((accountProgress / 100) * accountTotalActions) : 0;
                        return (
                          <tr className={selectedAccountIds.includes(account.id) || isRunning ? "active" : ""} key={`${account.id}-${account.userId || account.threadsId || index}`}>
                            <td><input aria-label={`Chọn ${account.name}`} checked={selectedAccountIds.includes(account.id)} type="checkbox" onChange={() => toggleAccount(account.id)} /></td>
                            <td><strong>{index + 1}</strong></td>
                            <td>{account.name}</td>
                            <td>{account.threadsId || account.userId || "-"}</td>
                            <td><span className={`facebook-auto-account-status ${isChecking ? "checking" : isRunning ? "running" : account.status}`}>{isChecking ? "Đang check live" : statusLabel(account.status, isRunning)}</span></td>
                            <td>
                              <div className="facebook-auto-account-progress">
                                <div className="facebook-auto-account-progress-head"><strong>{accountProgress}%</strong><span>{accountDone}/{accountTotalActions || 0}</span></div>
                                <div className="facebook-auto-account-progress-bar"><span style={{ width: `${accountProgress}%` }} /></div>
                              </div>
                            </td>
                            <td className="facebook-auto-cookie-cell"><span title={account.sessionPreview || account.cookiePreview || ""}>{account.sessionPreview || account.cookiePreview || "Cookie đã lưu"}</span></td>
                            <td>
                              <select
                                className="facebook-auto-proxy-select"
                                value={account.proxy || ""}
                                disabled={running || accountBusy || checkingIds.includes(account.id)}
                                onChange={(event) => updateAccountProxy(account, event.target.value)}
                              >
                                <option value="">Không dùng proxy</option>
                                {account.proxy && !proxies.some((item) => item.proxy === account.proxy) ? (
                                  <option value={account.proxy}>{account.proxy}</option>
                                ) : null}
                                {proxies.map((item) => (
                                  <option value={item.proxy} key={item.id}>{item.name || item.proxy}</option>
                                ))}
                              </select>
                            </td>
                            <td>{new Date(account.updatedAt).toLocaleString("vi-VN")}</td>
                            <td>
                              <div className="row">
                                <button className="btn btn-secondary" disabled={running || accountBusy || checkingIds.length > 0} type="button" onClick={() => checkLiveAccount(account.id)}>
                                  {isChecking ? "Đang check..." : "Check live"}
                                </button>
                                <button className="btn btn-secondary" disabled={running || accountBusy || checkingIds.includes(account.id)} type="button" onClick={() => openEditAccountModal(account)}><Pencil size={16} /> Sửa cookie</button>
                                <button className="btn btn-secondary" disabled={running || accountBusy || checkingIds.includes(account.id)} type="button" onClick={() => deleteAccount(account.id)}><Trash2 size={16} /> Xoá</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {showAddAccountModal ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => !running && !accountBusy && setShowAddAccountModal(false)}>
                <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="threads-auto-add-account-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="threads-auto-add-account-title">Thêm tài khoản</div>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>Dán cookie Threads, mỗi dòng 1 cookie. Hệ thống chỉ lưu cookie live.</p>
                    </div>
                    <button className="icon-btn" type="button" aria-label="Đóng" disabled={running || accountBusy} onClick={() => setShowAddAccountModal(false)}><Power size={16} /></button>
                  </div>
                  <div className="stack" style={{ gap: 14 }}>
                    <Field label="Cookie Threads">
                      <textarea className="input facebook-auto-textarea" placeholder="Mỗi dòng 1 cookie Threads" value={sessionInput} onChange={(event) => setSessionInput(event.target.value)} rows={8} />
                    </Field>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" type="button" onClick={() => setShowAddAccountModal(false)}>Hủy</button>
                      <button className="btn btn-red" type="button" disabled={running || accountBusy} onClick={addAccount}>{accountBusy ? "Đang thêm..." : "Thêm tài khoản"}</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {showEditAccountModal && editAccount ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => !running && setShowEditAccountModal(false)}>
                <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="threads-auto-edit-account-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="threads-auto-edit-account-title">Sửa cookie</div>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>{editAccount.name} - {editAccount.threadsId}</p>
                    </div>
                    <button className="icon-btn" type="button" aria-label="Đóng" onClick={() => setShowEditAccountModal(false)}><Power size={16} /></button>
                  </div>
                  <div className="stack" style={{ gap: 14 }}>
                    <Field label="Cookie Threads">
                      <textarea className="input facebook-auto-textarea" placeholder="Dán cookie mới" value={editSession} onChange={(event) => setEditSession(event.target.value)} rows={8} />
                    </Field>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" type="button" onClick={() => setShowEditAccountModal(false)}>Hủy</button>
                      <button className="btn btn-red" type="button" disabled={running || accountBusy} onClick={saveEditedAccount}>{accountBusy ? "Đang lưu..." : "Lưu cookie"}</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {showExportPreviewModal ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => setShowExportPreviewModal(false)}>
                <div className="facebook-auto-task-detail facebook-auto-export-preview-modal" role="dialog" aria-modal="true" aria-labelledby="threads-auto-export-preview-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="threads-auto-export-preview-title">Dữ liệu xuất Threads</div>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>{exportPreviewFileName}</p>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowExportPreviewModal(false)}>Đóng</button>
                  </div>
                  <textarea className="input facebook-auto-export-preview-textarea" readOnly value={exportPreviewContent} />
                  <div className="facebook-auto-export-preview-actions">
                    <button className="btn btn-red" type="button" disabled={!exportPreviewContent} onClick={downloadExportPreview}>
                      <Download size={16} /> Tải về
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <section className="card pad facebook-auto-config-card">
              <div className="facebook-auto-section-title">
                <h2><Settings2 size={18} /> Cấu hình tác vụ</h2>
                <p className="subtitle">Bật tác vụ cần chạy và nhập số lượng cho từng loại.</p>

                <span className={`facebook-auto-save-state ${settingsSaveState}`}>
                  {settingsSaveState === "saving" ? "Đang lưu..." : settingsSaveState === "error" ? "Lưu thất bại" : settingsSaveState === "saved" ? "Đã lưu Config" : ""}
                </span>
              </div>

              <div className="facebook-auto-control-block">
                <div className="facebook-auto-block-label">Tác vụ cần chạy</div>
                <div className="facebook-auto-task-grid">
                  <label className={enableGroupPost ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head"><span>Đăng Post</span><input checked={enableGroupPost} type="checkbox" onChange={(event) => setEnableGroupPost(event.target.checked)} /></div>
                    <small>Nhập số post cần đăng trên Threads.</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={groupPostCount} onChange={(event) => setGroupPostCount(Number(event.target.value))} disabled={!enableGroupPost} />
                      <button aria-label="Tùy chỉnh đăng group" aria-expanded={activeTaskModal === "groupPost"} className="icon-btn facebook-auto-task-config-btn" type="button" title="Tùy chỉnh" onClick={() => setActiveTaskModal((current) => current === "groupPost" ? null : "groupPost")}><Settings2 size={16} /></button>
                    </div>
                  </label>

                  <label className={enableFeedComment ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head"><span>Comment newfeed</span><input checked={enableFeedComment} type="checkbox" onChange={(event) => setEnableFeedComment(event.target.checked)} /></div>
                    <small>Nhập số lượng bài newfeed cần comment.</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={feedCommentCount} onChange={(event) => setFeedCommentCount(Number(event.target.value))} disabled={!enableFeedComment} />
                      <button aria-label="Tùy chỉnh comment newfeed" aria-expanded={activeTaskModal === "feedComment"} className="icon-btn facebook-auto-task-config-btn" type="button" title="Tùy chỉnh" onClick={() => setActiveTaskModal((current) => current === "feedComment" ? null : "feedComment")}><Settings2 size={16} /></button>
                    </div>
                  </label>

                  <label className={enableSearchComment ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head"><span>Comment search</span><input checked={enableSearchComment} type="checkbox" onChange={(event) => setEnableSearchComment(event.target.checked)} /></div>
                    <small>Tìm bài Threads theo keyword rồi comment.</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={searchCommentCount} onChange={(event) => setSearchCommentCount(Number(event.target.value))} disabled={!enableSearchComment} />
                      <button aria-label="Tùy chỉnh comment search" aria-expanded={activeTaskModal === "searchComment"} className="icon-btn facebook-auto-task-config-btn" type="button" title="Tùy chỉnh" onClick={() => setActiveTaskModal((current) => current === "searchComment" ? null : "searchComment")}><Settings2 size={16} /></button>
                    </div>
                  </label>
                </div>

                {activeTaskModal ? (
                  <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => setActiveTaskModal(null)}>
                    <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="threads-auto-task-detail-title" onMouseDown={(event) => event.stopPropagation()}>
                      <div className="facebook-auto-task-detail-header">
                        <div className="facebook-auto-block-label" id="threads-auto-task-detail-title">
                          {activeTaskModal === "groupPost" ? "Cấu hình Đăng Post" : activeTaskModal === "feedComment" ? "Cấu hình comment newfeed" : "Cấu hình comment search"}
                        </div>
                        <button className="btn btn-secondary" type="button" onClick={() => setActiveTaskModal(null)}>Đóng</button>
                      </div>

                      {activeTaskModal === "groupPost" ? (
                        <div className="threads-post-config">
                          <Field label="Chủ đề">
                            <textarea
                              className="input facebook-auto-textarea"
                              placeholder={"Mỗi dòng là một chủ đề\nVí dụ: bán hàng handmade\nTuyển cộng tác viên"}
                              value={groupPostTopic}
                              onChange={(event) => setGroupPostTopic(event.target.value)}
                            />
                            <div className="threads-post-meta">
                              <span>{groupPostTopicList.length} chủ đề</span>
                              <span>{groupPostItems.length} nội dung</span>
                            </div>
                          </Field>

                          <div className="threads-post-composer">
                            <Field label="Nội dung bài đăng">
                              <textarea className="input facebook-auto-textarea" placeholder="Nhập một nội dung bài đăng, có thể xuống dòng trong cùng một bài." value={groupPostContentDraft} onChange={(event) => setGroupPostContentDraft(event.target.value)} />
                            </Field>
                            <button className="btn btn-secondary threads-post-add-btn" type="button" onClick={addGroupPostContent}>
                              <Plus size={16} /> Thêm nội dung
                            </button>
                          </div>

                          <div className="threads-post-table-card">
                            <div className="threads-post-table-head">
                              <div>
                                <strong>Danh sách nội dung</strong>
                                <span>{groupPostItems.length ? `Hiển thị ${(groupPostPage - 1) * GROUP_POST_PAGE_SIZE + 1}-${Math.min(groupPostPage * GROUP_POST_PAGE_SIZE, groupPostItems.length)} / ${groupPostItems.length}` : "Chưa có nội dung"}</span>
                              </div>
                              <div className="threads-post-table-actions">
                                <input ref={groupPostImportInputRef} accept=".txt,text/plain" type="file" hidden onChange={importGroupPostContents} />
                                <button className="btn btn-secondary threads-post-export-btn" type="button" disabled={!groupPostItems.length} onClick={selectAllGroupPostContents}>
                                  Chọn tất cả
                                </button>
                                <button className="btn btn-secondary threads-post-export-btn" type="button" disabled={!selectedGroupPostIndexes.length} onClick={clearGroupPostContentSelection}>
                                  Bỏ chọn
                                </button>
                                <button className="btn btn-secondary threads-post-export-btn" type="button" disabled={!selectedGroupPostIndexes.length} onClick={removeSelectedGroupPostContents}>
                                  <Trash2 size={15} /> Xoá đã chọn
                                </button>
                                <button className="btn btn-secondary threads-post-export-btn" type="button" onClick={() => groupPostImportInputRef.current?.click()}>
                                  <Upload size={15} /> Nhập nội dung
                                </button>
                                <button className="btn btn-secondary threads-post-export-btn" type="button" disabled={!groupPostItems.length} onClick={exportGroupPostContents}>
                                  <Download size={15} /> Xuất nội dung
                                </button>
                              </div>
                            </div>
                            <div className="table-wrap threads-post-table-wrap">
                              <table className="table threads-post-table">
                                <thead>
                                  <tr>
                                    <th>Chọn</th>
                                    <th>#</th>
                                    <th>Nội dung</th>
                                    <th>Ký tự</th>
                                    <th>Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {!groupPostItems.length ? (
                                    <tr>
                                      <td colSpan={5}>
                                        <div className="threads-post-empty">Chưa có nội dung bài đăng nào.</div>
                                      </td>
                                    </tr>
                                  ) : null}
                                  {pagedGroupPostItems.map((content, itemIndex) => {
                                    const absoluteIndex = (groupPostPage - 1) * GROUP_POST_PAGE_SIZE + itemIndex;
                                    return (
                                      <tr key={`${absoluteIndex}-${content.slice(0, 24)}`}>
                                        <td>
                                          <input
                                            aria-label={`Chọn nội dung ${absoluteIndex + 1}`}
                                            checked={selectedGroupPostIndexes.includes(absoluteIndex)}
                                            type="checkbox"
                                            onChange={() => toggleGroupPostContentSelection(absoluteIndex)}
                                          />
                                        </td>
                                        <td>#{absoluteIndex + 1}</td>
                                        <td>
                                          <p className="threads-post-preview">{content}</p>
                                        </td>
                                        <td>{content.length}</td>
                                        <td>
                                          <button className="btn btn-secondary threads-post-delete-btn" type="button" onClick={() => removeGroupPostContent(absoluteIndex)}>
                                            <Trash2 size={15} /> Xóa
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="threads-post-pagination">
                              <span>Trang {groupPostPage}/{groupPostPageCount}</span>
                              <div>
                                <button className="btn btn-secondary" type="button" disabled={groupPostPage <= 1} onClick={() => setGroupPostPage((current) => Math.max(1, current - 1))}>Trước</button>
                                <button className="btn btn-secondary" type="button" disabled={groupPostPage >= groupPostPageCount} onClick={() => setGroupPostPage((current) => Math.min(groupPostPageCount, current + 1))}>Sau</button>
                              </div>
                            </div>
                          </div>

                          <Field label="Delay sau mỗi bài đăng group (giây)">
                            <input className="input" min={0} max={3600} type="number" value={groupPostDelaySeconds} onChange={(event) => setGroupPostDelaySeconds(Number(event.target.value))} />
                          </Field>
                        </div>
                      ) : null}

                      {false && activeTaskModal === "groupPost" ? (
                        <div>
                          <Field label="Chủ đề">
                            <textarea
                              className="input facebook-auto-textarea"
                              placeholder={"Mỗi dòng là một chủ đề\nVí dụ: bán hàng handmade\nTuyển cộng tác viên"}
                              value={groupPostTopic}
                              onChange={(event) => setGroupPostTopic(event.target.value)}
                            />
                            {groupPostTopicList.length ? <small className="subtitle">{groupPostTopicList.length} chủ đề</small> : null}
                          </Field>
                          <Field label="Nội dung bài đăng">
                            <textarea className="input facebook-auto-textarea" placeholder="Nhập một nội dung bài đăng, có thể xuống dòng trong cùng một bài." value={groupPostContentDraft} onChange={(event) => setGroupPostContentDraft(event.target.value)} />
                          </Field>
                          <div className="facebook-auto-detail-row">
                            <button className="btn btn-secondary" type="button" onClick={addGroupPostContent}>Thêm nội dung</button>
                          </div>
                          <div className="facebook-auto-content-list">
                            {!groupPostItems.length ? <p className="subtitle">Chưa có nội dung bài đăng nào.</p> : null}
                            {groupPostItems.map((content, index) => (
                              <div className="facebook-auto-content-item" key={`${index}-${content.slice(0, 24)}`}>
                                <div><strong>Nội dung {index + 1}</strong><p>{content}</p></div>
                                <button className="btn btn-secondary" type="button" onClick={() => removeGroupPostContent(index)}>Xóa</button>
                              </div>
                            ))}
                          </div>
                          <Field label="Delay sau mỗi bài đăng group (giây)">
                            <input className="input" min={0} max={3600} type="number" value={groupPostDelaySeconds} onChange={(event) => setGroupPostDelaySeconds(Number(event.target.value))} />
                          </Field>
                        </div>
                      ) : null}

                      {activeTaskModal === "feedComment" ? (
                        <div className="stack">
                          <Field label={`Danh sách comment newfeed (${feedCommentList.length} nội dung)`}>
                            <textarea className="input facebook-auto-textarea" placeholder="Nhập mỗi comment một dòng" value={feedComments} onChange={(event) => setFeedComments(event.target.value)} />
                          </Field>
                          <Field label="Delay sau mỗi comment newfeed (giây)">
                            <input className="input" min={0} max={3600} type="number" value={feedCommentDelaySeconds} onChange={(event) => setFeedCommentDelaySeconds(Number(event.target.value))} />
                          </Field>
                        </div>
                      ) : null}

                      {activeTaskModal === "searchComment" ? (
                        <div className="stack">
                          <Field label={`Keyword tìm kiếm (${searchKeywordList.length} keyword)`}>
                            <textarea
                              className="input facebook-auto-textarea"
                              placeholder={"Nhập mỗi keyword một dòng\nVí dụ:\nhandmade len\nquà tặng\ngấu bông len"}
                              value={searchKeyword}
                              onChange={(event) => setSearchKeyword(event.target.value)}
                            />
                          </Field>
                          <Field label={`Danh sách comment search (${searchCommentList.length} nội dung)`}>
                            <textarea className="input facebook-auto-textarea" placeholder="Nhập mỗi comment một dòng" value={searchComments} onChange={(event) => setSearchComments(event.target.value)} />
                          </Field>
                          <Field label="Delay sau mỗi comment search (giây)">
                            <input className="input" min={0} max={3600} type="number" value={searchCommentDelaySeconds} onChange={(event) => setSearchCommentDelaySeconds(Number(event.target.value))} />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="facebook-auto-control-block">
                <div className="facebook-auto-block-label">Tùy chọn vận hành</div>
                <div className="facebook-auto-options">
                  <label className="facebook-auto-check"><input checked={randomizeTasks} type="checkbox" onChange={(event) => setRandomizeTasks(event.target.checked)} /> Chạy random thứ tự tác vụ</label>
                </div>
              </div>
            </section>
          </div>

          <div className="facebook-auto-bottom-grid">
            <section className="card pad facebook-auto-run-card">
              <div className="facebook-auto-section-title facebook-auto-run-title">
                <h2><Play size={18} /> Điều khiển bot</h2>
                <p className="subtitle">Chọn tài khoản ở bảng bên trên, kiểm tra cấu hình rồi khởi động bot .</p>
              </div>

              <div className="facebook-auto-run-summary">
                <div><span>Tài khoản chọn</span><strong>{activeSelectedAccounts.length}/{selectedAccounts.length}</strong></div>
                <div><span>Tổng tác vụ</span><strong>{totalActions}/{MAX_TOTAL_ACTIONS}</strong></div>
              </div>
              {totalActionsExceeded ? <p className="subtitle" style={{ color: "var(--danger)" }}>Tổng tác vụ không được vượt quá {MAX_TOTAL_ACTIONS}.</p> : null}

              <div className="facebook-auto-actions">
                {running ? (
                  <button className="btn btn-red" type="button" onClick={togglePauseBot}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? "Tiếp tục bot" : "Tạm dừng"}</button>
                ) : (
                  <button
                    className="btn btn-red"
                    type="button"
                    disabled={totalActionsExceeded || activeSelectedAccounts.length === 0}
                    onClick={startBot}
                    title={activeSelectedAccounts.length === 0 ? "Chọn ít nhất một tài khoản Threads hoạt động để chạy bot." : undefined}
                  >
                    <Play size={17} /> Khởi động bot
                  </button>
                )}
                <button className="btn btn-secondary" type="button" disabled={!running} onClick={stopBot}><Power size={17} /> Dừng bot</button>
                <button className="btn btn-secondary" type="button" disabled={running} onClick={clearResumeJob}><RotateCcw size={17} /> Xoá luồng resume</button>
              </div>
            </section>

            <aside className="card pad facebook-auto-log-card">
              <div className="facebook-auto-section-title">
                <h2><Search size={18} /> Nhật ký hoạt động</h2>
                <p className="subtitle">Log realtime từ tiến trình Auto Threads .</p>
              </div>
              <div className="facebook-auto-log-list" aria-live="polite">
                {!logs.length ? <p className="facebook-auto-empty-log">Chưa có log.</p> : null}
                {logs.map((entry, index) => (
                  <div className={`facebook-auto-log-row ${entry.level}`} key={`${entry.id}-${entry.createdAt}-${index}`}>
                    <time>{new Date(entry.createdAt).toLocaleTimeString("vi-VN")}</time>
                    <span>{entry.message}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </form>
    </AppFrame>
  );
}
