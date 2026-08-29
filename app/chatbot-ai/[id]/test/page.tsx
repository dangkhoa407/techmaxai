"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame, Icon, PageHeader } from "../../../components";
import { fetchAiBotTraining, fetchAiBots, testAiBotReply, type AiBot, type AiBotTrainingItem } from "../../../lib/auth";
import { showError, showToast } from "../../../lib/swal";

type TestMessage = {
  id: number;
  from: "customer" | "agent";
  text: string;
  time: string;
  imageDataUrl?: string;
  imageUrl?: string;
};

function genderLabel(gender: string) {
  return {
    male: "Nam",
    female: "Nữ",
    other: "Khác",
  }[gender] || gender;
}

function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Cannot read this image file."));
    reader.readAsDataURL(file);
  });
}

function normalizeImageForAi(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1600;
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
      const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Cannot prepare this image."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = async () => {
      URL.revokeObjectURL(image.src);
      try {
        resolve(await readFileAsDataUrl(file));
      } catch (error) {
        reject(error);
      }
    };
    image.src = URL.createObjectURL(file);
  });
}

function categoryLabel(value: string) {
  return {
    knowledge: "Kiến thức",
    consulting_skills: "Kỹ năng tư vấn",
    training_documents: "Tài liệu đào tạo",
    operation_rules: "Quy định hoạt động",
    api_connection: "Kết nối API",
  }[value] || value;
}

