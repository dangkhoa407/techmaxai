"use client";

import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Cookie, Download, Pencil, Pause, Play, Plus, Power, RotateCcw, Search, Settings2, Trash2, Upload, Zap } from "lucide-react";
import { AppFrame, PageHeader, StatCard } from "../components";
import { API_BASE_URL, fetchUserProxies, getToken, type UserProxy } from "../lib/auth";
import { getFacebookAutoDeviceId } from "./lib/device";
import { showError, showToast } from "../lib/swal";

type BotLog = {
  id: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  createdAt: string;
};

type BotStatus = {
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

type FacebookAutoAccount = {
  id: string;
  name: string;
  userId: string;
  facebookName?: string;
  proxy?: string | null;
  status?: "active" | "checkpoint" | "invalid" | "unknown";
  cookiePreview: string;
  createdAt: string;
  updatedAt: string;
};

type GroupMode = "links" | "keyword";
type GroupPostTargetMode = "links" | "keyword";
type TaskModal = "react" | "comment" | "group" | "groupComment" | "groupPost" | "pokes" | null;

type FacebookAutoSettings = {
  enableReact: boolean;
  enableComment: boolean;
  enableGroup: boolean;
  enableGroupComment: boolean;
  enableGroupPost: boolean;
  enablePokes: boolean;
  selectedReactions: string[];
  comments: string;
  groupComments: string;
  groupPostContents: string;
  groupPostItems: string[];
  reactCount: number;
  commentCount: number;
  groupCount: number;
  groupCommentCount: number;
  groupPostCount: number;
  pokesCount: number;
  delaySeconds?: number;
  reactDelaySeconds: number;
  commentDelaySeconds: number;
  groupDelaySeconds: number;
  groupCommentDelaySeconds: number;
  groupPostDelaySeconds: number;
  pokesDelaySeconds: number;
  randomizeTasks: boolean;
  headlessChrome: boolean;
  lowResourceMode: boolean;
  refreshGroupPostLinks: boolean;
  groupMode: GroupMode;
  groupPostTargetMode: GroupPostTargetMode;
  groupPostKeyword: string;
  groupPostLinksText: string;
  groupLinksText: string;
  groupKeyword: string;
  groupCommentKeyword: string;
};

const reactions = ["Thích", "Yêu thích", "Thương thương", "Haha", "Wow", "Buồn", "Phẫn nộ"];
const MAX_TOTAL_ACTIONS = 500;
const GROUP_POST_PAGE_SIZE = 5;

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

function repairVietnameseDisplayText(value: string) {
  return value
    .replace(/Ä/g, "Đ")
    .replace(/Ä‘/g, "đ")
    .replace(/Ã /g, "à")
    .replace(/Ã¡/g, "á")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¨/g, "è")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã¬/g, "ì")
    .replace(/Ã­/g, "í")
    .replace(/Ã²/g, "ò")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã¹/g, "ù")
    .replace(/Ãº/g, "ú")
    .replace(/Ã½/g, "ý")
    .replace(/áº£/g, "ả")
    .replace(/áº¡/g, "ạ")
    .replace(/áº¥/g, "ấ")
    .replace(/áº§/g, "ầ")
    .replace(/áº©/g, "ẩ")
    .replace(/áº«/g, "ẫ")
    .replace(/áº­/g, "ậ")
    .replace(/áº¯/g, "ắ")
    .replace(/áº±/g, "ằ")
    .replace(/áº³/g, "ẳ")
    .replace(/áºµ/g, "ẵ")
    .replace(/áº·/g, "ặ")
    .replace(/áº¹/g, "ẹ")
    .replace(/áº»/g, "ẻ")
    .replace(/áº½/g, "ẽ")
    .replace(/áº¿/g, "ế")
    .replace(/á»/g, "ề")
    .replace(/á»ƒ/g, "ể")
    .replace(/á»…/g, "ễ")
    .replace(/á»‡/g, "ệ")
    .replace(/á»‰/g, "ỉ")
    .replace(/á»‹/g, "ị")
    .replace(/á»/g, "ọ")
    .replace(/á»/g, "ỏ")
    .replace(/á»‘/g, "ố")
    .replace(/á»“/g, "ồ")
    .replace(/á»•/g, "ổ")
    .replace(/á»—/g, "ỗ")
    .replace(/á»™/g, "ộ")
    .replace(/á»›/g, "ớ")
    .replace(/á»/g, "ờ")
    .replace(/á»Ÿ/g, "ở")
    .replace(/á»¡/g, "ỡ")
    .replace(/á»£/g, "ợ")
    .replace(/á»¥/g, "ụ")
    .replace(/á»§/g, "ủ")
    .replace(/á»©/g, "ứ")
    .replace(/á»«/g, "ừ")
    .replace(/á»­/g, "ử")
    .replace(/á»¯/g, "ữ")
    .replace(/á»±/g, "ự")
    .replace(/á»³/g, "ỳ")
    .replace(/á»·/g, "ỷ")
    .replace(/á»¹/g, "ỹ")
    .replace(/á»µ/g, "ỵ");
}

