"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io as createSocket, type Socket } from "socket.io-client";
import { AppFrame, Icon, PageHeader } from "../components";
import {
  API_BASE_URL,
  deleteChatConversation,
  fetchFacebookPages,
  fetchChatInbox,
  getToken,
  fetchZaloAccounts,
  sendChatReply,
  syncZaloMessages,
  syncZaloRuntimeAccounts,
  updateChatConversation,
  type ChatAttachment,
  type ChatConversation,
  type ChatMessage,
  type ChatStatus,
  type ChatSource,
  type ChatStats,
  type FacebookPage,
  type ZaloAccount,
} from "../lib/auth";
import { showConfirm, showToast, showError } from "../lib/swal";

const emptyStats: ChatStats = {
  total: 0,
  fanpage: 0,
  zalo: 0,
  webchat: 0,
  waiting: 0,
  ignored_zalo_groups: 0,
};

const sourceLabels = {
  all: "Tất cả",
  fanpage: "Fanpage",
  zalo: "Zalo",
  webchat: "Website",
};

const statusOptions: { value: ChatStatus; label: string }[] = [
  { value: "waiting", label: "Cần trả lời" },
  { value: "open", label: "Đang xử lý" },
  { value: "resolved", label: "Đã xử lý" },
];

const classificationTags = ["Khách mới", "Tư vấn", "Đơn hàng", "Khiếu nại", "Quan tâm", "Spam"];

type ChatRealtimePayload = {
  conversation: ChatConversation;
  stats: ChatStats;
};

type ChatViewerImage = {
  url: string;
  thumb: string;
  title: string;
};

function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seenIds = new Set<number>();
  const seenContent = new Set<string>();
  const result: ChatMessage[] = [];
  for (const message of messages) {
    if (!message || !message.id) continue;
    if (seenIds.has(message.id)) continue;
    seenIds.add(message.id);

    const contentKey = `${message.from}:${message.text || ""}:${formatTime(message.time)}`;
    if (message.text && seenContent.has(contentKey)) continue;
    if (message.text) seenContent.add(contentKey);

    result.push(message);
  }
  return result;
}

function mergeConversationDetail(next: ChatConversation, previous?: ChatConversation) {
  const nextMessages = Array.isArray(next.messages) ? next.messages : [];
  if (nextMessages.length > 0) {
    return { ...next, messages: deduplicateMessages(nextMessages) };
  }
  if (previous?.messages?.length) {
    const validPrevious = previous.messages.filter((message) => message.id > 0);
    return { ...next, messages: deduplicateMessages(validPrevious) };
  }
  return { ...next, messages: [] };
}

function mergeConversationLists(next: ChatConversation[], current: ChatConversation[]) {
  const currentById = new Map(current.map((conversation) => [conversation.id, conversation]));
  return next.map((conversation) => mergeConversationDetail(conversation, currentById.get(conversation.id)));
}

function sourceLabel(source: ChatSource) {
  if (source === "webchat") return "Website";
  return source === "fanpage" ? "Fanpage" : "Zalo";
}

function statusLabel(status: ChatConversation["status"]) {
  if (status === "waiting") return "Cần trả lời";
  if (status === "resolved") return "Đã xử lý";
  return "Đang mở";
}

function parseChatTime(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, year, month, day, hour, minute, second = "0"] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = parseChatTime(value);
  if (!date) return value;
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function ChatAvatar({ conversation, large = false }: { conversation: ChatConversation; large?: boolean }) {
  const className = large ? "chat-avatar large" : "chat-avatar";
  if (conversation.avatar_url) {
    return <img className={className} src={conversation.avatar_url} alt={conversation.customer} />;
  }
  return <span className={className}>{conversation.avatar}</span>;
}

function imageAttachments(attachments: ChatAttachment[]) {
  return attachments.filter((attachment) => {
    const url = attachment.url || attachment.thumb;
    return Boolean(url && (attachment.type === "image" || /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url)));
  });
}

function chatMessagePreviewText(chatMessage?: ChatMessage | null) {
  if (!chatMessage) return "";
  const hasImage = imageAttachments(chatMessage.attachments || []).length > 0;
  return chatMessage.text || (hasImage ? "[ảnh]" : "");
}

