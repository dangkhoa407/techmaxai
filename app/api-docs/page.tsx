"use client";

import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader } from "../components";
import {
  createLiveChatWidget,
  deleteLiveChatWidget,
  fetchAiBots,
  fetchLiveChatWidgets,
  updateLiveChatWidget,
  type AiBot,
  type LiveChatWidget,
} from "../lib/auth";
import { showConfirm, showToast } from "../lib/swal";

const widgetOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.conkudaden.online/api").replace(/\/api\/?$/i, "");
const widgetPageSize = 8;

type WidgetForm = {
  name: string;
  allowedDomains: string;
  title: string;
  subtitle: string;
  accentColor: string;
  aiEnabled: boolean;
  aiBotId: string;
};

const emptyForm: WidgetForm = {
  name: "Live Chat Website",
  allowedDomains: "",
  title: "Hỗ trợ trực tuyến",
  subtitle: "Chúng tôi thường phản hồi trong vài phút.",
  accentColor: "#e02424",
  aiEnabled: false,
  aiBotId: "",
};

function domainsText(widget?: LiveChatWidget | null) {
  return widget?.allowed_domains?.join("\n") || "";
}

function formFromWidget(widget: LiveChatWidget): WidgetForm {
  return {
    name: widget.name,
    allowedDomains: domainsText(widget),
    title: widget.title,
    subtitle: widget.subtitle,
    accentColor: widget.accent_color,
    aiEnabled: widget.ai_enabled,
    aiBotId: widget.ai_bot_id ? String(widget.ai_bot_id) : "",
  };
}

