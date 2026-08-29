"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io as createSocket, type Socket } from "socket.io-client";
import {
  API_BASE_URL,
  deleteAdminChatConversation,
  fetchAdminChatInbox,
  getToken,
  sendAdminChatReply,
  updateAdminChatConversation,
  type ChatAttachment,
  type ChatConversation,
  type ChatMessage,
  type ChatSource,
  type ChatStats,
  type ChatStatus,
} from "../../lib/auth";
import { Icon } from "../../components";
import { showConfirm, showError, showToast } from "../../lib/swal";

const emptyStats: ChatStats = { total: 0, fanpage: 0, zalo: 0, webchat: 0, waiting: 0, ignored_zalo_groups: 0 };
const sourceLabels = { all: "Tất cả", fanpage: "Fanpage", zalo: "Zalo", webchat: "Website" };
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

function mergeConversationDetail(next: ChatConversation, previous?: ChatConversation) {
  const nextMessages = Array.isArray(next.messages) ? next.messages : [];
  if (nextMessages.length || !previous?.messages?.length) {
    return { ...next, messages: nextMessages };
  }
  return { ...next, messages: previous.messages };
}

function sourceLabel(source: ChatSource) {
  if (source === "webchat") return "Website";
  return source === "fanpage" ? "Fanpage" : "Zalo";
}

function statusLabel(status: ChatStatus) {
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
  if (conversation.avatar_url) return <img className={className} src={conversation.avatar_url} alt={conversation.customer} />;
  return <span className={className}>{conversation.avatar}</span>;
}

function imageAttachments(attachments: ChatAttachment[]) {
  return attachments.filter((attachment) => {
    const url = attachment.url || attachment.thumb;
    return Boolean(url && (attachment.type === "image" || /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url)));
  });
}

function messagePreviewText(message: ChatMessage) {
  if (message.text) return message.text;
  if (message.attachments?.length) return "[Ảnh]";
  return "[Tin nhắn]";
}

