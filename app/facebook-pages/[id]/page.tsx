"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../../components";
import { fetchFacebookPage, type FacebookPage } from "../../lib/auth";
import { showError } from "../../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function CopyField({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="webhook-copy-field">
      <label>{label}</label>
      <div>
        <code>{value || "Chưa có"}</code>
        <button className="btn btn-secondary" disabled={!value} onClick={copy} type="button">
          <Icon name="link" size={16} /> {copied ? "Đã copy" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function FacebookPageDetailPage() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState<FacebookPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) {
      showError("ID Fanpage không hợp lệ.");
      setLoading(false);
      return;
    }

    fetchFacebookPage(id)
      .then(setPage)
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải Fanpage."))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppFrame active="/facebook-pages" title="Chi tiết Fanpage">
      <PageHeader
        eyebrow="Facebook Webhook"
        title={page?.page_name || "Chi tiết Fanpage Facebook"}
        desc="Copy Callback URL và Verify Token này sang Facebook Developer để cấu hình webhook nhận tin nhắn khách hàng."
        action={<Link className="btn btn-secondary" href="/facebook-pages"><Icon name="chevron_left" /> Quay lại</Link>}
      />

      {/* Banners removed per toast request */}

      {loading ? (
        <section className="card pad" style={{ textAlign: "center" }}>
          <Icon name="timer" size={48} />
          <p className="subtitle">Đang tải cấu hình Fanpage...</p>
        </section>
      ) : page ? (
        <div className="stack">
          <section className="grid-4">
            <StatCard label="Page ID" value={page.page_id} help="ID Fanpage trên Facebook" icon="group_work" />
            <StatCard label="Trạng thái" value={page.status === "active" ? "Hoạt động" : "Mất kết nối"} help="Trạng thái kết nối token" icon="toggle_on" />
            <StatCard label="Inbox hôm nay" value={String(page.inbox_today)} help="Sự kiện webhook đã nhận" icon="mail" />
            <StatCard label="Danh mục" value={page.category || "N/A"} help="Lấy tự động từ Graph API" icon="menu_book" />
          </section>

          <section className="card pad webhook-config-card">
            <div className="between">
              <div>
                <h2 style={{ margin: 0 }}>Cấu hình Facebook Webhook</h2>
                <p className="subtitle">Dán các giá trị này vào phần Webhooks trong Meta for Developers.</p>
              </div>
              <span className="status green">Sẵn sàng</span>
            </div>

            <div className="webhook-copy-grid">
              <CopyField label="Callback URL" value={page.webhook_url} />
              <CopyField label="Verify Token" value={page.verify_token} />
            </div>
          </section>

          <section className="grid-2">
            <div className="card pad">
              <div className="row"><Icon name="settings" /><h3>Setup trong Facebook Developer</h3></div>
              <ol className="facebook-token-steps">
                <li>Vào Meta for Developers, mở App đang dùng để quản lý Page.</li>
                <li>Chọn mục Webhooks, chọn object `Page`.</li>
                <li>Dán `Callback URL` và `Verify Token` ở trên vào form cấu hình.</li>
                <li>Bấm Verify and Save, sau đó subscribe các field như `messages`, `messaging_postbacks`.</li>
              </ol>
            </div>

            <div className="card pad">
              <div className="row"><Icon name="security" /><h3>Thông tin kết nối</h3></div>
              <div className="stack" style={{ gap: 12 }}>
                <div className="between"><span className="muted">Tên Fanpage</span><strong>{page.page_name}</strong></div>
                <div className="between"><span className="muted">Page ID</span><strong>{page.page_id}</strong></div>
                <div className="between"><span className="muted">Kết nối lúc</span><strong>{formatDate(page.connected_at)}</strong></div>
                <div className="between"><span className="muted">Online gần nhất</span><strong>{formatDate(page.last_seen_at)}</strong></div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AppFrame>
  );
}