const initialStatus: BotStatus = {
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
  logs: []
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = getToken();
  const deviceId = getFacebookAutoDeviceId();
  if (!token) {
    throw new Error("Bạn cần đăng nhập.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Facebook-Auto-Device-Id": deviceId,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = (await response.json()) as T & { ok?: boolean; message?: string };

  if (!response.ok || data.ok === false) {
    throw new Error(data.message ?? "Có lỗi xảy ra.");
  }

  return data;
}

async function fetchRuntimeSettings() {
  const token = getToken();
  if (!token) return { max_workers: 5, headless_chrome: true, low_resource_mode: true };

  const response = await fetch(`${API_BASE_URL}/facebook-auto/system-settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = (await response.json()) as {
    ok?: boolean;
    message?: string;
    settings?: { max_workers?: number; headless_chrome?: boolean; low_resource_mode?: boolean } | null;
  };

  if (!response.ok || data.ok === false) {
    throw new Error(data.message ?? "Không thể tải cấu hình runtime.");
  }

  return {
    max_workers: Number(data.settings?.max_workers ?? 5),
    headless_chrome: Boolean(data.settings?.headless_chrome ?? true),
    low_resource_mode: Boolean(data.settings?.low_resource_mode ?? true)
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="facebook-auto-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function FacebookAutoPage() {
  const [cookie, setCookie] = useState("");
  const [accounts, setAccounts] = useState<FacebookAutoAccount[]>([]);
  const [proxies, setProxies] = useState<UserProxy[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [enableReact, setEnableReact] = useState(true);
  const [enableComment, setEnableComment] = useState(false);
  const [enableGroup, setEnableGroup] = useState(false);
  const [enableGroupComment, setEnableGroupComment] = useState(false);
  const [enableGroupPost, setEnableGroupPost] = useState(false);
  const [enablePokes, setEnablePokes] = useState(false);
  const [selectedReactions, setSelectedReactions] = useState<string[]>(["Thích"]);
  const [comments, setComments] = useState("");
  const [groupComments, setGroupComments] = useState("");
  const [groupPostContents, setGroupPostContents] = useState("");
  const [groupPostItems, setGroupPostItems] = useState<string[]>([]);
  const [selectedGroupPostIndexes, setSelectedGroupPostIndexes] = useState<number[]>([]);
  const [groupPostPage, setGroupPostPage] = useState(1);
  const [reactCount, setReactCount] = useState(1);
  const [commentCount, setCommentCount] = useState(1);
  const [groupCount, setGroupCount] = useState(1);
  const [groupCommentCount, setGroupCommentCount] = useState(1);
  const [groupPostCount, setGroupPostCount] = useState(1);
  const [pokesCount, setPokesCount] = useState(1);
  const [reactDelaySeconds, setReactDelaySeconds] = useState(5);
  const [commentDelaySeconds, setCommentDelaySeconds] = useState(5);
  const [groupDelaySeconds, setGroupDelaySeconds] = useState(5);
  const [groupCommentDelaySeconds, setGroupCommentDelaySeconds] = useState(5);
  const [groupPostDelaySeconds, setGroupPostDelaySeconds] = useState(5);
  const [pokesDelaySeconds, setPokesDelaySeconds] = useState(5);
  const [randomizeTasks, setRandomizeTasks] = useState(false);
  const [headlessChrome, setHeadlessChrome] = useState(true);
  const [systemHeadlessChrome, setSystemHeadlessChrome] = useState(true);
  const [lowResourceMode, setLowResourceMode] = useState(true);
  const [systemLowResourceMode, setSystemLowResourceMode] = useState(false);
  const [refreshGroupPostLinks, setRefreshGroupPostLinks] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>("links");
  const [groupPostTargetMode, setGroupPostTargetMode] = useState<GroupPostTargetMode>("links");
  const [groupPostKeyword, setGroupPostKeyword] = useState("");
  const [groupPostLinksText, setGroupPostLinksText] = useState("");
  const [groupLinksText, setGroupLinksText] = useState("");
  const [groupKeyword, setGroupKeyword] = useState("");
  const [groupCommentKeyword, setGroupCommentKeyword] = useState("");
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FacebookAutoAccount | null>(null);
  const [editCookie, setEditCookie] = useState("");
  const [activeTaskModal, setActiveTaskModal] = useState<TaskModal>(null);
  const [exportPreviewContent, setExportPreviewContent] = useState("");
  const [exportPreviewFileName, setExportPreviewFileName] = useState("");
  const [showExportPreviewModal, setShowExportPreviewModal] = useState(false);
  const [status, setStatus] = useState<BotStatus>(initialStatus);
  const [message, setMessage] = useState("Sẵn sàng.");
  const [busy, setBusy] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [checkingAccountIds, setCheckingAccountIds] = useState<string[]>([]);
  const [checkLiveCooldowns, setCheckLiveCooldowns] = useState<Record<string, number>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [now, setNow] = useState(0);
  const saveAccountLockRef = useRef(false);
  const groupPostImportInputRef = useRef<HTMLInputElement | null>(null);

  const commentList = useMemo(
    () =>
      comments
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [comments]
  );

  const groupCommentList = useMemo(
    () =>
      groupComments
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [groupComments]
  );

  const groupLinks = useMemo(
    () =>
      groupLinksText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [groupLinksText]
  );

  const groupPostLinks = useMemo(
    () => groupPostLinksText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [groupPostLinksText]
  );

  const groupPostPageCount = Math.max(1, Math.ceil(groupPostItems.length / GROUP_POST_PAGE_SIZE));
  const pagedGroupPostItems = useMemo(
    () => groupPostItems.slice((groupPostPage - 1) * GROUP_POST_PAGE_SIZE, groupPostPage * GROUP_POST_PAGE_SIZE),
    [groupPostItems, groupPostPage]
  );

  const effectiveHeadlessChrome = headlessChrome && systemHeadlessChrome;
  const effectiveLowResourceMode = lowResourceMode || systemLowResourceMode;

  const totalActions =
    (enableReact ? reactCount : 0) +
    (enableComment ? commentCount : 0) +
    (enableGroup ? groupCount : 0) +
    (enableGroupComment ? groupCommentCount : 0) +
    (enableGroupPost ? groupPostCount : 0) +
    (enablePokes ? pokesCount : 0);
  const totalActionsExceeded = totalActions > MAX_TOTAL_ACTIONS;

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );
  const activeSelectedAccounts = useMemo(
    () => selectedAccounts.filter((account) => account.status === "active"),
    [selectedAccounts]
  );

  const estimatedCompletion = useMemo(() => {
    const formatDateTime = (value: number | string) => new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(value));

    if (status.finishedAt) return `Hoàn thành lúc ${formatDateTime(status.finishedAt)}`;
    if (!status.running || !status.startedAt) return "Chưa có thời gian dự kiến";
    if (status.paused) return "Đang tạm dừng — thời gian dự kiến sẽ cập nhật khi chạy tiếp";
    if (!now || status.currentPost <= 0 || status.totalPosts <= status.currentPost) {
      return "Đang tính sau khi hoàn tất tác vụ đầu tiên";
    }

    const startedAt = new Date(status.startedAt).getTime();
    if (!Number.isFinite(startedAt) || now <= startedAt) return "Đang tính thời gian dự kiến";
    const averageTaskMs = (now - startedAt) / status.currentPost;
    const remainingTasks = status.totalPosts - status.currentPost;
    return `Dự kiến hoàn thành: ${formatDateTime(now + averageTaskMs * remainingTasks)}`;
  }, [now, status.currentPost, status.finishedAt, status.paused, status.running, status.startedAt, status.totalPosts]);

  const workerHelp = useMemo(() => {
    if (!status.queuedWorkers) return "Không có tài khoản chờ";
    const eta = status.estimatedNextStartAt
      ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(status.estimatedNextStartAt))
      : "đang tính";
    return `${status.queuedWorkers} tài khoản đang đợi • STT ${status.nextQueuePosition ?? 1} • dự kiến chạy ${eta}`;
  }, [status.estimatedNextStartAt, status.nextQueuePosition, status.queuedWorkers]);

  useEffect(() => {
    setNow(Date.now());
    if (!status.running || status.paused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status.paused, status.running]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const events = new EventSource(`/api/facebook-auto/bot/events?token=${encodeURIComponent(token)}`);
    events.onmessage = (event) => {
      const result = JSON.parse(event.data) as { ok: boolean; status: BotStatus };
      if (result.ok) setStatus(result.status);
    };
    return () => events.close();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    fetch(`/api/facebook-auto/bot/status?token=${encodeURIComponent(token)}`, {
      cache: "no-store"
    })
      .then((response) => response.json() as Promise<{ ok: boolean; status?: BotStatus; message?: string }>)
      .then((data) => {
        if (!cancelled && data.ok && data.status) setStatus(data.status);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAccounts();
    loadSettings();
    fetchUserProxies()
      .then((items) => setProxies(items.filter((item) => item.status === "active")))
      .catch(() => undefined);
    fetchRuntimeSettings()
      .then((settings) => {
        setStatus((current) => current.running ? current : { ...current, maxWorkers: settings.max_workers });
        setSystemHeadlessChrome(settings.headless_chrome);
        setSystemLowResourceMode(settings.low_resource_mode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    setSettingsSaveState("saving");
    const timer = window.setTimeout(() => saveSettings(), 700);
    return () => window.clearTimeout(timer);
  }, [
    settingsLoaded, enableReact, enableComment, enableGroup, enableGroupComment, enableGroupPost, enablePokes, selectedReactions, comments, groupComments,
    groupPostContents, groupPostItems, reactCount, commentCount, groupCount, groupCommentCount, groupPostCount, pokesCount,
    reactDelaySeconds, commentDelaySeconds, groupDelaySeconds, groupCommentDelaySeconds, groupPostDelaySeconds, pokesDelaySeconds,
    randomizeTasks, headlessChrome, lowResourceMode, refreshGroupPostLinks, groupMode, groupPostTargetMode,
    groupPostKeyword, groupPostLinksText, groupLinksText, groupKeyword, groupCommentKeyword
  ]);

  useEffect(() => {
    setGroupPostPage((current) => Math.min(Math.max(current, 1), groupPostPageCount));
  }, [groupPostPageCount]);

  function currentSettings(): FacebookAutoSettings {
    return {
      enableReact, enableComment, enableGroup, enableGroupComment, enableGroupPost, enablePokes, selectedReactions, comments, groupComments,
      groupPostContents, groupPostItems, reactCount, commentCount,
      groupCount, groupCommentCount, groupPostCount, pokesCount,
      reactDelaySeconds, commentDelaySeconds, groupDelaySeconds, groupCommentDelaySeconds, groupPostDelaySeconds, pokesDelaySeconds,
      randomizeTasks, headlessChrome, lowResourceMode, refreshGroupPostLinks,
      groupMode, groupPostTargetMode, groupPostKeyword, groupPostLinksText, groupLinksText, groupKeyword, groupCommentKeyword
    };
  }

  async function loadSettings() {
    const token = getToken();
    if (!token) {
      setSettingsLoaded(true);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/facebook-auto/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = (await response.json()) as { success?: boolean; settings?: Partial<FacebookAutoSettings> | null; message?: string };
      if (!response.ok || data.success === false) throw new Error(data.message ?? "Không thể tải cấu hình Auto Facebook.");
      const saved = data.settings;
      if (saved) {
        if (typeof saved.enableReact === "boolean") setEnableReact(saved.enableReact);
        if (typeof saved.enableComment === "boolean") setEnableComment(saved.enableComment);
        if (typeof saved.enableGroup === "boolean") setEnableGroup(saved.enableGroup);
        if (typeof saved.enableGroupComment === "boolean") setEnableGroupComment(saved.enableGroupComment);
        if (typeof saved.enableGroupPost === "boolean") setEnableGroupPost(saved.enableGroupPost);
        if (typeof saved.enablePokes === "boolean") setEnablePokes(saved.enablePokes);
        if (Array.isArray(saved.selectedReactions)) setSelectedReactions(saved.selectedReactions.filter((item): item is string => typeof item === "string" && reactions.includes(item)));
        if (typeof saved.comments === "string") setComments(saved.comments);
        if (typeof saved.groupComments === "string") setGroupComments(saved.groupComments);
        else if (typeof saved.comments === "string") setGroupComments(saved.comments);
        if (typeof saved.groupPostContents === "string") setGroupPostContents(saved.groupPostContents);
        if (Array.isArray(saved.groupPostItems)) {
          setGroupPostItems(parseImportedPostItems(saved.groupPostItems.filter((item): item is string => typeof item === "string").join("\n------------------------------\n")));
        }
        if (Number.isFinite(saved.reactCount)) setReactCount(Number(saved.reactCount));
        if (Number.isFinite(saved.commentCount)) setCommentCount(Number(saved.commentCount));
        if (Number.isFinite(saved.groupCount)) setGroupCount(Number(saved.groupCount));
        if (Number.isFinite(saved.groupCommentCount)) setGroupCommentCount(Number(saved.groupCommentCount));
        if (Number.isFinite(saved.groupPostCount)) setGroupPostCount(Number(saved.groupPostCount));
        if (Number.isFinite(saved.pokesCount)) setPokesCount(Number(saved.pokesCount));
        const legacyDelay = Number.isFinite(saved.delaySeconds) ? Number(saved.delaySeconds) : 5;
        setReactDelaySeconds(Number.isFinite(saved.reactDelaySeconds) ? Number(saved.reactDelaySeconds) : legacyDelay);
        setCommentDelaySeconds(Number.isFinite(saved.commentDelaySeconds) ? Number(saved.commentDelaySeconds) : legacyDelay);
        setGroupDelaySeconds(Number.isFinite(saved.groupDelaySeconds) ? Number(saved.groupDelaySeconds) : legacyDelay);
        setGroupCommentDelaySeconds(Number.isFinite(saved.groupCommentDelaySeconds) ? Number(saved.groupCommentDelaySeconds) : legacyDelay);
        setGroupPostDelaySeconds(Number.isFinite(saved.groupPostDelaySeconds) ? Number(saved.groupPostDelaySeconds) : legacyDelay);
        setPokesDelaySeconds(Number.isFinite(saved.pokesDelaySeconds) ? Number(saved.pokesDelaySeconds) : legacyDelay);
        if (typeof saved.randomizeTasks === "boolean") setRandomizeTasks(saved.randomizeTasks);
        if (typeof saved.headlessChrome === "boolean") setHeadlessChrome(saved.headlessChrome);
        if (typeof saved.lowResourceMode === "boolean") setLowResourceMode(saved.lowResourceMode);
        if (typeof saved.refreshGroupPostLinks === "boolean") setRefreshGroupPostLinks(saved.refreshGroupPostLinks);
        if (saved.groupMode === "links" || saved.groupMode === "keyword") setGroupMode(saved.groupMode);
        if (saved.groupPostTargetMode === "keyword" || saved.groupPostTargetMode === "links") setGroupPostTargetMode(saved.groupPostTargetMode);
        if (typeof saved.groupPostKeyword === "string") setGroupPostKeyword(saved.groupPostKeyword);
        if (typeof saved.groupPostLinksText === "string") setGroupPostLinksText(saved.groupPostLinksText);
        if (typeof saved.groupLinksText === "string") setGroupLinksText(saved.groupLinksText);
        if (typeof saved.groupKeyword === "string") setGroupKeyword(saved.groupKeyword);
        if (typeof saved.groupCommentKeyword === "string") setGroupCommentKeyword(saved.groupCommentKeyword);
      }
      setSettingsSaveState("saved");
    } catch (error) {
      setSettingsSaveState("error");
      setMessage(error instanceof Error ? error.message : "Không thể tải cấu hình Auto Facebook.");
    } finally {
      setSettingsLoaded(true);
    }
  }

  async function saveSettings() {
    const token = getToken();
    if (!token) {
      setSettingsSaveState("error");
      return;
    }
    const deviceId = getFacebookAutoDeviceId();
    try {
      const response = await fetch(`${API_BASE_URL}/facebook-auto/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
        body: JSON.stringify({ settings: currentSettings() })
      });
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || data.success === false) throw new Error(data.message ?? "Không thể lưu cấu hình Auto Facebook.");
      setSettingsSaveState("saved");
    } catch (error) {
      setSettingsSaveState("error");
      setMessage(error instanceof Error ? error.message : "Không thể lưu cấu hình Auto Facebook.");
    }
  }

  async function loadAccounts() {
    const token = getToken();
    const deviceId = getFacebookAutoDeviceId();
    if (!token) {
      setMessage("Bạn cần đăng nhập.");
      return;
    }

    try {
      const response = await fetch("/api/facebook-auto/accounts", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "X-Facebook-Auto-Device-Id": deviceId }
      });
      const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể tải tài khoản Facebook.");
      setAccounts(data.accounts ?? []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể tải tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    }
  }

  async function saveAccount() {
    if (saveAccountLockRef.current) return;
    saveAccountLockRef.current = true;
    setSavingAccount(true);
    setBusy(true);
    setMessage("Đang kiểm tra tài khoản Facebook...");
    try {
      const result = await postJson<{ ok: boolean; accounts: FacebookAutoAccount[]; status: BotStatus }>("/api/facebook-auto/accounts", {
        cookies: cookie
      });
      setAccounts(result.accounts);
      setStatus(result.status);
      const savedUserIds = new Set([...cookie.matchAll(/(?:^|;\s*)c_user=(\d+)/gm)].map((match) => match[1]));
      const savedIds = result.accounts.filter((account) => savedUserIds.has(account.userId)).map((account) => account.id);
      setSelectedAccountIds((current) => [...new Set([...current, ...savedIds])]);
      setCookie("");
      setMessage("Đã lưu tài khoản Facebook.");
      showToast("Đã lưu tài khoản Facebook.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể lưu tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
      setSavingAccount(false);
      saveAccountLockRef.current = false;
    }
  }

  async function deleteAccount(id: string) {
    setBusy(true);
    setMessage("Đang xóa tài khoản Facebook...");
    try {
      const token = getToken();
      const deviceId = getFacebookAutoDeviceId();
      if (!token) {
        throw new Error("Bạn cần đăng nhập.");
      }

      const response = await fetch("/api/facebook-auto/accounts", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
        body: JSON.stringify({ id })
      });
      const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; status?: BotStatus; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể xóa tài khoản Facebook.");
      setAccounts(data.accounts ?? []);
      if (data.status) setStatus(data.status);
      setSelectedAccountIds((current) => current.filter((accountId) => accountId !== id));
      setMessage("Đã xóa tài khoản Facebook.");
      showToast("Đã xóa tài khoản Facebook.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể xóa tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function checkLiveAccount(id: string) {
    const cooldownUntil = checkLiveCooldowns[id] ?? 0;
    if (cooldownUntil > Date.now()) {
      setMessage(`Vui lòng chờ ${formatCooldown(cooldownUntil)} trước khi check live lại.`);
      return;
    }

    setBusy(true);
    setStatus((current) => ({ ...current, logs: [] }));
    setCheckingAccountIds((current) => (current.includes(id) ? current : [...current, id]));
    setMessage("Đang check live tài khoản Facebook...");
    try {
      const token = getToken();
      if (!token) {
        throw new Error("Bạn cần đăng nhập.");
      }

      const response = await fetch("/api/facebook-auto/accounts", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, clearLogs: true })
      });
      const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; status?: BotStatus; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể check tài khoản Facebook.");
      setAccounts(data.accounts ?? []);
      if (data.status) setStatus(data.status);
      const checked = data.accounts?.find((account) => account.id === id);
      setMessage(checked?.status === "active" ? "Tài khoản đang hoạt động." : "Đã cập nhật trạng thái tài khoản.");
      showToast(checked?.status === "active" ? "Tài khoản đang hoạt động." : "Đã cập nhật trạng thái tài khoản.");
      setCheckLiveCooldowns((current) => ({ ...current, [id]: Date.now() + 5 * 60 * 1000 }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể check tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setCheckingAccountIds((current) => current.filter((accountId) => accountId !== id));
      setBusy(false);
    }
  }

  async function checkLiveSelectedAccounts() {
    if (selectedAccountIds.length === 0) {
      setMessage("Hãy chọn ít nhất một tài khoản Facebook.");
      return;
    }

    setBusy(true);
    setStatus((current) => ({ ...current, logs: [] }));
    setCheckingAccountIds(selectedAccountIds);
    setMessage(`Đang check live ${selectedAccountIds.length} tài khoản đã chọn...`);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("Bạn cần đăng nhập.");
      }

      const deviceId = getFacebookAutoDeviceId();
      const batchSize = 2;
      const ids = [...selectedAccountIds];
      for (let start = 0; start < ids.length; start += batchSize) {
        const batch = ids.slice(start, start + batchSize);
        for (const id of batch) {
          const cooldownUntil = checkLiveCooldowns[id] ?? 0;
          if (cooldownUntil > Date.now()) {
            throw new Error(`Tài khoản ${id} còn chờ ${formatCooldown(cooldownUntil)} trước khi check live lại.`);
          }
        }

        const results = await Promise.allSettled(batch.map(async (id, index) => {
          const response = await fetch("/api/facebook-auto/accounts", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
            body: JSON.stringify({ id, clearLogs: start === 0 && index === 0 })
          });
          const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; status?: BotStatus; message?: string };
          if (!response.ok || data.ok === false) {
            throw new Error(data.message ?? "Không thể check tài khoản Facebook.");
          }
          return { id, accounts: data.accounts, status: data.status };
        }));

        for (const result of results) {
          if (result.status === "rejected") {
            throw result.reason instanceof Error ? result.reason : new Error("Không thể check tài khoản Facebook.");
          }
          if (result.value.accounts) {
            setAccounts(result.value.accounts);
          }
          if (result.value.status) {
            setStatus(result.value.status);
          }
          setCheckLiveCooldowns((current) => ({ ...current, [result.value.id]: Date.now() + 5 * 60 * 1000 }));
        }
      }

      setMessage(`Đã check live ${selectedAccountIds.length} tài khoản đã chọn.`);
      showToast(`Đã check live ${selectedAccountIds.length} tài khoản đã chọn.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể check tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setCheckingAccountIds([]);
      setBusy(false);
    }
  }

  function openEditAccountModal(account: FacebookAutoAccount) {
    setEditingAccount(account);
    setEditCookie("");
    setShowEditAccountModal(true);
  }

  async function saveEditedAccountCookie() {
    if (!editingAccount) return;
    const nextCookie = editCookie.trim();
    if (!nextCookie) {
      setMessage("Vui lòng nhập cookie Facebook.");
      return;
    }

    setBusy(true);
    setMessage("Đang cập nhật cookie tài khoản Facebook...");
    try {
      const token = getToken();
      const deviceId = getFacebookAutoDeviceId();
      if (!token) {
        throw new Error("Bạn cần đăng nhập.");
      }

      const response = await fetch("/api/facebook-auto/accounts", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
        body: JSON.stringify({ id: editingAccount.id, cookie: nextCookie })
      });
      const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; status?: BotStatus; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể cập nhật cookie tài khoản Facebook.");
      setAccounts(data.accounts ?? []);
      if (data.status) setStatus(data.status);
      setShowEditAccountModal(false);
      setEditingAccount(null);
      setEditCookie("");
      setMessage("Đã cập nhật cookie tài khoản Facebook.");
      showToast("Đã cập nhật cookie tài khoản Facebook.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể cập nhật cookie tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((current) => (current.includes(id) ? current.filter((accountId) => accountId !== id) : [...current, id]));
  }

  async function updateAccountProxy(account: FacebookAutoAccount, proxy: string) {
    setBusy(true);
    try {
      const token = getToken();
      const deviceId = getFacebookAutoDeviceId();
      if (!token) throw new Error("Bạn cần đăng nhập.");

      const response = await fetch("/api/facebook-auto/accounts", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
        body: JSON.stringify({ id: account.id, proxy })
      });
      const data = (await response.json()) as { ok: boolean; accounts?: FacebookAutoAccount[]; status?: BotStatus; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể cập nhật proxy tài khoản Facebook.");
      setAccounts(data.accounts ?? []);
      if (data.status) setStatus(data.status);
      showToast(proxy ? "Đã apply proxy cho tài khoản Facebook." : "Đã bỏ proxy khỏi tài khoản Facebook.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật proxy tài khoản Facebook.");
    } finally {
      setBusy(false);
    }
  }

  async function exportSelectedAccounts() {
    if (selectedAccountIds.length === 0) {
      setMessage("Hãy chọn ít nhất một tài khoản để xuất.");
      return;
    }

    setBusy(true);
    setMessage(`Đang xuất ${selectedAccountIds.length} tài khoản Facebook...`);
    try {
      const token = getToken();
      const deviceId = getFacebookAutoDeviceId();
      if (!token) throw new Error("Bạn cần đăng nhập.");

      const response = await fetch("/api/facebook-auto/accounts/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Facebook-Auto-Device-Id": deviceId },
        body: JSON.stringify({ ids: selectedAccountIds })
      });
      const data = (await response.json()) as { ok?: boolean; content?: string; count?: number; message?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message ?? "Không thể xuất dữ liệu tài khoản Facebook.");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      setExportPreviewContent(data.content || "");
      setExportPreviewFileName(`facebook-auto-accounts-${timestamp}.txt`);
      setShowExportPreviewModal(true);

      setMessage(`Đã tạo dữ liệu xuất ${data.count ?? selectedAccountIds.length} tài khoản Facebook.`);
      showToast(`Đã tạo dữ liệu xuất ${data.count ?? selectedAccountIds.length} tài khoản Facebook.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể xuất dữ liệu tài khoản Facebook.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
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

  function toggleReaction(name: string) {
    setSelectedReactions((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function addGroupPostContent() {
    const content = groupPostContents.trim();
    if (!content) {
      setMessage("Nhập nội dung bài đăng trước khi thêm.");
      return;
    }
    setGroupPostItems((current) => {
      const next = [...current, content];
      setGroupPostPage(Math.max(1, Math.ceil(next.length / GROUP_POST_PAGE_SIZE)));
      return next;
    });
    setGroupPostContents("");
    setMessage("Đã thêm nội dung bài đăng group.");
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
    link.download = `facebook-group-post-contents-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Đã xuất ${groupPostItems.length} nội dung bài đăng group.`);
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
    setMessage(`Đã nhập ${importedItems.length} nội dung bài đăng group.`);
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
    setMessage(`Đã xoá ${selected.size} nội dung bài đăng group.`);
  }

  function removeGroupPostContent(index: number) {
    setGroupPostItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedGroupPostIndexes([]);
  }

  function formatCooldown(expiresAt: number) {
    const remainingMs = Math.max(expiresAt - now, 0);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function startBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedAccountIds.length === 0) {
      setMessage("Hãy chọn ít nhất một tài khoản Facebook đã lưu trước khi chạy.");
      return;
    }
    if (activeSelectedAccounts.length === 0) {
      setMessage("Chỉ có thể chạy bot với tài khoản trạng thái hoạt động.");
      return;
    }
    if (totalActionsExceeded) {
      setMessage(`Tổng tác vụ không được vượt quá ${MAX_TOTAL_ACTIONS}.`);
      return;
    }
    setBusy(true);
    setMessage("Đang khởi động bot...");

    try {
      const result = await postJson<{ ok: boolean; status: BotStatus }>("/api/facebook-auto/bot/start", {
        cookie: "",
        accountIds: activeSelectedAccounts.map((account) => account.id),
        enableReact,
        enableComment,
        enableGroup,
        enableGroupComment,
        enableGroupPost,
        enablePokes,
        totalPosts: totalActions,
        reactCount,
        commentCount,
        groupCount,
        groupCommentCount,
        groupPostCount,
        pokesCount,
        reactDelaySeconds,
        commentDelaySeconds,
        groupDelaySeconds,
        groupCommentDelaySeconds,
        groupPostDelaySeconds,
        pokesDelaySeconds,
        randomizeTasks,
        lowResourceMode: effectiveLowResourceMode,
        comments: commentList,
        groupComments: groupCommentList,
        groupPostContents: groupPostItems,
        reactions: selectedReactions,
        groupMode,
        groupLinks,
        groupKeyword,
        groupCommentKeyword,
        groupPostTargetMode,
        groupPostKeyword,
        groupPostLinks,
        refreshGroupPostLinks,
        headlessChrome: effectiveHeadlessChrome
      });
      setStatus(result.status);
      setMessage("Bot đã bắt đầu chạy.");
      showToast("Bot đã bắt đầu chạy.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể khởi động bot.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function stopBot() {
    setBusy(true);
    setMessage("Đang gửi yêu cầu dừng...");
    try {
      const result = await postJson<{ ok: boolean; status: BotStatus }>("/api/facebook-auto/bot/stop");
      setStatus(result.status);
      setMessage("Đã gửi yêu cầu dừng bot.");
      showToast("Đã gửi yêu cầu dừng bot.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể dừng bot.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function togglePauseBot() {
    setBusy(true);
    try {
      const result = await postJson<{ ok: boolean; status: BotStatus }>("/api/facebook-auto/bot/pause");
      setStatus(result.status);
      setMessage(result.status.paused ? "Bot đã tạm dừng." : "Bot tiếp tục chạy.");
      showToast(result.status.paused ? "Bot đã tạm dừng." : "Bot tiếp tục chạy.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể thay đổi trạng thái bot.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function clearResumeJob() {
    setBusy(true);
    setMessage("Đang xoá luồng dang dở...");
    try {
      const result = await postJson<{ ok: boolean; status: BotStatus }>("/api/facebook-auto/bot/clear");
      setStatus(result.status);
      setMessage("Đã xoá luồng dang dở.");
      showToast("Đã xoá luồng dang dở.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể xoá luồng dang dở.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setCookie("");
    setSelectedAccountIds([]);
    setEnableReact(true);
    setEnableComment(false);
    setEnableGroup(false);
    setEnableGroupComment(false);
    setEnableGroupPost(false);
    setSelectedReactions(["Thích"]);
    setComments("");
    setGroupPostContents("");
    setGroupPostItems([]);
    setReactCount(1);
    setCommentCount(1);
    setGroupCount(1);
    setGroupCommentCount(1);
    setGroupPostCount(1);
    setReactDelaySeconds(5);
    setCommentDelaySeconds(5);
    setGroupDelaySeconds(5);
    setGroupCommentDelaySeconds(5);
    setGroupPostDelaySeconds(5);
    setRandomizeTasks(false);
    setHeadlessChrome(true);
    setLowResourceMode(true);
    setRefreshGroupPostLinks(false);
    setGroupMode("links");
    setGroupPostTargetMode("links");
    setGroupPostKeyword("");
    setGroupPostLinksText("");
    setGroupLinksText("");
    setGroupKeyword("");
    setShowEditAccountModal(false);
    setEditingAccount(null);
    setEditCookie("");
    setMessage("Đã đặt lại form.");
  }

  return (
    <AppFrame active="/facebook-auto" title="Facebook Auto">
      <PageHeader
        title="Auto Facebook"
        desc="Lưu tài khoản bằng cookie, chọn tài khoản cần chạy, cấu hình tác vụ và theo dõi tiến trình trong cùng một màn hình."
      />

      <form className="stack facebook-auto-page" onSubmit={startBot}>
        <section className="grid-4">
          <StatCard label="Trạng thái" value={status.paused ? "Tạm dừng" : status.running ? "Đang chạy" : "Đang nghỉ"} help={message} icon="bolt" />
          <StatCard label="Tài khoản chọn" value={String(selectedAccounts.length)} help={selectedAccounts.length ? `${selectedAccounts.length} tài khoản sẵn sàng chạy` : "Chưa chọn tài khoản"} icon="account_circle" />
          <StatCard label="Tiến độ" value={`${status.currentPost}/${status.totalPosts || totalActions}`} help={`${status.progress}% hoàn tất`} icon="monitoring" />
          <StatCard label="Luồng toàn hệ thống" value={`${status.activeWorkers}/${status.maxWorkers}`} help={workerHelp} icon="hub" />
        </section>

        <section className="card pad facebook-auto-progress-card">
          <div className="between">
            <div>
              <h2 style={{ margin: 0 }}>Tiến trình chạy</h2>
              <p className="facebook-auto-estimated-time">{estimatedCompletion}</p>
            </div>
            <strong>{status.progress}%</strong>
          </div>
          <div className="facebook-auto-progress">
            <span style={{ width: `${status.progress}%` }} />
          </div>
        </section>

        <div className="facebook-auto-layout">
          <div className="stack">
            <section className="card pad facebook-auto-config-card">
              <div className="between facebook-auto-section-title">
                <div>
                  <h2><Cookie size={18} /> Tài khoản Facebook</h2>
                  <p className="subtitle">Tài khoản phải ở trạng thái "Hoạt động" mới có thể chạy tương tác được.</p>
                </div>
                <button className="btn btn-secondary" type="button" disabled={busy || showAddAccountModal || savingAccount} onClick={() => setShowAddAccountModal(true)}>
                  <Plus size={16} /> Thêm tài khoản
                </button>
              </div>

              <div className="facebook-auto-account-toolbar">
                <strong>Đã lưu {accounts.length} tài khoản</strong>
                <div className="row">
                  <button className="btn btn-secondary" disabled={accounts.length === 0} type="button" onClick={() => setSelectedAccountIds(accounts.map((account) => account.id))}>
                    Chọn tất cả
                  </button>
                  <button className="btn btn-secondary" disabled={selectedAccountIds.length === 0} type="button" onClick={() => setSelectedAccountIds([])}>
                    Bỏ chọn
                  </button>
                  <button className="btn btn-secondary" disabled={busy || status.running || selectedAccountIds.length === 0} type="button" onClick={checkLiveSelectedAccounts}>
                    <Zap size={16} /> Check live đã chọn
                  </button>
                  <button className="btn btn-secondary" disabled={busy || selectedAccountIds.length === 0} type="button" onClick={exportSelectedAccounts}>
                    <Download size={16} /> Xuất dữ liệu
                  </button>
                </div>
              </div>

              <div className="facebook-auto-account-table-wrap">
                {accounts.length === 0 ? (
                  <div className="facebook-auto-empty-account">
                    Chưa có tài khoản nào. Hãy dán cookie và bấm lưu tài khoản.
                  </div>
                ) : (
                  <table className="facebook-auto-account-table">
                    <thead>
                      <tr>
                        <th>Chọn</th>
                        <th>ID</th>
                        <th>Tên Facebook</th>
                        <th>Facebook ID</th>
                        <th>Trạng thái</th>
                        <th>Tiến trình</th>
                        <th>Proxy</th>
                        <th>Cookie</th>
                        <th>Cập nhật</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => (
                        <tr className={selectedAccountIds.includes(account.id) ? "active" : ""} key={account.id}>
                          <td>
                            <input
                              aria-label={`Chọn ${account.name}`}
                              checked={selectedAccountIds.includes(account.id)}
                              type="checkbox"
                              onChange={() => toggleAccount(account.id)}
                            />
                          </td>
                          <td><strong>{index + 1}</strong></td>
                          <td>{account.facebookName || "—"}</td>
                          <td>{account.userId}</td>
                          <td>
                            {(() => {
                              const isChecking = checkingAccountIds.includes(account.id);
                              const isRunning = (status.activeAccountUserIds ?? []).includes(account.userId);
                              const liveStatus = account.status === "active"
                                ? "Hoạt động"
                                : account.status === "invalid"
                                  ? "Die"
                                  : account.status === "checkpoint"
                                    ? "Checkpoint"
                                    : "Không xác định";
                              return (
                                <div className="stack" style={{ gap: 4 }}>
                                  <span className={`facebook-auto-account-status ${isChecking ? "checking" : isRunning ? "running" : account.status || "unknown"}`}>
                                    {isChecking ? "\u0110ang check live" : isRunning ? "\u0110ang ch\u1ea1y bot" : liveStatus}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            {(() => {
                              const progress = status.accountProgress?.[account.userId];
                              const percent = Math.min(Math.max(progress?.progress ?? 0, 0), 100);
                              const current = progress?.current ?? 0;
                              const total = progress?.total ?? totalActions;
                              return (
                                <div className="facebook-auto-account-progress">
                                  <div className="facebook-auto-account-progress-head">
                                    <strong>{percent}%</strong>
                                    <span>{current}/{total || 0}</span>
                                  </div>
                                  <div className="facebook-auto-account-progress-bar" aria-label={`Tiến trình ${account.name}`}>
                                    <span style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <select
                              className="input"
                              style={{ minWidth: 180 }}
                              value={account.proxy || ""}
                              disabled={busy || status.running}
                              onChange={(event) => updateAccountProxy(account, event.target.value)}
                            >
                              <option value="">Không dùng proxy</option>
                              {proxies.map((item) => (
                                <option value={item.proxy} key={item.id}>{item.name || item.proxy}</option>
                              ))}
                            </select>
                          </td>
                          <td className="facebook-auto-cookie-cell">
                            <span title={account.cookiePreview}>{account.cookiePreview}</span>
                          </td>
                          <td>{new Date(account.updatedAt).toLocaleString("vi-VN")}</td>
                          <td>
                            <div className="row">
                              <button
                                className="btn btn-secondary"
                                disabled={busy || status.running || checkingAccountIds.includes(account.id) || (checkLiveCooldowns[account.id] ?? 0) > Date.now()}
                                type="button"
                                onClick={() => checkLiveAccount(account.id)}
                              >
                                {checkingAccountIds.includes(account.id)
                                  ? "Đang check..."
                                  : (checkLiveCooldowns[account.id] ?? 0) > Date.now()
                                    ? `Chờ ${formatCooldown(checkLiveCooldowns[account.id])}`
                                    : "Check live"}
                              </button>
                              <button className="btn btn-secondary" disabled={busy || status.running} type="button" onClick={() => openEditAccountModal(account)}>
                                <Pencil size={16} /> Sửa cookie
                              </button>
                              <button className="btn btn-secondary" disabled={busy || status.running} type="button" onClick={() => deleteAccount(account.id)}>
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {showAddAccountModal ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => !busy && setShowAddAccountModal(false)}>
                <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="facebook-auto-add-account-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="facebook-auto-add-account-title">Thêm tài khoản</div>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>Dán cookie Facebook, mỗi dòng là một tài khoản.</p>
                    </div>
                    <button className="icon-btn" type="button" aria-label="Đóng" disabled={busy} onClick={() => setShowAddAccountModal(false)}>
                      <Power size={16} />
                    </button>
                  </div>
                  <div className="stack" style={{ gap: 14 }}>
                    <Field label="Cookie Facebook">
                      <textarea
                        className="input facebook-auto-textarea"
                        placeholder={"Dán danh sách cookie, mỗi dòng một tài khoản:\nc_user=10001; xs=...\nc_user=10002; xs=..."}
                        value={cookie}
                        onChange={(event) => setCookie(event.target.value)}
                        rows={10}
                      />
                    </Field>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" type="button" disabled={busy || savingAccount} onClick={() => setShowAddAccountModal(false)}>
                        Hủy
                      </button>
                      <button className="btn btn-red" type="button" disabled={busy || status.running || savingAccount} onClick={saveAccount}>
                        {savingAccount ? "Đang kiểm tra tài khoản" : "Thêm tài khoản"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {showEditAccountModal && editingAccount ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => !busy && setShowEditAccountModal(false)}>
                <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="facebook-auto-edit-account-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="facebook-auto-edit-account-title">Sửa cookie</div>
                      <p className="subtitle" style={{ margin: "6px 0 0" }}>
                        {editingAccount.facebookName || editingAccount.name} - {editingAccount.userId}
                      </p>
                    </div>
                    <button className="icon-btn" type="button" aria-label="Đóng" disabled={busy} onClick={() => setShowEditAccountModal(false)}>
                      <Power size={16} />
                    </button>
                  </div>
                  <div className="stack" style={{ gap: 14 }}>
                    <Field label="Cookie Facebook">
                      <textarea
                        className="input facebook-auto-textarea"
                        placeholder="Dán cookie mới của tài khoản này vào đây"
                        value={editCookie}
                        onChange={(event) => setEditCookie(event.target.value)}
                        rows={10}
                      />
                    </Field>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setShowEditAccountModal(false)}>
                        Hủy
                      </button>
                      <button className="btn btn-red" type="button" disabled={busy} onClick={saveEditedAccountCookie}>
                        Lưu cookie
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {showExportPreviewModal ? (
              <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => setShowExportPreviewModal(false)}>
                <div className="facebook-auto-task-detail facebook-auto-export-preview-modal" role="dialog" aria-modal="true" aria-labelledby="facebook-auto-export-preview-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="facebook-auto-task-detail-header">
                    <div>
                      <div className="facebook-auto-block-label" id="facebook-auto-export-preview-title">Dữ liệu xuất Facebook</div>
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
                <p className="subtitle">
                  Bật tác vụ cần chạy và nhập số lượng cho từng loại.
                  <span className={`facebook-auto-save-state ${settingsSaveState}`}>
                    {settingsSaveState === "saving" ? "Đang lưu..." : settingsSaveState === "error" ? "Lưu thất bại" : settingsSaveState === "saved" ? "Đã lưu Config" : ""}
                  </span>
                </p>
                {false && !systemHeadlessChrome ? (
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="facebook-auto-account-status unknown">
                      Hệ thống đang ép headless tắt
                    </span>
                  </div>
                ) : null}
                {false && systemLowResourceMode ? (
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="facebook-auto-account-status unknown">
                      Hệ thống đang bật chế độ máy yếu
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="facebook-auto-control-block">
                <div className="facebook-auto-block-label">Tác vụ cần chạy</div>
                <div className="facebook-auto-task-grid">
                  <label className={enableReact ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Thả cảm xúc</span>
                      <input checked={enableReact} type="checkbox" onChange={(event) => setEnableReact(event.target.checked)} />
                    </div>
                    <small>Nhập số lượng bài viết cần thả cảm xúc</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={reactCount} onChange={(event) => setReactCount(Number(event.target.value))} disabled={!enableReact} />
                      <button
                        aria-label="Tùy chỉnh Reaction"
                        aria-expanded={activeTaskModal === "react"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "react" ? null : "react")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>

                  <label className={enableComment ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Comment newfeed</span>
                      <input checked={enableComment} type="checkbox" onChange={(event) => setEnableComment(event.target.checked)} />
                    </div>
                    <small>Nhập số lượng bài viết cần comment</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={commentCount} onChange={(event) => setCommentCount(Number(event.target.value))} disabled={!enableComment} />
                      <button
                        aria-label="Tùy chỉnh Comment"
                        aria-expanded={activeTaskModal === "comment"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "comment" ? null : "comment")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>

                  <label className={enableGroup ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Tham gia nhóm</span>
                      <input checked={enableGroup} type="checkbox" onChange={(event) => setEnableGroup(event.target.checked)} />
                    </div>
                    <small>Nhập số lượng nhóm cần tham gia</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={groupCount} onChange={(event) => setGroupCount(Number(event.target.value))} disabled={!enableGroup} />
                      <button
                        aria-label="Tùy chỉnh Join group"
                        aria-expanded={activeTaskModal === "group"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "group" ? null : "group")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>

                  <label className={enableGroupComment ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Comment trong group</span>
                      <input checked={enableGroupComment} type="checkbox" onChange={(event) => setEnableGroupComment(event.target.checked)} />
                    </div>
                    <small>Nhập số lượng bài cần comment.</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={groupCommentCount} onChange={(event) => setGroupCommentCount(Number(event.target.value))} disabled={!enableGroupComment} />
                      <button
                        aria-label="Tùy chỉnh comment group"
                        aria-expanded={activeTaskModal === "groupComment"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "groupComment" ? null : "groupComment")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>

                  <label className={enableGroupPost ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Đăng post group</span>
                      <input checked={enableGroupPost} type="checkbox" onChange={(event) => setEnableGroupPost(event.target.checked)} />
                    </div>
                    <small>Nhập số post cần đăng trong group</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={groupPostCount} onChange={(event) => setGroupPostCount(Number(event.target.value))} disabled={!enableGroupPost} />
                      <button
                        aria-label="Tùy chỉnh Đăng group"
                        aria-expanded={activeTaskModal === "groupPost"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "groupPost" ? null : "groupPost")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>

                  <label className={enablePokes ? "facebook-auto-task-card active" : "facebook-auto-task-card"}>
                    <div className="facebook-auto-task-head">
                      <span>Chọc bạn bè</span>
                      <input checked={enablePokes} type="checkbox" onChange={(event) => setEnablePokes(event.target.checked)} />
                    </div>
                    <small>Mỗi tác vụ bấm một nút Chọc khả dụng trong trang pokes</small>
                    <div className="facebook-auto-task-action">
                      <input className="input facebook-auto-task-number" min={1} max={500} type="number" value={pokesCount} onChange={(event) => setPokesCount(Number(event.target.value))} disabled={!enablePokes} />
                      <button
                        aria-label="Tùy chỉnh Chọc bạn bè"
                        aria-expanded={activeTaskModal === "pokes"}
                        className="icon-btn facebook-auto-task-config-btn"
                        type="button"
                        title="Tùy chỉnh"
                        onClick={() => setActiveTaskModal((current) => current === "pokes" ? null : "pokes")}
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </label>
                </div>

                {activeTaskModal ? (
                  <div className="facebook-auto-modal-backdrop" role="presentation" onMouseDown={() => setActiveTaskModal(null)}>
                    <div className="facebook-auto-task-detail" role="dialog" aria-modal="true" aria-labelledby="facebook-auto-task-detail-title" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="facebook-auto-task-detail-header">
                      <div className="facebook-auto-block-label" id="facebook-auto-task-detail-title">
                        {activeTaskModal === "react"
                          ? "Loại cảm xúc"
                          : activeTaskModal === "comment"
                            ? "Nội dung comment"
                            : activeTaskModal === "group"
                              ? "Cấu hình join group"
                              : activeTaskModal === "groupComment"
                                ? "Cấu hình comment group"
                              : "Cấu hình đăng group"}
                      </div>
                      <button className="btn btn-secondary" type="button" onClick={() => setActiveTaskModal(null)}>Đóng</button>
                    </div>

                    {activeTaskModal === "react" ? (
                      <div className="stack">
                        <div className="facebook-auto-reactions">
                          {reactions.map((name) => (
                            <button
                              className={selectedReactions.includes(name) ? "chip facebook-auto-chip active" : "chip facebook-auto-chip"}
                              key={name}
                              type="button"
                              onClick={() => toggleReaction(name)}
                            >
                              <Zap size={14} /> {name}
                            </button>
                          ))}
                        </div>
                        <Field label="Delay sau mỗi reaction (giây)">
                          <input className="input" min={0} max={3600} type="number" value={reactDelaySeconds} onChange={(event) => setReactDelaySeconds(Number(event.target.value))} />
                        </Field>
                      </div>
                    ) : null}

                    {activeTaskModal === "comment" ? (
                      <div className="stack">
                        <Field label={`Danh sách comment (${commentList.length} nội dung)`}>
                          <textarea className="input facebook-auto-textarea" placeholder="Nhập mỗi comment một dòng" value={comments} onChange={(event) => setComments(event.target.value)} />
                        </Field>
                        <Field label="Delay sau mỗi comment (giây)">
                          <input className="input" min={0} max={3600} type="number" value={commentDelaySeconds} onChange={(event) => setCommentDelaySeconds(Number(event.target.value))} />
                        </Field>
                      </div>
                    ) : null}

                    {activeTaskModal === "group" ? (
                      <div>
                        <div className="facebook-auto-tabs">
                          <button className={groupMode === "links" ? "active" : ""} type="button" onClick={() => setGroupMode("links")}>Theo link</button>
                          <button className={groupMode === "keyword" ? "active" : ""} type="button" onClick={() => setGroupMode("keyword")}>Keyword</button>
                        </div>
                        {groupMode === "links" ? (
                          <Field label={`Danh sách link group (${groupLinks.length} link)`}>
                            <textarea className="input facebook-auto-textarea" placeholder="https://www.facebook.com/groups/example" value={groupLinksText} onChange={(event) => setGroupLinksText(event.target.value)} />
                          </Field>
                        ) : (
                          <Field label="Keyword group">
                            <input className="input" placeholder="Ví dụ: cây cảnh Đà Nẵng" value={groupKeyword} onChange={(event) => setGroupKeyword(event.target.value)} />
                          </Field>
                        )}
                        <Field label="Delay sau mỗi lần join group (giây)">
                          <input className="input" min={0} max={3600} type="number" value={groupDelaySeconds} onChange={(event) => setGroupDelaySeconds(Number(event.target.value))} />
                        </Field>
                      </div>
                    ) : null}

                    {activeTaskModal === "groupComment" ? (
                      <div className="stack">
                        <p className="subtitle" style={{ margin: 0 }}>
                          Bot sẽ lọc group theo keyword nếu có, rồi mở từng group và comment vào số comment bạn chỉ định cho mỗi group.
                        </p>
                        <Field label="Keyword tìm kiếm group">
                          <input
                            className="input"
                            placeholder="Để trống để quét tất cả group đã tham gia"
                            value={groupCommentKeyword}
                            onChange={(event) => setGroupCommentKeyword(event.target.value)}
                          />
                        </Field>
                        <Field label={`Danh sách comment group (${groupCommentList.length} nội dung)`}>
                          <textarea className="input facebook-auto-textarea" placeholder="Nhập mỗi comment group một dòng" value={groupComments} onChange={(event) => setGroupComments(event.target.value)} />
                        </Field>
                      
                        <Field label="Delay sau mỗi comment (giây)">
                          <input className="input" min={0} max={3600} type="number" value={groupCommentDelaySeconds} onChange={(event) => setGroupCommentDelaySeconds(Number(event.target.value))} />
                        </Field>
                      </div>
                    ) : null}

                    {activeTaskModal === "groupPost" ? (
                      <div className="threads-post-config">
                        <div className="facebook-auto-tabs">
                          <button className={groupPostTargetMode === "links" ? "active" : ""} type="button" onClick={() => setGroupPostTargetMode("links")}>Theo link</button>
                          <button className={groupPostTargetMode === "keyword" ? "active" : ""} type="button" onClick={() => setGroupPostTargetMode("keyword")}>Keyword</button>
                        </div>
                        {groupPostTargetMode === "links" ? (
                          <Field label={`Danh sách link group (${groupPostLinks.length} link)`}>
                            <textarea className="input facebook-auto-textarea" placeholder="Mỗi link group một dòng" value={groupPostLinksText} onChange={(event) => setGroupPostLinksText(event.target.value)} />
                          </Field>
                        ) : (
                          <Field label="Keyword group cần đăng">
                            <input className="input" placeholder="Ví dụ: tặng quà" value={groupPostKeyword} onChange={(event) => setGroupPostKeyword(event.target.value)} />
                          </Field>
                        )}
                        <Field label="Số lượng group cần đăng bài">
                          <input
                            className="input"
                            min={1}
                            max={500}
                            type="number"
                            value={groupPostCount}
                            onChange={(event) => setGroupPostCount(Number(event.target.value))}
                            readOnly={groupPostTargetMode === "links"}
                          />
                        </Field>

                        <div className="threads-post-composer">
                          <Field label="Nội dung bài đăng">
                            <textarea className="input facebook-auto-textarea" placeholder="Nhập một nội dung bài đăng, có thể xuống dòng trong cùng một bài." value={groupPostContents} onChange={(event) => setGroupPostContents(event.target.value)} />
                          </Field>
                          <button className="btn btn-secondary threads-post-add-btn" type="button" onClick={addGroupPostContent}>
                            <Plus size={16} /> Thêm nội dung
                          </button>
                        </div>

                        <label className="facebook-auto-check threads-post-refresh-check">
                          <input checked={refreshGroupPostLinks} type="checkbox" onChange={(event) => setRefreshGroupPostLinks(event.target.checked)} />
                          Quét lại danh sách group trước khi đăng
                        </label>

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
                        <div className="facebook-auto-tabs">
                          <button className={groupPostTargetMode === "links" ? "active" : ""} type="button" onClick={() => setGroupPostTargetMode("links")}>Theo link</button>
                          <button className={groupPostTargetMode === "keyword" ? "active" : ""} type="button" onClick={() => setGroupPostTargetMode("keyword")}>Keyword</button>
                        </div>
                        {groupPostTargetMode === "links" ? (
                          <Field label={`Danh sách link group (${groupPostLinks.length} link)`}>
                            <textarea className="input facebook-auto-textarea" placeholder="Mỗi link group một dòng" value={groupPostLinksText} onChange={(event) => setGroupPostLinksText(event.target.value)} />
                          </Field>
                        ) : (
                          <Field label="Keyword group cần đăng">
                            <input className="input" placeholder="Ví dụ: buff follow facebook" value={groupPostKeyword} onChange={(event) => setGroupPostKeyword(event.target.value)} />
                          </Field>
                        )}
                        <Field label="Số lượng group cần đăng bài">
                          <input
                            className="input"
                            min={1}
                            max={500}
                            type="number"
                            value={groupPostCount}
                            onChange={(event) => setGroupPostCount(Number(event.target.value))}
                            readOnly={groupPostTargetMode === "links"}
                          />
                        </Field>
                        <Field label="Nội dung bài đăng">
                          <textarea className="input facebook-auto-textarea" placeholder="Nhập một nội dung bài đăng, có thể xuống dòng trong cùng một bài." value={groupPostContents} onChange={(event) => setGroupPostContents(event.target.value)} />
                        </Field>
                        <div className="facebook-auto-detail-row">
                          <label className="facebook-auto-check">
                            <input checked={refreshGroupPostLinks} type="checkbox" onChange={(event) => setRefreshGroupPostLinks(event.target.checked)} />
                            Quét lại danh sách group trước khi đăng
                          </label>
                          <button className="btn btn-secondary" type="button" onClick={addGroupPostContent}>Thêm nội dung</button>
                        </div>
                        <div className="facebook-auto-content-list">
                          {groupPostItems.length === 0 ? <p className="subtitle">Chưa có nội dung bài đăng nào.</p> : null}
                          {groupPostItems.map((content, index) => (
                            <div className="facebook-auto-content-item" key={`${index}-${content.slice(0, 24)}`}>
                              <div>
                                <strong>Nội dung {index + 1}</strong>
                                <p>{content}</p>
                              </div>
                              <button className="btn btn-secondary" type="button" onClick={() => removeGroupPostContent(index)}>Xóa</button>
                            </div>
                          ))}
                        </div>
                        <Field label="Delay sau mỗi bài đăng group (giây)">
                          <input className="input" min={0} max={3600} type="number" value={groupPostDelaySeconds} onChange={(event) => setGroupPostDelaySeconds(Number(event.target.value))} />
                        </Field>
                      </div>
                    ) : null}

                    {activeTaskModal === "pokes" ? (
                      <div className="stack">
                        <Field label="Số lượt chọc bạn bè">
                          <input className="input" min={1} max={500} type="number" value={pokesCount} onChange={(event) => setPokesCount(Number(event.target.value))} />
                        </Field>
                        <Field label="Delay sau mỗi lần chọc (giây)">
                          <input className="input" min={0} max={3600} type="number" value={pokesDelaySeconds} onChange={(event) => setPokesDelaySeconds(Number(event.target.value))} />
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
                <p className="subtitle">Chọn tài khoản ở bảng bên trên, kiểm tra cấu hình rồi khởi động bot.</p>
              </div>

              <div className="facebook-auto-run-summary">
                <div>
                  <span>Tài khoản chọn</span>
                  <strong>{activeSelectedAccounts.length}/{selectedAccounts.length}</strong>
                </div>
                <div>
                  <span>Tổng tác vụ</span>
                  <strong>{totalActions}/{MAX_TOTAL_ACTIONS}</strong>
                </div>
              </div>
              {totalActionsExceeded ? <p className="subtitle" style={{ color: "var(--danger)" }}>Tổng tác vụ không được vượt quá {MAX_TOTAL_ACTIONS}.</p> : null}

              <div className="facebook-auto-actions">
                {status.running ? (
                  <button className="btn btn-red" type="button" disabled={busy} onClick={togglePauseBot}>
                    {status.paused ? <Play size={17} /> : <Pause size={17} />}
                    {status.paused ? "Tiếp tục bot" : "Tạm dừng"}
                  </button>
                ) : (
                  <button className="btn btn-red" type="submit" disabled={busy || totalActionsExceeded || activeSelectedAccounts.length === 0}><Play size={17} /> Khởi động bot</button>
                )}
                <button className="btn btn-secondary" type="button" disabled={busy || !status.running} onClick={stopBot}><Power size={17} /> Dừng bot</button>
                <button className="btn btn-secondary" type="button" disabled={busy || status.running} onClick={clearResumeJob}><RotateCcw size={17} /> Xoá luồng resume</button>
              </div>
            </section>

            <aside className="card pad facebook-auto-log-card">
              <div className="facebook-auto-section-title">
                <h2><Search size={18} /> Nhật ký hoạt động</h2>
                <p className="subtitle">Log realtime từ tiến trình auto Facebook.</p>
              </div>
              <div className="facebook-auto-log-list" aria-live="polite">
                {status.logs.length === 0 ? <p className="facebook-auto-empty-log">Chưa có log.</p> : null}
                {status.logs.map((entry) => (
                  <div className={`facebook-auto-log-row ${entry.level}`} key={entry.id}>
                    <time>{new Date(entry.createdAt).toLocaleTimeString("vi-VN")}</time>
                    <span>{repairVietnameseDisplayText(entry.message)}</span>
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
