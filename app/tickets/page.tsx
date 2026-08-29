"use client";

import { useEffect, useRef, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  createTicket,
  fetchTickets,
  type Ticket,
  type TicketStats,
} from "../lib/auth";
import { showToast, showError } from "../lib/swal";

const CATEGORIES = ["API / Webhook", "Fanpage Facebook", "Tài khoản Zalo", "Chat Bot AI", "Thanh toán", "Khác"];
const PRIORITIES: { value: "low" | "medium" | "high"; label: string; color: string }[] = [
  { value: "low", label: "Thấp", color: "gray" },
  { value: "medium", label: "Trung bình", color: "orange" },
  { value: "high", label: "Cao", color: "red" },
];

function statusLabel(status: string) {
  if (status === "open") return { text: "Chờ xử lý", tone: "blue" };
  if (status === "in_progress") return { text: "Đang xử lý", tone: "orange" };
  if (status === "resolved") return { text: "Đã giải quyết", tone: "green" };
  return { text: "Đã đóng", tone: "gray" };
}

function priorityLabel(p: string) {
  if (p === "high") return { text: "Cao", tone: "red" };
  if (p === "medium") return { text: "Trung bình", tone: "orange" };
  return { text: "Thấp", tone: "gray" };
}

function formatDate(val?: string | null) {
  if (!val) return "";
  return new Date(val.replace(" ", "T")).toLocaleString("vi-VN");
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats>({ open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTickets()
      .then(({ tickets: t, stats: s }) => {
        if (cancelled) return;
        setTickets(t);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function readFilesAsBase64(files: FileList | File[]) {
    const arr = Array.from(files);
    const remaining = 5 - attachments.length;
    if (remaining <= 0) return;
    const toProcess = arr.slice(0, remaining);

    for (const file of toProcess) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 3 * 1024 * 1024) {
        showToast(`Ảnh "${file.name}" vượt quá 3MB.`, "error");
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) setAttachments((prev) => prev.length < 5 ? [...prev, result] : prev);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) readFilesAsBase64(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) readFilesAsBase64(e.dataTransfer.files);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { showToast("Vui lòng nhập chủ đề.", "error"); return; }
    if (!body.trim()) { showToast("Vui lòng nhập nội dung mô tả.", "error"); return; }

    setSubmitting(true);

    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        category: category || undefined,
        priority,
        body: body.trim(),
        attachments,
      });
      setTickets((prev) => [ticket, ...prev]);
      setStats((prev) => ({ ...prev, open: prev.open + 1 }));
      showToast("Đã gửi ticket thành công! Đội ngũ hỗ trợ sẽ phản hồi sớm nhất.");
      setSubject(""); setCategory(""); setPriority("medium"); setBody(""); setAttachments([]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Không thể gửi ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppFrame active="/tickets" title="Gửi ticket">
      <PageHeader
        eyebrow="Trung tâm hỗ trợ"
        title="Gửi ticket"
        desc="Gửi yêu cầu hỗ trợ kỹ thuật, kết nối API, Fanpage hoặc sự cố vận hành để đội ngũ TechMax xử lý."
      />

      <div className="stack">
        <section className="grid-4">
          <StatCard label="Open" value={String(stats.open)} help="Ticket đang chờ xử lý" icon="support_agent" />
          <StatCard label="In Progress" value={String(stats.in_progress)} help="Yêu cầu đang được hỗ trợ" icon="timer" />
          <StatCard label="Resolved" value={String(stats.resolved)} help="Ticket đã hoàn tất" icon="check_circle" />
          <StatCard label="Avg Response" value="15m" help="Thời gian phản hồi dự kiến" icon="schedule_send" />
        </section>

        <section className="grid-2">
          {/* ── Form tạo ticket ── */}
          <div className="card pad">
            <h2 style={{ marginTop: 0 }}>Tạo ticket mới</h2>
            <p className="subtitle">Mô tả càng rõ, đội ngũ hỗ trợ càng xử lý nhanh hơn.</p>

            {/* Banners removed per toast request */}

            <form className="stack" onSubmit={handleSubmit}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 8 }}>Chủ đề <span style={{ color: "var(--red)" }}>*</span></span>
                <input
                  className="input"
                  placeholder="Ví dụ: Không nhận được webhook từ Fanpage"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <div className="grid-2" style={{ gap: 12 }}>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Loại yêu cầu</span>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting}>
                    <option value="">-- Chọn loại --</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Mức ưu tiên</span>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")} disabled={submitting}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
              </div>

              <label>
                <span className="muted" style={{ display: "block", marginBottom: 8 }}>Nội dung <span style={{ color: "var(--red)" }}>*</span></span>
                <textarea
                  className="input"
                  placeholder="Mô tả lỗi, bước tái hiện, mã hội thoại hoặc endpoint liên quan..."
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={submitting}
                  style={{ resize: "vertical" }}
                />
              </label>

              {/* ── Image upload zone ── */}
              <div>
                <div className="between" style={{ marginBottom: 8 }}>
                  <span className="muted">Ảnh đính kèm <span className="muted" style={{ fontSize: 12 }}>(tối đa 5 ảnh · JPG/PNG/GIF/WEBP · 3MB/ảnh)</span></span>
                  <span className="muted" style={{ fontSize: 12 }}>{attachments.length}/5</span>
                </div>

                {/* Drop zone */}
                {attachments.length < 5 ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? "var(--red)" : "var(--border)"}`,
                      borderRadius: 10,
                      padding: "24px 16px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: dragOver ? "rgba(224,36,36,.06)" : "rgba(255,255,255,.02)",
                      transition: "all .2s",
                      marginBottom: attachments.length ? 12 : 0,
                    }}
                  >
                    <Icon name="add_circle" size={28} style={{ color: "var(--dim)", marginBottom: 6 }} />
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Kéo thả ảnh vào đây hoặc <span style={{ color: "var(--red)", fontWeight: 700 }}>nhấp để chọn</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </div>
                ) : null}

                {/* Thumbnail previews */}
                {attachments.length > 0 ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {attachments.map((src, i) => (
                      <div key={i} style={{ position: "relative", width: 80, height: 80 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Ảnh ${i + 1}`}
                          onClick={() => setPreviewImg(src)}
                          style={{
                            width: 80, height: 80,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1.5px solid var(--border)",
                            cursor: "zoom-in",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          style={{
                            position: "absolute", top: -6, right: -6,
                            width: 20, height: 20, borderRadius: "50%",
                            background: "var(--red)", border: "none",
                            color: "#fff", cursor: "pointer", fontSize: 12,
                            display: "grid", placeItems: "center", lineHeight: 1,
                          }}
                          aria-label="Xóa ảnh"
                        >✕</button>
                      </div>
                    ))}
                    {attachments.length < 5 ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          width: 80, height: 80, borderRadius: 8,
                          border: "2px dashed var(--border)",
                          background: "rgba(255,255,255,.02)",
                          cursor: "pointer", color: "var(--dim)",
                          display: "grid", placeItems: "center",
                        }}
                      >
                        <Icon name="add" size={24} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <button className="btn btn-red" type="submit" disabled={submitting} style={{ width: "100%", padding: 16, fontSize: 16 }}>
                <Icon name="send" size={18} />
                {submitting ? "Đang gửi..." : "Gửi ticket"}
              </button>
            </form>
          </div>

          {/* ── Sidebar tips ── */}
          <div className="card pad">
            <h2 style={{ marginTop: 0 }}>Thông tin nên cung cấp</h2>
            <div className="stack">
              {[
                ["link", "Endpoint hoặc Page ID", "Gửi kèm URL endpoint, Page ID hoặc kênh đang gặp lỗi."],
                ["history", "Thời điểm xảy ra", "Càng có mốc thời gian cụ thể, việc tra log càng nhanh."],
                ["list_alt", "Payload mẫu", "Nếu lỗi API/Webhook, hãy gửi request/response mẫu đã ẩn thông tin nhạy cảm."],
                ["warning", "Ảnh chụp lỗi", "Đính kèm ảnh màn hình hoặc nội dung lỗi console nếu có. Tối đa 5 ảnh."],
              ].map(([icon, title, text]) => (
                <div className="row" style={{ alignItems: "flex-start" }} key={title}>
                  <Icon name={icon} />
                  <div>
                    <strong>{title}</strong>
                    <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>{text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, padding: 16, borderRadius: 10, background: "rgba(224,36,36,.06)", border: "1px solid rgba(224,36,36,.2)" }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <Icon name="schedule_send" size={18} />
                <strong style={{ fontSize: 13 }}>Thời gian phản hồi</strong>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Ticket <strong>Cao</strong>: phản hồi trong 15 phút<br />
                Ticket <strong>Trung bình</strong>: trong 1 giờ<br />
                Ticket <strong>Thấp</strong>: trong 24 giờ
              </p>
            </div>
          </div>
        </section>

        {/* ── Ticket list ── */}
        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
            <div className="row">
              <Icon name="history" />
              <h2 style={{ margin: 0 }}>Ticket gần đây</h2>
            </div>
            <p className="subtitle" style={{ marginBottom: 0 }}>Theo dõi các yêu cầu hỗ trợ đã gửi và trạng thái xử lý.</p>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p className="muted">Đang tải...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="support_agent" size={56} />
              <p className="subtitle">Bạn chưa gửi ticket hỗ trợ nào.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Chủ đề</th>
                    <th>Loại</th>
                    <th>Ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Ảnh</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const status = statusLabel(ticket.status);
                    const prio = priorityLabel(ticket.priority);
                    return (
                      <tr key={ticket.id}>
                        <td><strong>#{ticket.id}</strong></td>
                        <td>
                          <strong style={{ display: "block" }}>{ticket.subject}</strong>
                          {ticket.category ? <span className="muted" style={{ fontSize: 12 }}>{ticket.category}</span> : null}
                        </td>
                        <td><span className="muted">{ticket.category || "—"}</span></td>
                        <td><span className={`status ${prio.tone}`}>{prio.text}</span></td>
                        <td><span className={`status ${status.tone}`}>{status.text}</span></td>
                        <td>
                          {ticket.attachments.length > 0 ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              {ticket.attachments.slice(0, 3).map((src, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={i}
                                  src={src}
                                  alt=""
                                  onClick={() => setPreviewImg(src)}
                                  style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 5, border: "1px solid var(--border)", cursor: "zoom-in" }}
                                />
                              ))}
                              {ticket.attachments.length > 3 ? (
                                <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>+{ticket.attachments.length - 3}</span>
                              ) : null}
                            </div>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>{formatDate(ticket.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Image preview lightbox ── */}
      {previewImg ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPreviewImg(null)}
          style={{ zIndex: 9999 }}
        >
          <div
            style={{ maxWidth: "90vw", maxHeight: "90vh", display: "grid", placeItems: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImg}
              alt="Preview"
              style={{ maxWidth: "85vw", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
            />
            <button
              type="button"
              onClick={() => setPreviewImg(null)}
              style={{
                position: "fixed", top: 20, right: 20,
                background: "rgba(0,0,0,.7)", border: "none",
                color: "#fff", borderRadius: "50%",
                width: 44, height: 44, cursor: "pointer",
                fontSize: 20, display: "grid", placeItems: "center",
              }}
            >✕</button>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}