export default function AdminChatPage() {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const filtersRef = useRef({ sourceFilter: "all" as "all" | ChatSource, search: "" });
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [stats, setStats] = useState<ChatStats>(emptyStats);
  const [sourceFilter, setSourceFilter] = useState<"all" | ChatSource>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0] ?? null,
    [activeId, conversations]
  );

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    filtersRef.current = { sourceFilter, search };
  }, [sourceFilter, search]);

  function conversationMatchesCurrentFilters(conversation: ChatConversation) {
    const current = filtersRef.current;
    if (current.sourceFilter !== "all" && conversation.source !== current.sourceFilter) return false;
    const term = current.search.trim().toLowerCase();
    if (!term) return true;
    return `${conversation.customer} ${conversation.channel_name} ${conversation.last_message} ${conversation.owner?.fullname || ""} ${conversation.owner?.email || ""}`.toLowerCase().includes(term);
  }

  async function loadInbox(nextActiveId = activeId, markRead = false) {
    try {
      const payload = await fetchAdminChatInbox({
        source: sourceFilter,
        search,
        conversationId: nextActiveId || undefined,
        markRead,
      });
      setConversations(payload.conversations);
      setStats(payload.stats);
      setActiveId(payload.activeConversationId ?? payload.conversations[0]?.id ?? null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải hội thoại.");
    } finally {
      setLoading(false);
    }
  }

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
    });

    socket.on("chat:conversation_deleted", (payload: { conversation_id?: number }) => {
      const deletedId = Number(payload?.conversation_id || 0);
      if (!deletedId) return;
      setConversations((current) => current.filter((conversation) => conversation.id !== deletedId));
      setActiveId((current) => current === deletedId ? null : current);
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => loadInbox(null), 250);
    return () => window.clearTimeout(timer);
  }, [sourceFilter, search]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !activeConversation) return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [activeConversation?.id, activeConversation?.messages.length]);

  async function handleSelectConversation(id: number) {
    setActiveId(id);
    setReplyToMessage(null);
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, unread: 0 } : conversation));
    await loadInbox(id, true);
  }

  async function handleUpdateConversation(data: { status?: ChatStatus; tags?: string[]; ai_enabled?: boolean }) {
    if (!activeConversation) return;
    try {
      const updated = await updateAdminChatConversation(activeConversation.id, data);
      setConversations((current) => current.map((conversation) => conversation.id === updated.id ? updated : conversation));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật hội thoại.");
    }
  }

  function toggleTag(tag: string) {
    if (!activeConversation) return;
    const exists = activeConversation.tags.includes(tag);
    const tags = exists ? activeConversation.tags.filter((item) => item !== tag) : [...activeConversation.tags, tag];
    handleUpdateConversation({ tags });
  }

  async function handleDeleteConversation() {
    if (!activeConversation || deleting) return;
    if (!(await showConfirm(`Xoá hội thoại với "${activeConversation.customer}"?`))) return;
    const deletedId = activeConversation.id;
    setDeleting(true);
    try {
      const message = await deleteAdminChatConversation(deletedId);
      const next = conversations.filter((conversation) => conversation.id !== deletedId);
      setConversations(next);
      setActiveId(next[0]?.id ?? null);
      showToast(message);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá hội thoại.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation || (!reply.trim() && !selectedImage)) return;
    setSending(true);
    try {
      const updated = await sendAdminChatReply(activeConversation.id, {
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
      showError(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  function handleSelectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      showError("Vui lòng chọn ảnh PNG, JPG, WEBP hoặc GIF.");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showError("Ảnh không được vượt quá 6MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSelectedImage({ name: file.name, dataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Quản lý cuộc hội thoại</h1>
        </div>

      </div>

      <div className="chat-stats admin-chat-stats" style={{ marginBottom: 16 }}>
        <div><strong>{stats.total ?? 0}</strong><span>Tổng hội thoại</span></div>
        <div><strong>{stats.waiting ?? 0}</strong><span>Cần trả lời</span></div>
        <div><strong>{stats.zalo ?? 0}</strong><span>Zalo</span></div>
        <div><strong>{stats.fanpage ?? 0}</strong><span>Fanpage</span></div>
        <div><strong>{stats.webchat ?? 0}</strong><span>Website</span></div>
      </div>

      <section className="chat-workspace admin-chat-workspace">
        <aside className="chat-list-panel">
          <div className="chat-filters">
            <div className="chat-search">
              <Icon name="search" size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách, user, kênh, tin nhắn..." />
            </div>
            <div className="chat-source-tabs">
              {(Object.keys(sourceLabels) as Array<"all" | ChatSource>).map((source) => (
                <button className={sourceFilter === source ? "active" : ""} type="button" key={source} onClick={() => setSourceFilter(source)}>
                  {sourceLabels[source]}
                </button>
              ))}
            </div>
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
                  <span className="chat-thread-preview">{conversation.owner?.fullname || conversation.owner?.email || "User"} - {conversation.last_message}</span>
                </span>
                {conversation.unread ? <span className="chat-unread">{conversation.unread}</span> : null}
              </button>
            )) : (
              <div className="chat-empty"><Icon name="message_circle" size={48} /><p>Chưa có hội thoại phù hợp.</p></div>
            )}
          </div>
        </aside>

        <div className="chat-room">
          {activeConversation ? (
            <>
              <header className="chat-room-head">
                <div className="row">
                  <ChatAvatar conversation={activeConversation} large />
                  <div>
                    <div className="row compact-row">
                      <h2>{activeConversation.customer}</h2>
                      <span className={`source-badge ${activeConversation.source}`}>{sourceLabel(activeConversation.source)}</span>
                    </div>
                    <p>{activeConversation.channel_name} - {activeConversation.owner?.fullname || activeConversation.owner?.email || "Không rõ user"}</p>
                  </div>
                </div>
                <div className="chat-tags">
                  {activeConversation.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </header>

              <div className="chat-messages" ref={messagesRef}>
                {activeConversation.messages.length ? activeConversation.messages.map((chatMessage, index) => {
                  const nextMessage = activeConversation.messages[index + 1];
                  const isLastInSenderGroup = !nextMessage || nextMessage.from !== chatMessage.from;
                  const images = imageAttachments(chatMessage.attachments || []).map((attachment) => {
                    const imageUrl = attachment.url || attachment.thumb || "";
                    return { url: imageUrl, thumb: attachment.thumb || imageUrl, title: attachment.title || "Chat image" };
                  }).filter((attachment) => attachment.url);
                  const text = images.length && chatMessage.text === "[ảnh]" ? "" : chatMessage.text;
                  return (
                    <div id={`chat-message-${chatMessage.id}`} className={chatMessage.from === "agent" ? "message-row agent" : "message-row"} key={chatMessage.id}>
                      <div className={images.length ? "message-bubble has-media" : "message-bubble"}>
                        {chatMessage.quote?.text ? (
                          <button className="message-quote" type="button">
                            <strong>{chatMessage.quote.name || "Tin nhắn được trả lời"}</strong>
                            <span>{chatMessage.quote.text}</span>
                          </button>
                        ) : null}
                        {images.length ? (
                          <div className="message-attachments">
                            {images.map((attachment, imageIndex) => (
                              <a className="message-image-button" href={attachment.url} target="_blank" rel="noreferrer" key={`${chatMessage.id}-${imageIndex}`}>
                                <img src={attachment.thumb} alt={attachment.title} />
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {text ? <p>{text}</p> : null}
                        {isLastInSenderGroup ? <time>{formatTime(chatMessage.time)}</time> : null}
                      </div>
                      <div className="message-actions">
                        <button type="button" onClick={() => setReplyToMessage(chatMessage)}>
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
                      <strong>Đang trả lời {replyToMessage.sender_name || activeConversation.customer}</strong>
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
                    <button type="button" onClick={() => setSelectedImage(null)} aria-label="Bỏ ảnh">
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ) : null}
                <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleSelectImage} />
                <button className="chat-attach-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Chọn ảnh">
                  <Icon name="add" size={18} />
                </button>
                <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nhập tin nhắn trả lời..." />
                <button className="btn btn-red" disabled={(!reply.trim() && !selectedImage) || sending} type="submit">
                  <Icon name="campaign" size={18} /> {sending ? "Gửi..." : "Gửi"}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty"><Icon name="message_circle" size={56} /><p>Không có hội thoại phù hợp bộ lọc.</p></div>
          )}
        </div>

        <aside className="chat-detail-panel">
          {activeConversation ? (
            <div className="chat-contact-detail">
              <div className="chat-contact-head">
                <ChatAvatar conversation={activeConversation} large />
                <div>
                  <h3>{activeConversation.customer}</h3>
                  <span className={`source-badge ${activeConversation.source}`}>{sourceLabel(activeConversation.source)}</span>
                </div>
              </div>
              <div className="chat-detail-section">
                <h4>Chủ tài khoản</h4>
                <dl className="chat-detail-list">
                  <div><dt>User</dt><dd>{activeConversation.owner?.fullname || "Không rõ"}</dd></div>
                  <div><dt>Email</dt><dd>{activeConversation.owner?.email || "-"}</dd></div>
                  <div><dt>Kênh</dt><dd>{activeConversation.channel_name}</dd></div>
                  <div><dt>Hội thoại ID</dt><dd>{activeConversation.external_thread_id}</dd></div>
                </dl>
              </div>
              <div className="chat-detail-section">
                <h4>Trạng thái</h4>
                <div className="chat-status-control">
                  {statusOptions.map((option) => (
                    <button className={activeConversation.status === option.value ? "active" : ""} key={option.value} type="button" onClick={() => handleUpdateConversation({ status: option.value })}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chat-detail-section">
                <h4>Phân loại</h4>
                <div className="chat-classification-tags">
                  {classificationTags.map((tag) => (
                    <button className={activeConversation.tags.includes(tag) ? "active" : ""} key={tag} type="button" onClick={() => toggleTag(tag)}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chat-detail-section">
                <h4>AI trả lời tự động</h4>
                <button className={activeConversation.ai_enabled ? "chat-ai-toggle active" : "chat-ai-toggle"} type="button" onClick={() => handleUpdateConversation({ ai_enabled: !activeConversation.ai_enabled })}>
                  <span><Icon name="smart_toy" size={16} /> {activeConversation.ai_enabled ? "AI đang bật" : "AI đang tắt"}</span>
                  <strong>{activeConversation.ai_enabled ? "Tắt" : "Bật"}</strong>
                </button>
              </div>
              <div className="chat-detail-section">
                <h4>Thao tác</h4>
                <button className="btn btn-secondary" style={{ color: "#ef4444", width: "100%", justifyContent: "center" }} type="button" onClick={handleDeleteConversation} disabled={deleting}>
                  <Icon name="x" size={16} /> {deleting ? "Đang xoá..." : "Xoá hội thoại"}
                </button>
              </div>
            </div>
          ) : (
            <div className="chat-empty detail-empty"><Icon name="message_circle" size={42} /><p>Chọn hội thoại để xem chi tiết.</p></div>
          )}
        </aside>
      </section>
    </div>
  );
}
