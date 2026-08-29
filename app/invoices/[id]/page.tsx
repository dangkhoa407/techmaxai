"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppFrame, Icon, PageHeader } from "../../components";
import { fetchDepositInvoice, formatVnd, type DepositInvoice } from "../../lib/auth";

function getRemainingMs(expiresAt: string) {
  const expires = new Date(expiresAt.replace(" ", "T")).getTime();
  return Math.max(0, expires - Date.now());
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const [invoice, setInvoice] = useState<DepositInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  async function loadInvoice() {
    if (!invoiceId) return;
    setLoading(true);
    setError("");

    try {
      const data = await fetchDepositInvoice(invoiceId);
      setInvoice(data);
      setTimeLeft(getRemainingMs(data.expires_at));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tải chi tiết hóa đơn.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    setTimeLeft(getRemainingMs(invoice.expires_at));
    const timer = window.setInterval(() => {
      const nextTimeLeft = getRemainingMs(invoice.expires_at);
      setTimeLeft(nextTimeLeft);
      if (nextTimeLeft <= 0) {
        window.clearInterval(timer);
        loadInvoice();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [invoice?.id, invoice?.status, invoice?.expires_at]);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = window.setTimeout(() => setCopyMessage(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  const effectiveStatus = useMemo(() => {
    if (!invoice) return { text: "Đang tải...", tone: "blue" as const };
    return { text: invoice.status_text, tone: invoice.tone };
  }, [invoice]);

  const qrUrl = useMemo(() => {
    if (!invoice) return "";
    return invoice.qr_url || "";
  }, [invoice]);

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(message);
    } catch {
      setCopyMessage("Không thể sao chép trên trình duyệt này.");
    }
  }

  return (
    <AppFrame active="/invoices" title="Chi tiết hóa đơn">
      <PageHeader
        eyebrow="Tài chính"
        title={invoice ? `Hóa đơn ${invoice.invoice_code}` : "Chi tiết hóa đơn"}
        desc="Theo dõi trạng thái thanh toán, thông tin chuyển khoản và đối soát của hóa đơn."
        action={
          <Link className="btn btn-secondary" href="/invoices">
            <Icon name="chevron_left" /> Quay lại
          </Link>
        }
      />

      {error ? (
        <div className="card pad" style={{ borderColor: "rgba(255, 90, 90, 0.35)", background: "rgba(120, 0, 0, 0.16)" }}>
          <strong>Không tìm thấy hóa đơn</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>{error}</p>
        </div>
      ) : null}

      <div className="stack">
        <section className="grid-3">
          <div className="card pad" style={{ gridColumn: "span 2" }}>
            <div className="between">
              <div>
                <span className={`status ${effectiveStatus.tone}`}>{effectiveStatus.text}</span>
                <h2 style={{ marginBottom: 6 }}>Thông tin hóa đơn</h2>
                <p className="subtitle">Nội dung chuyển khoản cần nhập chính xác để hệ thống đối soát tự động.</p>
              </div>
              <Icon name="receipt_long" size={42} />
            </div>

            <div className="grid-2" style={{ marginTop: 24 }}>
              {[
                ["Mã hóa đơn", invoice?.invoice_code || "..."],
                ["Kênh thanh toán", invoice?.bank.bank_name || "..."],
                ["Số tiền", invoice ? formatVnd(invoice.amount) : "..."],
                ["Nội dung chuyển khoản", invoice?.transfer_content || "..."],
                ["Tạo lúc", invoice?.created_at || "..."],
              ].map(([label, value]) => (
                <div className="glass" style={{ padding: 16 }} key={label}>
                  <span className="muted" style={{ display: "block", fontSize: 12 }}>{label}</span>
                  <strong style={{ display: "block", marginTop: 8 }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="card pad">
            <h2 style={{ marginTop: 0 }}>Trạng thái</h2>
            <div className="stack">
              <div className="between"><span className="muted">Thanh toán</span><span className={`status ${effectiveStatus.tone}`}>{effectiveStatus.text}</span></div>
              <div className="between"><span className="muted">Số tiền cần nạp</span><strong>{invoice ? formatVnd(invoice.amount) : "..."}</strong></div>

              <div className="between"><span className="muted">Ghi nhận lúc</span><strong>{invoice?.paid_at || "Đang chờ đối soát"}</strong></div>
              <button
                className={effectiveStatus.tone === "green" ? "btn btn-secondary" : "btn btn-red"}
                onClick={() => {
                  if (effectiveStatus.tone === "red") {
                    router.push("/deposit");
                    return;
                  }
                  loadInvoice();
                }}
                type="button"
              >
                <Icon name={effectiveStatus.tone === "green" ? "check_circle" : effectiveStatus.tone === "red" ? "payments" : "update"} size={18} />
                {effectiveStatus.tone === "green"
                  ? "Đã ghi nhận"
                  : effectiveStatus.tone === "red"
                    ? "Tạo hóa đơn mới"
                    : "Làm mới trạng thái"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid-2">
          <div className="card pad">
            <div className="between" style={{ gap: 16 }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: 6 }}>Thông tin chuyển khoản</h2>
                <p className="subtitle" style={{ marginBottom: 0 }}>Cấu hình ngân hàng được lấy trực tiếp từ database bank_settings.</p>
              </div>
              {copyMessage ? <span className="status green">{copyMessage}</span> : null}
            </div>

            <div className="webhook-copy-grid" style={{ marginTop: 22 }}>
              {[
                ["Ngân hàng", invoice?.bank.bank_name || ""],
                ["Số tài khoản", invoice?.bank.account_number || ""],
                ["Chủ tài khoản", invoice?.bank.account_name || ""],
                ["Số tiền", invoice ? formatVnd(invoice.amount) : ""],
                ["Nội dung", invoice?.transfer_content || ""],
              ].map(([label, value]) => (
                <div className="webhook-copy-field" key={label}>
                  <label>{label}</label>
                  <div>
                    <code>{value}</code>
                    <button className="btn btn-secondary" disabled={!value} onClick={() => copyText(value, `Đã sao chép ${label.toLowerCase()}.`)} type="button">
                      <Icon name="check" size={16} />
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card pad" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>QR thanh toán</h2>
            <div className="invoice-qr" style={{ display: "grid", placeItems: "center", overflow: "hidden" }}>
              {invoice && qrUrl ? (
                <img
                  alt={`QR ${invoice.invoice_code}`}
                  src={qrUrl}
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 12, background: "#ffffff" }}
                />
              ) : (
                <div>
                  <Icon name="qr_code_scanner" size={74} />
                  <strong>{loading ? "Đang tải" : "Chưa có dữ liệu"}</strong>
                  <span>{invoice?.transfer_content || "..."}</span>
                </div>
              )}
            </div>
            <p className="subtitle">Quét QR hoặc chuyển khoản thủ công với nội dung chính xác.</p>
          </div>
        </section>

        <section className="card pad">
          <h2 style={{ marginTop: 0 }}>Lịch sử xử lý</h2>
          <div className="stack">
            {[
              ["Tạo hóa đơn", invoice ? `Hệ thống tạo hóa đơn ${invoice.invoice_code}.` : "Đang tải dữ liệu hóa đơn...", invoice?.created_at || "...", "blue"],
              ["Chờ đối soát", invoice ? `Nội dung nhận diện: ${invoice.transfer_content}.` : "Đang tải...", invoice?.created_at || "...", "blue"],
              effectiveStatus.tone === "green"
                ? ["Thanh toán thành công", "Số dư đã được cộng vào ví chính.", invoice?.paid_at || "...", "green"]
                : ["Đang chờ thanh toán", "Vui lòng chuyển khoản đúng nội dung để hệ thống đối soát tự động.", "...", "blue"],
            ].map(([title, desc, time, tone]) => (
              <div className="plan-timeline-item" key={`${title}-${time}`}>
                <span className={`status ${tone}`} style={{ width: 12, height: 12, padding: 0, marginTop: 3 }} />
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                  <span className="muted" style={{ fontSize: 12 }}>{time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppFrame>
  );
}