function ChatContactDetail({
  conversation,
  onUpdate,
  onToggleAi,
  onToggleTag,
  onDelete,
  onSyncMessages,
  deleting,
  syncingMessages = false,
}: {
  conversation: ChatConversation;
  onUpdate: (data: { status?: ChatStatus; tags?: string[] }) => void;
  onToggleAi: () => void;
  onToggleTag: (tag: string) => void;
  onDelete: () => void;
  onSyncMessages?: () => void;
  deleting: boolean;
  syncingMessages?: boolean;
}) {
  return (
    <div className="chat-contact-detail">
      <div className="chat-contact-head">
        <ChatAvatar conversation={conversation} large />
        <div>
          <h3>{conversation.customer}</h3>
          <span className={`source-badge ${conversation.source}`}>{sourceLabel(conversation.source)}</span>
        </div>
      </div>

      <div className="chat-detail-section">
        <h4>Thông tin tài khoản</h4>
        <dl className="chat-detail-list">
          <div><dt>Kênh</dt><dd>{conversation.channel_name}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statusLabel(conversation.status)}</dd></div>
          <div><dt>Khách hàng ID</dt><dd>{conversation.external_user_id || conversation.external_thread_id}</dd></div>
          <div><dt>Hội thoại ID</dt><dd>{conversation.external_thread_id}</dd></div>
          <div><dt>Tin gần nhất</dt><dd>{formatTime(conversation.time)}</dd></div>
          <div><dt>AI reply</dt><dd>{conversation.ai_enabled ? "Đang bật" : "Đang tắt"}</dd></div>
        </dl>
      </div>

      <div className="chat-detail-section">
        <h4>Trạng thái hội thoại</h4>
        <div className="chat-status-control">
          {statusOptions.map((option) => (
            <button
              className={conversation.status === option.value ? "active" : ""}
              key={option.value}
              type="button"
              onClick={() => onUpdate({ status: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-detail-section">
        <h4>Phân loại</h4>
        <div className="chat-classification-tags">
          {classificationTags.map((tag) => (
            <button
              className={conversation.tags.includes(tag) ? "active" : ""}
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-detail-section">
        <h4>AI trả lời tự động</h4>
        <button
          className={conversation.ai_enabled ? "chat-ai-toggle active" : "chat-ai-toggle"}
          type="button"
          onClick={onToggleAi}
          aria-pressed={conversation.ai_enabled}
        >
          <span><Icon name="smart_toy" size={16} /> {conversation.ai_enabled ? "AI đang bật" : "AI đang tắt"}</span>
          <strong>{conversation.ai_enabled ? "Tắt" : "Bật"}</strong>
        </button>
      </div>

      <div className="chat-detail-section">
        <h4>Thao tác</h4>
        {conversation.source === "zalo" && onSyncMessages ? (
          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
            type="button"
            onClick={onSyncMessages}
            disabled={syncingMessages}
          >
            <Icon name="refresh_cw" size={16} /> {syncingMessages ? "Đang đồng bộ..." : "Đồng bộ tin nhắn"}
          </button>
        ) : null}
        <button className="btn btn-secondary" style={{ color: "#ff8f96", width: "100%", justifyContent: "center" }} type="button" onClick={onDelete} disabled={deleting}>
          <Icon name="trash" size={16} /> {deleting ? "Đang xoá..." : "Xoá hội thoại"}
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const messagePressTimerRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const detailHydrationKeyRef = useRef<string | null>(null);
  const loadInboxRef = useRef<((id: number) => void) | null>(null);
  const initialConversationIdRef = useRef<number | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const filtersRef = useRef({
    sourceFilter: "all" as "all" | ChatSource,
    search: "",
    selectedChannelIds: [] as number[],
  });
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [stats, setStats] = useState<ChatStats>(emptyStats);
  const [sourceFilter, setSourceFilter] = useState<"all" | ChatSource>("all");
  const [zaloAccounts, setZaloAccounts] = useState<ZaloAccount[]>([]);
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [mobileRoomOpen, setMobileRoomOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [pressedMessageId, setPressedMessageId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [syncingMessages, setSyncingMessages] = useState(false);
  const [imageViewer, setImageViewer] = useState<{ images: ChatViewerImage[]; index: number } | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0] ?? null,
    [activeId, conversations]
  );

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const channelOptions = useMemo(() => {
    if (sourceFilter === "zalo") {
      return zaloAccounts.map((account) => ({
        id: account.id,
        label: account.display_name || account.phone_number || account.own_id,
        meta: account.phone_number || account.own_id,
      }));
    }
    if (sourceFilter === "fanpage") {
      return facebookPages.map((page) => ({
        id: page.id,
        label: page.page_name || page.page_id,
        meta: page.category || page.page_id,
      }));
    }
    if (sourceFilter === "webchat") return [];
    return [];
  }, [facebookPages, sourceFilter, zaloAccounts]);

  const visibleSelectedChannelIds = useMemo(
    () => selectedChannelIds.filter((id) => channelOptions.some((option) => option.id === id)),
    [channelOptions, selectedChannelIds]
  );

  useEffect(() => {
    filtersRef.current = {
      sourceFilter,
      search,
      selectedChannelIds: visibleSelectedChannelIds,
    };
  }, [sourceFilter, search, visibleSelectedChannelIds]);

  function conversationMatchesCurrentFilters(conversation: ChatConversation) {
    const current = filtersRef.current;
    if (current.sourceFilter !== "all" && conversation.source !== current.sourceFilter) return false;
    if (current.sourceFilter !== "all" && current.selectedChannelIds.length) {
      if (!conversation.source_ref_id || !current.selectedChannelIds.includes(conversation.source_ref_id)) return false;
    }
    const term = current.search.trim().toLowerCase();
    if (!term) return true;
    return `${conversation.customer} ${conversation.channel_name} ${conversation.last_message}`.toLowerCase().includes(term);
  }

  async function loadInbox(nextActiveId = activeId, markRead = false) {
    try {
      const payload = await fetchChatInbox({
        source: sourceFilter,
        search,
        conversationId: nextActiveId || undefined,
        channelIds: sourceFilter === "all" ? [] : visibleSelectedChannelIds,
        markRead,
      });
      setConversations((current) => mergeConversationLists(payload.conversations, current));
      setStats(payload.stats);
      setActiveId(payload.activeConversationId ?? payload.conversations[0]?.id ?? null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải inbox.");
    } finally {
      setLoading(false);
    }
  }

  // Luôn giữ ref trỏ tới loadInbox mới nhất để socket handler dùng được
  useEffect(() => {
    loadInboxRef.current = (id: number) => loadInbox(id);
  });

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socketUrl = API_BASE_URL.replace(/\/api\/?$/i, "");
    const socket = createSocket(socketUrl, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on("chat:conversation", (payload: ChatRealtimePayload) => {
      if (!payload?.conversation) return;
      setStats(payload.stats || emptyStats);
      const isActiveConversation = activeIdRef.current === payload.conversation.id;
      setConversations((current) => {
        const belongsInList = conversationMatchesCurrentFilters(payload.conversation);
        const withoutCurrent = current.filter((conversation) => conversation.id !== payload.conversation.id);
        if (!belongsInList) return withoutCurrent;
        const previousConversation = current.find((conversation) => conversation.id === payload.conversation.id);
        const mergedConversation = mergeConversationDetail(payload.conversation, previousConversation);
        return [mergedConversation, ...withoutCurrent].sort((a, b) => {
          const aTime = parseChatTime(a.time)?.getTime() || 0;
          const bTime = parseChatTime(b.time)?.getTime() || 0;
          return bTime - aTime;
        });
      });
      setActiveId((current) => current ?? payload.conversation.id);
      // Nếu đây là conversation đang mở → reload ngay để lấy tin nhắn mới từ DB
      if (isActiveConversation) {
        loadInboxRef.current?.(payload.conversation.id);
      }
    });

    socket.on("chat:conversation_deleted", (payload: { conversation_id?: number }) => {
      const deletedId = Number(payload?.conversation_id || 0);
      if (!deletedId) return;
      setConversations((current) => current.filter((conversation) => conversation.id !== deletedId));
      setActiveId((current) => current === deletedId ? null : current);
    });

    socket.on("connect_error", () => {
      showToast("Realtime chat đang mất kết nối, hệ thống sẽ tự kết nối lại.", "warning");
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    Promise.all([fetchZaloAccounts(), fetchFacebookPages()])
      .then(([accounts, pages]) => {
        setZaloAccounts(accounts);
        setFacebookPages(pages);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    setSelectedChannelIds([]);
    setActiveId(null);
    setChannelPickerOpen(false);
    setMobileRoomOpen(false);
    setMobileDetailOpen(false);
  }, [sourceFilter]);

  useEffect(() => {
    if (initialConversationIdRef.current === null) {
      const conversationId = Number(new URLSearchParams(window.location.search).get("conversation_id") || 0);
      initialConversationIdRef.current = Number.isInteger(conversationId) && conversationId > 0 ? conversationId : 0;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      const initialConversationId = initialConversationIdRef.current || null;
      initialConversationIdRef.current = 0;
      loadInbox(initialConversationId);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [sourceFilter, search, visibleSelectedChannelIds.join(",")]);

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (!messagesEl || !activeConversation) return;
    window.requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }, [activeConversation?.id, activeConversation?.messages.length, mobileRoomOpen]);

  useEffect(() => {
    if (!activeConversation) return;
    const latestMessage = activeConversation.messages[activeConversation.messages.length - 1];
    const latestMessageIsStored = latestMessage && latestMessage.id > 0;
    const latestMessageMatchesPreview = latestMessage
      && (latestMessage.time === activeConversation.time || chatMessagePreviewText(latestMessage) === activeConversation.last_message);

    // Đã có đủ tin nhắn khớp preview → không cần load
    if (activeConversation.messages.length && latestMessageIsStored && latestMessageMatchesPreview) {
      detailHydrationKeyRef.current = null;
      return;
    }
    if (!activeConversation.last_message) return;
    // Chỉ dùng id+time+last_message làm key (không dùng messages.length để tránh loop)
    const hydrationKey = `${activeConversation.id}:${activeConversation.time || ""}:${activeConversation.last_message}`;
    if (detailHydrationKeyRef.current === hydrationKey) return;
    detailHydrationKeyRef.current = hydrationKey;
    loadInbox(activeConversation.id);
  }, [activeConversation?.id, activeConversation?.last_message, activeConversation?.time, activeConversation?.messages.length]);

  useEffect(() => {
    setReplyToMessage(null);
    setPressedMessageId(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    return () => {
      if (messagePressTimerRef.current) window.clearTimeout(messagePressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("techmax-mobile-nav", { detail: { hidden: false } }));
    return () => {
      window.dispatchEvent(new CustomEvent("techmax-mobile-nav", { detail: { hidden: false } }));
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("techmax-mobile-nav", { detail: { hidden: mobileRoomOpen } }));
  }, [mobileRoomOpen]);

  useEffect(() => {
    if (!imageViewer) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setImageViewer(null);
      if (event.key === "ArrowLeft") {
        setImageViewer((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current);
      }
      if (event.key === "ArrowRight") {
        setImageViewer((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imageViewer]);

  function toggleChannel(id: number) {
    setSelectedChannelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectAllVisibleChannels() {
    setSelectedChannelIds(channelOptions.map((option) => option.id));
  }

  const selectedChannelLabel = visibleSelectedChannelIds.length
    ? `${visibleSelectedChannelIds.length}/${channelOptions.length} đã chọn`
    : sourceFilter === "zalo" ? "Tất cả tài khoản" : sourceFilter === "fanpage" ? "Tất cả Fanpage" : "Website";

  async function handleSelectConversation(id: number) {
    setActiveId(id);
    setMobileRoomOpen(true);
    setMobileDetailOpen(false);
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, unread: 0 } : conversation));
    await loadInbox(id, true);
  }

  async function handleSyncZalo() {
    setSyncing(true);
    try {
      const payload = await syncZaloRuntimeAccounts();
      showToast(payload.message || "Đã đồng bộ Zalo.");
      await loadInbox(activeId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đồng bộ Zalo.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpdateConversation(data: { status?: ChatStatus; tags?: string[]; ai_enabled?: boolean }) {
    if (!activeConversation) return;
    try {
      const updated = await updateChatConversation(activeConversation.id, data);
      setConversations((current) => current.map((conversation) => conversation.id === updated.id ? updated : conversation));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật hội thoại.");
    }
  }

  function toggleConversationTag(tag: string) {
    if (!activeConversation) return;
    const exists = activeConversation.tags.includes(tag);
    const tags = exists ? activeConversation.tags.filter((item) => item !== tag) : [...activeConversation.tags, tag];
    handleUpdateConversation({ tags });
  }

  function toggleConversationAi() {
    if (!activeConversation) return;
    handleUpdateConversation({ ai_enabled: !activeConversation.ai_enabled });
  }

  async function handleDeleteConversation() {
    if (!activeConversation || deletingConversation) return;
    if (!(await showConfirm(`Xoá hội thoại với "${activeConversation.customer}"? Tin nhắn đã lưu trong hệ thống sẽ bị xoá.`))) return;
    const deletedId = activeConversation.id;
    setDeletingConversation(true);
    try {
      const successMessage = await deleteChatConversation(deletedId);
      const nextConversations = conversations.filter((conversation) => conversation.id !== deletedId);
      setConversations(nextConversations);
      setActiveId(nextConversations[0]?.id ?? null);
      setMobileDetailOpen(false);
      setMobileRoomOpen(Boolean(nextConversations[0]));
      await loadInbox(nextConversations[0]?.id ?? undefined);
      showToast(successMessage);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xoá hội thoại.", "error");
    } finally {
      setDeletingConversation(false);
    }
  }

  async function handleSyncZaloMessages() {
    if (!activeConversation || syncingMessages) return;
    if (activeConversation.source !== "zalo" || !activeConversation.source_ref_id) {
      showToast("Chỉ hỗ trợ đồng bộ tin nhắn Zalo.", "warning");
      return;
    }
    setSyncingMessages(true);
    try {
      const result = await syncZaloMessages(activeConversation.source_ref_id);
      showToast(result.message || "Đã gửi yêu cầu đồng bộ. Tin nhắn sẽ cập nhật sau vài giây...");
      // Chờ 3 giây rồi reload để listener kịp trả về dữ liệu
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await loadInbox(activeConversation.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Đồng bộ thất bại.");
    } finally {
      setSyncingMessages(false);
    }
  }

  async function handleSendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation || (!reply.trim() && !selectedImage)) return;
    setSending(true);
    try {
      const updated = await sendChatReply(activeConversation.id, {
        message: reply.trim(),
        imageDataUrl: selectedImage?.dataUrl || null,
        replyToMessageId: replyToMessage?.id || null,
      });
      setConversations((current) => current.map((conversation) => conversation.id === updated.id ? updated : conversation));
      setReply("");
      setReplyToMessage(null);
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể gửi tin nhắn.", "error");
    } finally {
      setSending(false);
    }
  }

  function handleSelectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      showToast("Vui lòng chọn ảnh PNG, JPG, WEBP hoặc GIF.", "error");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast("Ảnh tối đa 6MB.", "error");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage({ name: file.name, dataUrl: String(reader.result || "") });
    };
    reader.onerror = () => showToast("Không thể đọc file ảnh.", "error");
    reader.readAsDataURL(file);
  }

  function messagePreviewText(chatMessage: ChatMessage) {
    const hasImage = imageAttachments(chatMessage.attachments || []).length > 0;
    return chatMessage.text || (hasImage ? "[ảnh]" : "[tin nhắn]");
  }

  function handleReplyToMessage(chatMessage: ChatMessage) {
    setReplyToMessage(chatMessage);
    setPressedMessageId(null);
    window.requestAnimationFrame(() => replyInputRef.current?.focus());
  }

  function startMessagePress(messageId: number) {
    if (messagePressTimerRef.current) window.clearTimeout(messagePressTimerRef.current);
    messagePressTimerRef.current = window.setTimeout(() => {
      setPressedMessageId(messageId);
    }, 420);
  }

  function cancelMessagePress() {
    if (messagePressTimerRef.current) {
      window.clearTimeout(messagePressTimerRef.current);
      messagePressTimerRef.current = null;
    }
  }

  function scrollToQuotedMessage(quote: ChatMessage["quote"]) {
    if (!quote || !activeConversation) return;
    const quotedMessage = activeConversation.messages.find((message) => {
      if (quote.id && message.id === quote.id) return true;
      if (quote.external_message_id && message.external_message_id === quote.external_message_id) return true;
      if (quote.cli_message_id && message.external_message_id === quote.cli_message_id) return true;
      return false;
    });
    if (!quotedMessage) return;
    const element = document.getElementById(`chat-message-${quotedMessage.id}`);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    element?.classList.add("message-row-highlight");
    window.setTimeout(() => element?.classList.remove("message-row-highlight"), 1400);
  }

  return (
    <AppFrame active="/chat" title="Chat Inbox">
      <div className="chat-page-header">
        <PageHeader
          title="Tin nhắn khách hàng"
          action={
            <div className="row">

              {/* <button className="btn btn-red" disabled={loading} onClick={() => loadInbox(activeId)} type="button">
                <Icon name="update" /> Làm mới
              </button> */}
            </div>
          }
        />
      </div>

      {/* Banners removed per toast request */}

      <section className="chat-stats">
        <div><strong>{stats.total}</strong><span>Hội thoại</span></div>
        <div><strong>{stats.fanpage}</strong><span>Fanpage</span></div>
        <div><strong>{stats.zalo}</strong><span>Zalo</span></div>
        <div><strong>{stats.webchat}</strong><span>Website</span></div>
        <div><strong>{stats.waiting}</strong><span>Cần phản hồi</span></div>
      </section>

      <section className={mobileRoomOpen ? "chat-workspace mobile-room-open" : "chat-workspace"}>
        <aside className="chat-list-panel">
          <div className="chat-filter-bar">
            <div className="chat-search">
              <Icon name="search" size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách hàng hoặc nội dung" />
            </div>
            <div className="chat-source-tabs" role="tablist" aria-label="Lọc nguồn chat">
              {(["all", "fanpage", "zalo", "webchat"] as const).map((source) => (
                <button className={sourceFilter === source ? "active" : ""} key={source} onClick={() => setSourceFilter(source)} type="button">
                  {sourceLabels[source]}
                </button>
              ))}
            </div>
            {sourceFilter !== "all" && sourceFilter !== "webchat" ? (
              <div className="chat-channel-filter">
                <span>{sourceFilter === "zalo" ? "Tài khoản Zalo" : "Fanpage"}</span>
                <button className="chat-channel-picker-trigger" type="button" onClick={() => setChannelPickerOpen(true)}>
                  <strong>{selectedChannelLabel}</strong>
                  <span>{sourceFilter === "zalo" ? "Chọn tài khoản" : "Chọn Fanpage"}</span>
                </button>
                <div className="chat-channel-filter-head">
                  <span>{sourceFilter === "zalo" ? "Tài khoản Zalo" : "Fanpage"}</span>
                  <div className="row compact-row">
                    <button type="button" onClick={selectAllVisibleChannels} disabled={!channelOptions.length}>Tất cả</button>
                    <button type="button" onClick={() => setSelectedChannelIds([])} disabled={!visibleSelectedChannelIds.length}>Bỏ lọc</button>
                  </div>
                </div>
                <div className="chat-channel-chips">
                  {channelOptions.length ? channelOptions.map((option) => (
                    <button
                      className={visibleSelectedChannelIds.includes(option.id) ? "active" : ""}
                      key={option.id}
                      onClick={() => toggleChannel(option.id)}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.meta}</span>
                    </button>
                  )) : (
                    <p>{sourceFilter === "zalo" ? "Chưa có tài khoản Zalo." : "Chưa có Fanpage."}</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="chat-list">
            {loading ? (
              <div className="chat-empty"><Icon name="timer" size={42} /><p>Đang tải inbox...</p></div>
            ) : conversations.length ? conversations.map((conversation) => (
              <button
                className={activeConversation?.id === conversation.id ? "chat-thread active" : "chat-thread"}
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                type="button"
              >
                <ChatAvatar conversation={conversation} />
                <span className="chat-thread-body">
                  <span className="chat-thread-top">
                    <strong>{conversation.customer}</strong>
                    <time>{formatTime(conversation.time)}</time>
                  </span>
                  <span className="chat-thread-meta">
                    <span className={`source-badge ${conversation.source}`}>{sourceLabel(conversation.source)}</span>
                    <span className="chat-thread-channel">{conversation.channel_name}</span>
                    <span className={`chat-status-badge ${conversation.status}`}>{statusLabel(conversation.status)}</span>
                  </span>
                  <span className="chat-thread-preview">{conversation.last_message}</span>
                </span>
                {conversation.unread ? <span className="chat-unread">{conversation.unread}</span> : null}
              </button>
            )) : (
              <div className="chat-empty"><Icon name="message_circle" size={48} /><p>Chưa có hội thoại thật từ webhook.</p></div>
            )}
          </div>
        </aside>

        <div className="chat-room">
          {activeConversation ? (
            <>
              <header className="chat-room-head">
                <div className="row">
                  <button className="chat-mobile-back" type="button" onClick={() => { setMobileDetailOpen(false); setMobileRoomOpen(false); }} aria-label="Quay lại danh sách">
                    <Icon name="chevron_left" size={22} />
                  </button>
                  <ChatAvatar conversation={activeConversation} large />
                  <div>
                    <div className="row compact-row">
                      <h2>{activeConversation.customer}</h2>
                      <span className={`source-badge ${activeConversation.source}`}>{sourceLabel(activeConversation.source)}</span>
                    </div>
                    <p>{activeConversation.channel_name} - {statusLabel(activeConversation.status)}</p>
                  </div>
                </div>
                <div className="chat-tags">
                  {activeConversation.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <button className="chat-mobile-detail-button" type="button" onClick={() => setMobileDetailOpen(true)} aria-label="Mở thông tin chi tiết">
                  <span />
                  <span />
                  <span />
                </button>
              </header>

              <div className="chat-messages" ref={messagesRef}>
                {activeConversation.messages.length ? activeConversation.messages.map((chatMessage, index) => {
                  const nextMessage = activeConversation.messages[index + 1];
                  const isLastInSenderGroup = !nextMessage || nextMessage.from !== chatMessage.from;
                  const images = imageAttachments(chatMessage.attachments || []).map((attachment) => {
                    const imageUrl = attachment.url || attachment.thumb || "";
                    return {
                      url: imageUrl,
                      thumb: attachment.thumb || imageUrl,
                      title: attachment.title || "Chat image",
                    };
                  }).filter((attachment) => attachment.url);
                  const text = images.length && chatMessage.text === "[Ảnh]" ? "" : chatMessage.text;
                  return (
                    <div id={`chat-message-${chatMessage.id}`} className={`${chatMessage.from === "agent" ? "message-row agent" : "message-row"}${pressedMessageId === chatMessage.id ? " actions-open" : ""}`} key={chatMessage.id}>
                      <div
                        className={images.length ? "message-bubble has-media" : "message-bubble"}
                        onPointerDown={(event) => {
                          if (event.pointerType !== "mouse") startMessagePress(chatMessage.id);
                        }}
                        onPointerUp={cancelMessagePress}
                        onPointerCancel={cancelMessagePress}
                        onPointerLeave={cancelMessagePress}
                      >
                        {chatMessage.quote?.text ? (
                          <button className="message-quote" type="button" onClick={() => scrollToQuotedMessage(chatMessage.quote)}>
                            <strong>{chatMessage.quote.name || "Tin nhắn được trả lời"}</strong>
                            <span>{chatMessage.quote.text}</span>
                          </button>
                        ) : null}
                        {images.length ? (
                          <div className="message-attachments">
                            {images.map((attachment, index) => (
                              <button
                                className="message-image-button"
                                type="button"
                                key={`${chatMessage.id}-${index}`}
                                onClick={() => setImageViewer({ images, index })}
                                aria-label="Mo anh chi tiet"
                              >
                                <img src={attachment.thumb} alt={attachment.title} />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {text ? <p>{text}</p> : null}
                        {isLastInSenderGroup ? <time>{formatTime(chatMessage.time)}</time> : null}
                      </div>
                      <div className="message-actions">
                        <button type="button" onClick={() => handleReplyToMessage(chatMessage)}>
                          <Icon name="reply" size={14} /> Trả lời
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="chat-empty"><Icon name="mail" size={42} /><p>Chọn hội thoại để xem tin nhắn.</p></div>
                )}
              </div>

              <form className="chat-composer" onSubmit={handleSendReply}>
                {replyToMessage ? (
                  <div className="chat-reply-preview">
                    <div>
                      <strong>Đang trả lời {replyToMessage.sender_name || (replyToMessage.from === "agent" ? "nhân viên" : activeConversation.customer)}</strong>
                      <span>{messagePreviewText(replyToMessage)}</span>
                    </div>
                    <button type="button" onClick={() => setReplyToMessage(null)} aria-label="Bỏ reply">
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ) : null}
                {selectedImage ? (
                  <div className="chat-image-preview">
                    <img src={selectedImage.dataUrl} alt={selectedImage.name} />
                    <span>{selectedImage.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Bỏ ảnh"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ) : null}
                <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleSelectImage} />
                <button className="chat-attach-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Chọn ảnh">
                  <Icon name="add" size={18} />
                </button>
                <input ref={replyInputRef} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nhập tin nhắn trả lời..." />
                <button className="btn btn-red" disabled={(!reply.trim() && !selectedImage) || sending} type="submit">
                  <Icon name="campaign" size={18} /> {sending ? "Gửi" : "Gửi"}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <Icon name="message_circle" size={56} />
              <p>Không có hội thoại phù hợp bộ lọc.</p>
            </div>
          )}
        </div>

        <aside className="chat-detail-panel">
          {activeConversation ? (
            <>
              <ChatContactDetail
                conversation={activeConversation}
                onUpdate={handleUpdateConversation}
                onToggleAi={toggleConversationAi}
                onToggleTag={toggleConversationTag}
                onDelete={handleDeleteConversation}
                onSyncMessages={handleSyncZaloMessages}
                deleting={deletingConversation}
                syncingMessages={syncingMessages}
              />
              <div className="chat-contact-detail chat-contact-detail-legacy">
                <div className="chat-contact-head">
                  <ChatAvatar conversation={activeConversation} large />
                  <div>
                    <h3>{activeConversation.customer}</h3>
                    <span className={`source-badge ${activeConversation.source}`}>{sourceLabel(activeConversation.source)}</span>
                  </div>
                </div>

                <div className="chat-detail-section">
                  <h4>Thông tin tài khoản</h4>
                  <dl className="chat-detail-list">
                    <div><dt>Kênh</dt><dd>{activeConversation.channel_name}</dd></div>
                    <div><dt>Trạng thái</dt><dd>{statusLabel(activeConversation.status)}</dd></div>
                    <div><dt>Khách hàng ID</dt><dd>{activeConversation.external_user_id || activeConversation.external_thread_id}</dd></div>
                    <div><dt>Hội thoại ID</dt><dd>{activeConversation.external_thread_id}</dd></div>
                    <div><dt>Tin gần nhất</dt><dd>{formatTime(activeConversation.time)}</dd></div>
                  </dl>
                </div>

                <div className="chat-detail-section">
                  <h4>Trạng thái hội thoại</h4>
                  <div className="chat-status-control">
                    {statusOptions.map((option) => (
                      <button
                        className={activeConversation.status === option.value ? "active" : ""}
                        key={option.value}
                        type="button"
                        onClick={() => handleUpdateConversation({ status: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="chat-detail-section">
                  <h4>Phân loại</h4>
                  <div className="chat-classification-tags">
                    {classificationTags.map((tag) => (
                      <button
                        className={activeConversation.tags.includes(tag) ? "active" : ""}
                        key={tag}
                        type="button"
                        onClick={() => toggleConversationTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="chat-empty detail-empty">
              <Icon name="message_circle" size={42} />
              <p>Chọn hội thoại để xem thông tin chi tiết.</p>
            </div>
          )}
        </aside>

        {/* <aside className="chat-detail-panel chat-detail-legacy">
          <h3>Phân loại nguồn</h3>
          <div className="source-rule-card fanpage">
            <strong>Fanpage</strong>
            <span>Nhận tin nhắn thật qua webhook Facebook Page đã cấu hình.</span>
          </div>
          <div className="source-rule-card zalo">
            <strong>Zalo</strong>
            <span>Nhận tin nhắn từ listener Zalo nội bộ bằng zca-js. Group Zalo bị lọc trước khi lưu vào inbox.</span>
          </div>
          <div className="chat-note">
            <Icon name="security" size={18} />
            <span>Quy tắc lọc hiện tại: <strong>source = zalo</strong> và <strong>thread_kind = group</strong> sẽ không hiển thị trong danh sách chat.</span>
          </div>
        </aside> */}
      </section>

      {mobileDetailOpen && activeConversation ? (
        <div className="chat-mobile-detail-backdrop" role="presentation" onMouseDown={() => setMobileDetailOpen(false)}>
          <aside className="chat-mobile-detail-sheet" role="dialog" aria-modal="true" aria-label="Thông tin chi tiết" onMouseDown={(event) => event.stopPropagation()}>
            <header className="chat-mobile-detail-head">
              <strong>Thông tin chi tiết</strong>
              <button type="button" onClick={() => setMobileDetailOpen(false)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </header>
            <ChatContactDetail
              conversation={activeConversation}
              onUpdate={handleUpdateConversation}
              onToggleAi={toggleConversationAi}
              onToggleTag={toggleConversationTag}
              onDelete={handleDeleteConversation}
              onSyncMessages={handleSyncZaloMessages}
              deleting={deletingConversation}
              syncingMessages={syncingMessages}
            />
          </aside>
        </div>
      ) : null}

      {channelPickerOpen && sourceFilter !== "all" && sourceFilter !== "webchat" ? (
        <div className="chat-picker-backdrop" role="presentation" onMouseDown={() => setChannelPickerOpen(false)}>
          <div className="chat-picker-modal" role="dialog" aria-modal="true" aria-label="Chọn kênh chat" onMouseDown={(event) => event.stopPropagation()}>
            <header className="chat-picker-head">
              <div>
                <h3>{sourceFilter === "zalo" ? "Chọn tài khoản Zalo" : "Chọn Fanpage"}</h3>
                <p>{visibleSelectedChannelIds.length ? selectedChannelLabel : "Không lọc kênh nào"}</p>
              </div>
              <button type="button" onClick={() => setChannelPickerOpen(false)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </header>
            <div className="chat-picker-actions">
              <button type="button" onClick={selectAllVisibleChannels} disabled={!channelOptions.length}>Tất cả</button>
              <button type="button" onClick={() => setSelectedChannelIds([])} disabled={!visibleSelectedChannelIds.length}>Bỏ lọc</button>
            </div>
            <div className="chat-picker-list">
              {channelOptions.length ? channelOptions.map((option) => (
                <label className="chat-picker-item" key={option.id}>
                  <input
                    type="checkbox"
                    checked={visibleSelectedChannelIds.includes(option.id)}
                    onChange={() => toggleChannel(option.id)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <em>{option.meta}</em>
                  </span>
                </label>
              )) : (
                <div className="chat-picker-empty">{sourceFilter === "zalo" ? "Chưa có tài khoản Zalo." : "Chưa có Fanpage."}</div>
              )}
            </div>
            <footer className="chat-picker-footer">
              <button className="btn btn-red" type="button" onClick={() => setChannelPickerOpen(false)}>Áp dụng</button>
            </footer>
          </div>
        </div>
      ) : null}

      {imageViewer ? (
        <div className="chat-image-viewer" role="dialog" aria-modal="true" aria-label="Xem anh chi tiet" onMouseDown={() => setImageViewer(null)}>
          <div className="chat-image-viewer-count">{imageViewer.index + 1} / {imageViewer.images.length}</div>
          <button className="chat-image-viewer-close" type="button" onClick={() => setImageViewer(null)} aria-label="Dong">
            <Icon name="x" size={24} />
          </button>
          {imageViewer.images.length > 1 ? (
            <>
              <button
                className="chat-image-viewer-nav prev"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImageViewer((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current);
                }}
                disabled={imageViewer.index === 0}
                aria-label="Anh truoc"
              >
                <Icon name="chevron_left" size={26} />
              </button>
              <button
                className="chat-image-viewer-nav next"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImageViewer((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current);
                }}
                disabled={imageViewer.index >= imageViewer.images.length - 1}
                aria-label="Anh sau"
              >
                <Icon name="chevron_right" size={26} />
              </button>
            </>
          ) : null}
          <img
            src={imageViewer.images[imageViewer.index]?.url}
            alt={imageViewer.images[imageViewer.index]?.title || "Chat image"}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </AppFrame>
  );
}
