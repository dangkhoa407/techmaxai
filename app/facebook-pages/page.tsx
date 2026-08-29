"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import { addFacebookPage, deleteFacebookPage, fetchAiBots, fetchFacebookPages, updateFacebookPageAiSettings, type AiBot, type FacebookPage } from "../lib/auth";
import { showConfirm, showToast, showError } from "../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function FacebookPagesPage() {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [bots, setBots] = useState<AiBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingAiId, setUpdatingAiId] = useState<number | null>(null);
  const [form, setForm] = useState({
    page_id: "",
    access_token: "",
  });

  const filteredPages = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return pages;

    return pages.filter((page) =>
      [page.page_id, page.page_name, page.category, page.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [pages, search]);

  const activeCount = pages.filter((page) => page.status === "active").length;
  const disconnectedCount = pages.filter((page) => page.status === "disconnected").length;
  const inboxToday = pages.reduce((total, page) => total + Number(page.inbox_today || 0), 0);

  async function loadPages() {
    setLoading(true);
    try {
      const [nextPages, botPayload] = await Promise.all([fetchFacebookPages(), fetchAiBots()]);
      setPages(nextPages);
      setBots(botPayload.bots);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải Fanpage Facebook.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPages();
  }, []);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAddPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const nextPages = await addFacebookPage(form);
      setPages(nextPages);
      setModalOpen(false);
      setForm({
        page_id: "",
        access_token: "",
      });
      showToast("Đã thêm Fanpage Facebook thành công.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể thêm Fanpage Facebook.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePage(id: number) {
    if (!(await showConfirm("Xóa Fanpage Facebook này khỏi hệ thống?"))) return;

    try {
      setPages(await deleteFacebookPage(id));
      showToast("Đã xóa Fanpage Facebook.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa Fanpage Facebook.");
    }
  }

  async function handleUpdateAiSettings(page: FacebookPage, aiEnabled: boolean, aiBotId = page.ai_bot_id) {
    setUpdatingAiId(page.id);
    try {
      setPages(await updateFacebookPageAiSettings(page.id, { aiEnabled, aiBotId }));
      showToast(aiEnabled ? "Đã bật AI tự động cho Fanpage." : "Đã tắt AI tự động cho Fanpage.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật AI cho Fanpage.");
    } finally {
      setUpdatingAiId(null);
    }
  }

  return (
    <AppFrame active="/facebook-pages" title="Facebook Fanpages">
      <PageHeader
        title="Fanpage Facebook"
        desc="Quản lý các Fanpage Facebook đã kết nối để chăm sóc khách hàng, chạy chiến dịch và theo dõi trạng thái vận hành."
        action={
          <button className="btn btn-red" onClick={() => setModalOpen(true)} type="button">
            <Icon name="add" /> Thêm Fanpage
          </button>
        }
      />

      {/* Banners removed per toast request */}

      <div className="stack">
        <section className="grid-4">
          <StatCard label="Total Pages" value={String(pages.length)} help="Tất cả Fanpage đã thêm" icon="group_work" />
          <StatCard label="Active" value={String(activeCount)} help="Fanpage sẵn sàng chạy chiến dịch" icon="toggle_on" />
          <StatCard label="Disconnected" value={String(disconnectedCount)} help="Fanpage mất quyền truy cập" icon="cloud_off" />
          <StatCard label="Inbox Today" value={String(inboxToday)} help="Tin nhắn mới trong hôm nay" icon="mail" />
        </section>

        <section className="card">
          <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ margin: 0 }}>Danh sách Fanpage Facebook</h2>
              <p className="subtitle">
                Theo dõi trạng thái kết nối, quyền truy cập, tin nhắn mới và chiến dịch đang chạy trên từng Fanpage.
              </p>
            </div>
            <div className="row">
              <input className="input" placeholder="Tìm kiếm Fanpage" style={{ width: 260 }} value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="btn btn-secondary" onClick={() => setModalOpen(true)} type="button">
                <Icon name="add" size={18} /> Thêm Fanpage
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="timer" size={54} />
              <p className="subtitle">Đang tải Fanpage Facebook...</p>
            </div>
          ) : filteredPages.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fanpage</th>
                    <th>Page ID</th>
                    <th>Danh mục</th>
                    <th>Inbox hôm nay</th>
                    <th>Bot AI</th>
                    <th>Trạng thái</th>
                    <th>Kết nối</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page) => (
                    <tr key={page.id}>
                      <td>
                        <strong>{page.page_name}</strong>
                        <p className="muted" style={{ margin: "4px 0 0" }}>Online: {formatDate(page.last_seen_at)}</p>
                      </td>
                      <td>{page.page_id}</td>
                      <td>{page.category || "Chưa phân loại"}</td>
                      <td>{page.inbox_today}</td>
                      <td>
                        <div className="stack" style={{ gap: 8, minWidth: 220 }}>
                          <select
                            className="input"
                            disabled={updatingAiId === page.id}
                            value={page.ai_bot_id || ""}
                            onChange={(event) => handleUpdateAiSettings(page, page.ai_enabled, event.target.value ? Number(event.target.value) : null)}
                          >
                            <option value="">Chọn bot AI</option>
                            {bots.map((bot) => (
                              <option key={bot.id} value={bot.id}>{bot.full_name}</option>
                            ))}
                          </select>
                          <button
                            className={page.ai_enabled ? "btn btn-primary" : "btn btn-secondary"}
                            disabled={updatingAiId === page.id || (!page.ai_enabled && !page.ai_bot_id)}
                            onClick={() => handleUpdateAiSettings(page, !page.ai_enabled)}
                            type="button"
                          >
                            <Icon name="smart_toy" size={16} /> {page.ai_enabled ? "AI bật" : "Bật AI"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={page.status === "active" ? "status green" : page.status === "paused" ? "status orange" : "status red"}>
                          {page.status === "active" ? "Hoạt động" : page.status === "paused" ? "Tạm dừng" : "Mất kết nối"}
                        </span>
                      </td>
                      <td>{formatDate(page.connected_at)}</td>
                      <td>
                        <div className="row">
                          <Link className="btn btn-secondary" href={`/facebook-pages/${page.id}`}>Chi tiết</Link>
                          <button className="btn btn-secondary" onClick={() => handleDeletePage(page.id)} type="button">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="group_work" size={54} />
              <p className="subtitle">Chưa có Fanpage Facebook nào được kết nối.</p>
              <button className="btn btn-red" onClick={() => setModalOpen(true)} type="button">
                <Icon name="add" /> Kết nối Fanpage đầu tiên
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="row"><Icon name="menu_book" /> Hướng dẫn sử dụng</h2>
          <div className="grid-3">
            {[
              ["link", "Kết nối Fanpage", "Nhấn Thêm Fanpage, nhập Page ID và Page Access Token. Hệ thống sẽ tự lấy tên Fanpage từ Facebook."],
              ["security", "Xác thực token", "Backend gọi Facebook Graph API để kiểm tra token và đọc thông tin Page trước khi lưu vào database."],
              ["mail", "Theo dõi inbox", "Tin nhắn mới từ khách hàng sẽ được ghi nhận để hỗ trợ chăm sóc và phân loại khách hàng."],
              ["campaign", "Chạy chiến dịch", "Chọn Fanpage đã kết nối để triển khai nội dung chăm sóc, nhắc lịch hoặc quảng bá sản phẩm."],
              ["toggle_on", "Bật / Tắt Fanpage", "Chỉ Fanpage đang hoạt động mới có thể tham gia chiến dịch tự động."],
              ["warning", "Mất quyền truy cập", "Nếu token Facebook hết hạn hoặc quyền bị thu hồi, Fanpage sẽ được đánh dấu cần kết nối lại."]
            ].map(([icon, title, text]) => (
              <div className="card pad" key={title}>
                <Icon name={icon} />
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setModalOpen(false)}>
          <form className="confirm-modal facebook-page-modal" role="dialog" aria-modal="true" aria-labelledby="facebook-page-title" onClick={(event) => event.stopPropagation()} onSubmit={handleAddPage}>
            <div className="between">
              <div>
                <span className="eyebrow">Facebook Page</span>
                <h2 id="facebook-page-title">Thêm Fanpage Facebook</h2>
                <p className="subtitle">Nhập thông tin Fanpage để hệ thống lưu kênh và dùng cho chatbot/campaign.</p>
              </div>
              <button className="btn btn-secondary icon-top-button" disabled={saving} onClick={() => setModalOpen(false)} type="button" aria-label="Đóng">
                <Icon name="x" />
              </button>
            </div>

            <div className="profile-form-grid facebook-page-form">
              <label><span>Page ID</span><input className="input" value={form.page_id} onChange={(event) => updateForm("page_id", event.target.value)} placeholder="123456789012345" required /></label>
              <label><span>Page Access Token</span><input className="input" value={form.access_token} onChange={(event) => updateForm("access_token", event.target.value)} placeholder="EAAB..." /></label>
            </div>

            <div className="facebook-permission-box">
              <strong>Hướng dẫn lấy Page Access Token</strong>
              <ol className="facebook-token-steps">
                <li>Vào Meta for Developers, mở ứng dụng Facebook của bạn.</li>
                <li>Chọn Graph API Explorer, đăng nhập tài khoản đang quản trị Fanpage.</li>
                <li>Thêm quyền `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata` và `pages_messaging` nếu cần inbox.</li>
                <li>Chạy endpoint `/me/accounts` để lấy danh sách Page, copy `id` và `access_token` của Fanpage cần kết nối.</li>
              </ol>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-secondary" disabled={saving} onClick={() => setModalOpen(false)} type="button">Hủy</button>
              <button className="btn btn-red" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu Fanpage"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </AppFrame>
  );
}