export default function ApiDocsPage() {
  const [widgets, setWidgets] = useState<LiveChatWidget[]>([]);
  const [bots, setBots] = useState<AiBot[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [form, setForm] = useState<WidgetForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [widgetSearch, setWidgetSearch] = useState("");
  const [widgetPage, setWidgetPage] = useState(1);

  const activeWidget = widgets.find((widget) => widget.id === activeId) || null;
  const filteredWidgets = useMemo(() => {
    const keyword = widgetSearch.trim().toLowerCase();
    if (!keyword) return widgets;
    return widgets.filter((widget) => [
      widget.name,
      widget.public_key,
      widget.allowed_domains.join(" "),
      widget.status === "active" ? "đang bật active" : "đã tắt inactive",
      widget.ai_enabled ? "ai website" : "",
    ].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [widgets, widgetSearch]);
  const widgetPageCount = Math.max(1, Math.ceil(filteredWidgets.length / widgetPageSize));
  const safeWidgetPage = Math.min(widgetPage, widgetPageCount);
  const pagedWidgets = filteredWidgets.slice((safeWidgetPage - 1) * widgetPageSize, safeWidgetPage * widgetPageSize);

  useEffect(() => {
    Promise.all([fetchLiveChatWidgets(), fetchAiBots()])
      .then(([widgetRows, botPayload]) => {
        setWidgets(widgetRows);
        setBots(botPayload.bots);
        const first = widgetRows[0] || null;
        if (first) {
          setActiveId(first.id);
          setForm(formFromWidget(first));
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không thể tải cấu hình live chat."));
  }, []);

  useEffect(() => {
    setWidgetPage(1);
  }, [widgetSearch]);

  useEffect(() => {
    setWidgetPage((current) => Math.min(current, widgetPageCount));
  }, [widgetPageCount]);

  const embedCode = useMemo(() => {
    if (!activeWidget) return "";
    return `<script
  src="${widgetOrigin}/livechat.js"
  data-widget-key="${activeWidget.public_key}"
  defer>
</script>`;
  }, [activeWidget]);

  function startNewWidget() {
    setActiveId(null);
    setForm(emptyForm);
    setMessage("");
  }

  function selectWidget(widget: LiveChatWidget) {
    setActiveId(widget.id);
    setForm(formFromWidget(widget));
    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      name: form.name,
      allowed_domains: form.allowedDomains,
      title: form.title,
      subtitle: form.subtitle,
      accent_color: form.accentColor,
      ai_enabled: form.aiEnabled,
      ai_bot_id: form.aiBotId ? Number(form.aiBotId) : null,
    };
    try {
      const nextWidgets = activeWidget
        ? await updateLiveChatWidget(activeWidget.id, payload)
        : await createLiveChatWidget(payload);
      setWidgets(nextWidgets);
      const nextActive = activeWidget
        ? nextWidgets.find((widget) => widget.id === activeWidget.id)
        : nextWidgets[0];
      if (nextActive) {
        setActiveId(nextActive.id);
        setForm(formFromWidget(nextActive));
      }
      showToast(activeWidget ? "Đã cập nhật live chat widget." : "Đã tạo live chat widget.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu live chat widget.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeWidget || saving) return;
    if (!(await showConfirm(`Xóa widget "${activeWidget.name}"?`))) return;
    setSaving(true);
    try {
      const nextWidgets = await deleteLiveChatWidget(activeWidget.id);
      setWidgets(nextWidgets);
      const first = nextWidgets[0] || null;
      setActiveId(first?.id || null);
      setForm(first ? formFromWidget(first) : emptyForm);
      showToast("Đã xóa live chat widget.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa live chat widget.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWidget(widget: LiveChatWidget) {
    if (saving) return;
    if (!(await showConfirm(`Xóa widget "${widget.name}"?`))) return;
    setSaving(true);
    try {
      const nextWidgets = await deleteLiveChatWidget(widget.id);
      setWidgets(nextWidgets);
      const nextActive = activeId === widget.id
        ? nextWidgets[0] || null
        : nextWidgets.find((item) => item.id === activeId) || nextWidgets[0] || null;
      setActiveId(nextActive?.id || null);
      setForm(nextActive ? formFromWidget(nextActive) : emptyForm);
      showToast("Đã xóa live chat widget.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa live chat widget.", "error");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof WidgetForm>(key: K, value: WidgetForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <AppFrame active="/api-docs" title="Live Chat">
      <PageHeader
        eyebrow="Website integration"
        title="Live Chat tích hợp website"
        desc="Tạo widget riêng cho từng website, xác thực tên miền được phép nhúng, chọn bot AI trả lời tự động, hỗ trợ gửi ảnh và reply tin nhắn."
        action={<button className="btn btn-red" type="button" onClick={startNewWidget}><Icon name="add" /> Tạo widget</button>}
      />

      {message ? <div className={message.includes("Không") ? "form-message error" : "form-message success"} style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="grid-3" style={{ marginBottom: 16 }}>
        {[
          ["security", "Xác thực domain", "Chỉ domain trong danh sách cho phép mới gọi được Live Chat API."],
          ["smart_toy", "Chọn bot AI", "Mỗi widget có thể bật/tắt AI và chọn bot trả lời riêng."],
          ["image", "Ảnh và reply", "Khách gửi ảnh, reply tin nhắn ngay trong widget nhúng."],
        ].map(([icon, title, text]) => (
          <div className="card pad" key={title}>
            <Icon name={icon} />
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="grid-2">
        <div className="card">
          <div style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0 }}>Danh sách widget</h2>
            <p className="subtitle">Mỗi website nên dùng một widget key riêng để quản lý domain và bot.</p>
          </div>
          {widgets.length ? (
            <div className="activity-search" style={{ borderRadius: 0, borderInline: 0 }}>
              <div className="activity-search-input">
                <Icon name="search" size={20} />
                <input
                  className="input"
                  onChange={(event) => setWidgetSearch(event.target.value)}
                  placeholder="Tìm theo tên, domain, widget key..."
                  value={widgetSearch}
                />
              </div>
              <button className="btn btn-secondary" onClick={() => setWidgetPage(1)} type="button">
                <Icon name="filter_list" size={18} />
                Tìm kiếm
              </button>
            </div>
          ) : null}
          <div className="stack" style={{ padding: 16 }}>
            {pagedWidgets.length ? pagedWidgets.map((widget) => (
              <div
                className={activeWidget?.id === widget.id ? "widget-list-item active" : "widget-list-item"}
                key={widget.id}
              >
                <span className="widget-list-main">
                  <strong>{widget.name}</strong>
                  <em>{widget.allowed_domains.join(", ") || "Chưa cấu hình domain"}</em>
                  <code>{widget.public_key}</code>
                </span>
                <span className="widget-list-meta">
                  <span className={widget.status === "active" ? "status green" : "status red"}>{widget.status === "active" ? "Đang bật" : "Đã tắt"}</span>
                  <span className="source-badge webchat">Website</span>
                </span>
              </div>
            )) : widgets.length ? (
              <div className="chat-empty" style={{ minHeight: 180 }}>
                <Icon name="search" size={42} />
                <p>Không tìm thấy widget phù hợp.</p>
              </div>
            ) : (
              <div className="chat-empty" style={{ minHeight: 180 }}>
                <Icon name="message_circle" size={42} />
                <p>Chưa có live chat widget nào.</p>
              </div>
            )}
          </div>
          {filteredWidgets.length > widgetPageSize ? (
            <div className="activity-pagination">
              <p>Tổng: {filteredWidgets.length} widget • Trang {safeWidgetPage}/{widgetPageCount}</p>
              <div className="row">
                <button className="btn btn-secondary" disabled={safeWidgetPage <= 1} onClick={() => setWidgetPage(safeWidgetPage - 1)} type="button">‹</button>
                <button className="btn btn-primary" type="button">{safeWidgetPage}</button>
                <button className="btn btn-secondary" disabled={safeWidgetPage >= widgetPageCount} onClick={() => setWidgetPage(safeWidgetPage + 1)} type="button">›</button>
              </div>
            </div>
          ) : null}
        </div>

        <form className="card pad" onSubmit={handleSubmit}>
          <h2 style={{ marginTop: 0 }}>{activeWidget ? "Cập nhật widget" : "Tạo widget mới"}</h2>
          <div className="form-grid">
            <label>
              <span>Tên widget</span>
              <input className="input" value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Live Chat Website" />
            </label>
            <label>
              <span>Màu chủ đạo</span>
              <input className="input" value={form.accentColor} onChange={(event) => setField("accentColor", event.target.value)} placeholder="#e02424" />
            </label>
          </div>
          <label>
            <span>Domain được phép nhúng</span>
            <textarea className="input" rows={4} value={form.allowedDomains} onChange={(event) => setField("allowedDomains", event.target.value)} placeholder={"example.com\n*.example.com\nlocalhost"} required />
          </label>
          <div className="form-grid">
            <label>
              <span>Tiêu đề widget</span>
              <input className="input" value={form.title} onChange={(event) => setField("title", event.target.value)} />
            </label>
            <label>
              <span>Mô tả widget</span>
              <input className="input" value={form.subtitle} onChange={(event) => setField("subtitle", event.target.value)} />
            </label>
          </div>
          <label>
            <span>Bot AI trả lời</span>
            <select className="input" value={form.aiBotId} onChange={(event) => setField("aiBotId", event.target.value)}>
              <option value="">Không chọn bot</option>
              {bots.map((bot) => <option value={bot.id} key={bot.id}>{bot.full_name}</option>)}
            </select>
          </label>
          <label className={form.aiEnabled ? "chat-ai-toggle active" : "chat-ai-toggle"} style={{ marginTop: 14 }}>
            <span><Icon name="smart_toy" size={16} /> Bật AI trả lời tự động</span>
            <input type="checkbox" checked={form.aiEnabled} onChange={(event) => setField("aiEnabled", event.target.checked)} />
          </label>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn btn-red" type="submit" disabled={saving}>{saving ? "Đang lưu..." : activeWidget ? "Lưu cấu hình" : "Tạo widget"}</button>
            {activeWidget ? <button className="btn btn-secondary" type="button" onClick={handleDelete} disabled={saving}>Xóa</button> : null}
          </div>
        </form>
      </section>

      <section className="card pad" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Mã nhúng</h2>
        {activeWidget ? (
          <>
            <p className="subtitle">Dán đoạn script này vào website có domain đã khai báo. Widget key không chứa user id trực tiếp và request sẽ được server xác thực theo domain.</p>
            <pre className="code-block">{embedCode}</pre>
          </>
        ) : (
          <p className="muted">Tạo hoặc chọn một widget để lấy mã nhúng.</p>
        )}
      </section>

      <section className="grid-3" style={{ marginTop: 16 }}>
        {[
          ["POST", "/api/livechat/message", "Widget gửi text, ảnh và quote/reply vào Inbox."],
          ["GET", "/api/livechat/messages", "Widget lấy phản hồi mới từ nhân viên hoặc AI."],
          ["GET", "/api/livechat/config", "Widget lấy title, subtitle, màu và xác thực domain."],
        ].map(([method, endpoint, desc]) => (
          <div className="card pad" key={endpoint}>
            <span className={method === "GET" ? "status blue" : "status green"}>{method}</span>
            <h3><code>{endpoint}</code></h3>
            <p className="muted">{desc}</p>
          </div>
        ))}
      </section>
    </AppFrame>
  );
}