export default function BotTestPage() {
  const params = useParams<{ id: string }>();
  const botId = Number(params.id || 0);
  const [bot, setBot] = useState<AiBot | null>(null);
  const [trainingItems, setTrainingItems] = useState<AiBotTrainingItem[]>([]);
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of trainingItems) counts.set(item.training_category, (counts.get(item.training_category) || 0) + 1);
    return counts;
  }, [trainingItems]);

  useEffect(() => {
    Promise.all([fetchAiBots(), fetchAiBotTraining(botId)])
      .then(([data, items]) => {
        setBot(data.bots.find((item) => item.id === botId) || null);
        setTrainingItems(items);
      })
      .catch((err) => showError(err instanceof Error ? err.message : "Không thể tải phòng test bot AI."))
      .finally(() => setLoading(false));
  }, [botId]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length, typing]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bot || (!input.trim() && !selectedImage) || typing) return;
    const text = input.trim();
    const image = selectedImage;
    const currentMessages = messages;
    setMessages((current) => [...current, { id: Date.now(), from: "customer", text: text || "[Ảnh]", imageDataUrl: image?.dataUrl, time: new Date().toISOString() }]);
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTyping(true);
    try {
      const imageHistoryIds = new Set(
        currentMessages
          .filter((message) => message.from === "customer" && message.imageDataUrl)
          .slice(-3)
          .map((message) => message.id)
      );
      const result = await testAiBotReply(botId, {
        message: text,
        imageDataUrl: image?.dataUrl || null,
        history: currentMessages.map((message) => ({
          role: message.from === "agent" ? "assistant" : "user",
          content: message.imageDataUrl || message.imageUrl ? `${message.text}\n[Đã gửi kèm ảnh.]` : message.text,
          imageDataUrl: imageHistoryIds.has(message.id) ? message.imageDataUrl : null,
        })),
      });
      const now = Date.now();
      const responseMessages: TestMessage[] = (result.messages || []).map((reply, index) => ({
        id: now + index + 1,
        from: "agent",
        text: reply,
        time: new Date().toISOString(),
      }));
      if (result.action === "call_api" && result.request) {
        responseMessages.push({
          id: now + 1000,
          from: "agent",
          text: `Yêu cầu gọi API:\n${JSON.stringify(result.request, null, 2)}`,
          time: new Date().toISOString(),
        });
      }
      if (result.image) {
        responseMessages.push({
          id: now + 1001,
          from: "agent",
          text: `Ảnh tham khảo: ${result.image}`,
          time: new Date().toISOString(),
        });
      }
      setMessages((current) => [...current, ...responseMessages]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          from: "agent",
          text: err instanceof Error ? err.message : "Không thể test bot AI lúc này.",
          time: new Date().toISOString(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function handleSelectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      showToast("Please choose a PNG, JPG, WEBP, or GIF image.", "error");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast("Image size must be 6MB or smaller.", "error");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await normalizeImageForAi(file);
      setSelectedImage({ name: file.name, dataUrl });
    } catch {
      showToast("Cannot read this image file.", "error");
      event.target.value = "";
    }
  }

  function BotDetailContent({ compact = false, hideInfoTitle = false }: { compact?: boolean; hideInfoTitle?: boolean } = {}) {
    if (!bot) return null;
    return (
      <>
        {!compact ? <div className="chat-contact-detail">
          <div className="chat-contact-head">
            <span className="chat-avatar large">{bot.full_name.trim().charAt(0).toUpperCase() || "B"}</span>
            <div>
              <h3>{bot.full_name}</h3>
              <span className={`status ${bot.status === "active" ? "green" : "orange"}`}>{bot.status === "active" ? "Đang bật" : "Tạm dừng"}</span>
            </div>
          </div>
        </div> : null}

        <div className="chat-detail-section">
          {hideInfoTitle ? null : <h4>Thông tin bot</h4>}
          <dl className="chat-detail-list">
            <div><dt>Model</dt><dd>{bot.model ? `${bot.model.provider || "AI"} - ${bot.model.name}` : "-"}</dd></div>
            <div><dt>Giới tính</dt><dd>{genderLabel(bot.gender)}</dd></div>
            <div><dt>Nội dung đào tạo</dt><dd>{trainingItems.length}</dd></div>
            <div><dt>Ngày tạo</dt><dd>{bot.created_at || "-"}</dd></div>
          </dl>
        </div>

        <div className="chat-detail-section">
          <h4>Dữ liệu đào tạo</h4>
          <div className="chat-classification-tags">
            {["knowledge", "consulting_skills", "training_documents", "operation_rules", "api_connection"].map((category) => (
              <button className={(categoryCounts.get(category) || 0) ? "active" : ""} key={category} type="button">
                {categoryLabel(category)} ({categoryCounts.get(category) || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="chat-detail-section">
          <h4>Tính cách</h4>
          <p className="subtitle" style={{ margin: 0 }}>{bot.personality_description || "Chưa có mô tả tính cách."}</p>
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn btn-secondary" href={`/chatbot-ai/${bot.id}/training`}><Icon name="menu_book" size={16} /> Đào tạo</Link>
        </div>
      </>
    );
  }

  return (
    <AppFrame active="/chatbot-ai" title="Test Bot AI" hideMobileNav>
      <div className="chat-page-header">
        <PageHeader
          eyebrow="Phòng test"
          title={bot ? `Test Bot AI: ${bot.full_name}` : "Test Bot AI"}
          desc="Thử hội thoại với bot trước khi dùng thật với khách hàng."
          action={<Link className="btn btn-secondary" href="/chatbot-ai"><Icon name="chevron_left" /> Quay lại</Link>}
        />
      </div>

      {/* Banners removed per toast request */}

      <section className="bot-test-page">
        <div className="chat-room bot-test-room">
          {loading ? (
            <div className="chat-empty"><Icon name="timer" size={46} /><p>Đang tải phòng test...</p></div>
          ) : bot ? (
            <>
              <header className="chat-room-head">
                <div className="row">
                  <Link className="chat-mobile-back" href="/chatbot-ai" aria-label="Quay lại danh sách bot">
                    <Icon name="chevron_left" size={22} />
                  </Link>
                  <div className="bot-test-mobile-title">
                    <div className="row compact-row">
                      <h2>{bot.full_name}</h2>
                      <span className={`source-badge ${bot.status === "active" ? "zalo" : "fanpage"}`}>{bot.status === "active" ? "Bot đang bật" : "Bot tạm dừng"}</span>
                    </div>
                    <p>{bot.model ? `${bot.model.provider || "AI"} - ${bot.model.name}` : "Chưa có model"} - Test nội bộ</p>
                  </div>
                </div>
                <div className="chat-tags">
                  <span>{genderLabel(bot.gender)}</span>
                  <span>{trainingItems.length} nội dung</span>
                </div>
                <button className="chat-mobile-detail-button" type="button" onClick={() => setDetailOpen(true)} aria-label="Mở thông tin chi tiết bot">
                  <span />
                  <span />
                  <span />
                </button>
              </header>

              <div className="chat-messages" ref={messagesRef}>
                {messages.length ? messages.map((message) => {
                  const imageUrl = message.imageDataUrl || message.imageUrl || "";
                  const text = imageUrl && message.text === "[Ảnh]" ? "" : message.text;
                  return (
                    <div className={message.from === "agent" ? "message-row agent" : "message-row"} key={message.id}>
                      <div className={imageUrl ? "message-bubble has-media" : "message-bubble"}>
                        {imageUrl ? (
                          <div className="message-attachments">
                            <a href={imageUrl} target="_blank" rel="noreferrer">
                              <img src={imageUrl} alt={text || "Test image"} />
                            </a>
                          </div>
                        ) : null}
                        {text ? <p>{text}</p> : null}
                        <time>{formatChatTime(message.time)}</time>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="chat-empty">
                    <Icon name="message_circle" size={46} />
                    <p>Nhập tin nhắn để test cách bot phản hồi.</p>
                  </div>
                )}
                {typing ? (
                  <div className="message-row agent">
                    <div className="message-bubble bot-typing"><span /><span /><span /></div>
                  </div>
                ) : null}
              </div>

              <form className="chat-composer" onSubmit={sendMessage}>
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
                      aria-label="Remove image"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ) : null}
                <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleSelectImage} />
                <button className="chat-attach-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Choose image">
                  <Icon name="add" size={18} />
                </button>
                <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nhập tin nhắn test bot..." />
                <button className="btn btn-red" disabled={(!input.trim() && !selectedImage) || typing} type="submit">
                  <Icon name="campaign" size={18} /> Gửi
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty"><Icon name="warning" size={46} /><p>Không tìm thấy bot AI.</p></div>
          )}
        </div>

        <aside className="chat-detail-panel bot-test-detail">
          <BotDetailContent />
        </aside>
      </section>

      {detailOpen && bot ? (
        <div className="chat-mobile-detail-backdrop" role="presentation" onMouseDown={() => setDetailOpen(false)}>
          <aside className="chat-mobile-detail-sheet" role="dialog" aria-modal="true" aria-label="Thông tin chi tiết bot" onMouseDown={(event) => event.stopPropagation()}>
            <header className="chat-mobile-detail-head">
              <strong>Thông tin bot</strong>
              <button type="button" onClick={() => setDetailOpen(false)} aria-label="Đóng thông tin chi tiết">
                <Icon name="x" size={18} />
              </button>
            </header>
            <div className="chat-contact-detail">
              <BotDetailContent compact hideInfoTitle />
            </div>
          </aside>
        </div>
      ) : null}
    </AppFrame>
  );
}
