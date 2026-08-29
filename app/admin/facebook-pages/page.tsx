"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components";
import { deleteAdminFacebookPage, fetchAdminFacebookPages, fetchAdminLogs, updateAdminFacebookPage, type AdminFacebookPage } from "../../lib/auth";
import { showConfirm, showError, showToast } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

type AdminActivityLog = {
  id: number;
  subject: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  tone: string;
  created_at?: string;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return value || "-";
  return date.toLocaleString("vi-VN");
}

function getPageProgress(item: AdminFacebookPage) {
  let score = 0;
  if (item.status === "active") score += 40;
  if (item.ai_enabled) score += 20;
  if (item.bot_name || item.ai_bot_id) score += 15;
  if (item.inbox_today > 0) score += 15;
  const lastSeen = parseDate(item.last_seen_at || item.connected_at);
  if (lastSeen) {
    const hours = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
    if (hours <= 24) score += 10;
    else if (hours <= 72) score += 5;
  }
  return Math.min(100, score);
}

export default function AdminFacebookPagesPage() {
  const [pages, setPages] = useState<AdminFacebookPage[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminFacebookPage | null>(null);
  const [viewing, setViewing] = useState<AdminFacebookPage | null>(null);
  const [saving, setSaving] = useState(false);

  function loadPages() {
    setLoading(true);
    Promise.all([fetchAdminFacebookPages(), fetchAdminLogs()])
      .then(([nextPages, nextLogs]) => {
        setPages(nextPages);
        setLogs(
          (nextLogs as Array<Record<string, any>>).map((log) => ({
            id: Number(log.id || 0),
            subject: String(log.subject || ""),
            action: String(log.action || ""),
            actor: String(log.actor || ""),
            target: String(log.target || ""),
            detail: String(log.detail || ""),
            tone: String(log.tone || "blue"),
            created_at: log.created_at ? String(log.created_at) : undefined,
          }))
        );
      })
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải fanpage."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPages();
  }, []);

  const filteredPages = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return pages;
    return pages.filter((item) =>
      [item.page_name, item.page_id, item.category, item.owner_name, item.owner_email, item.bot_name]
        .some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [pages, search]);

  const paginatedPages = paginate(filteredPages, page, pageSize);
  const activeCount = pages.filter((item) => item.status === "active").length;
  const aiCount = pages.filter((item) => item.ai_enabled).length;

  const viewingLogs = useMemo(() => {
    if (!viewing) return [];
    const pageName = viewing.page_name.toLowerCase();
    const pageId = String(viewing.page_id || "").toLowerCase();
    return logs.filter((log) => {
      const haystack = `${log.subject} ${log.action} ${log.target} ${log.detail}`.toLowerCase();
      return haystack.includes(pageName) || haystack.includes(pageId) || log.subject.toLowerCase().includes("fanpage");
    }).slice(0, 8);
  }, [logs, viewing]);

  async function savePage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await updateAdminFacebookPage(editing.id, {
        page_name: editing.page_name,
        category: editing.category,
        status: editing.status,
        ai_enabled: editing.ai_enabled,
        ai_bot_id: editing.ai_bot_id,
      });
      showToast("Đã cập nhật fanpage.");
      setEditing(null);
      loadPages();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật fanpage.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePage(item: AdminFacebookPage) {
    if (!(await showConfirm(`Xoá fanpage "${item.page_name}"?`))) return;
    try {
      await deleteAdminFacebookPage(item.id);
      showToast("Đã xoá fanpage.");
      loadPages();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá fanpage.");
    }
  }

  if (loading && !pages.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải fanpage...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Quản lý fanpage</h1>
          <p>Theo dõi toàn bộ fanpage Facebook khách hàng đã kết nối.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadPages} disabled={loading} type="button">
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      <div className="admin-summary-strip">
        <span>Tổng: <strong>{pages.length}</strong></span>
        <span>Hoạt động: <strong>{activeCount}</strong></span>
        <span>Đã bật AI: <strong>{aiCount}</strong></span>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "block" }}>
          <div style={{ position: "relative", maxWidth: 420 }}>
            <input
              className="cpanel-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên page, pageId, chủ sở hữu..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredPages.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Fanpage</th>
                    <th>Chủ sở hữu</th>
                    <th>Page ID</th>
                    <th>Quyền</th>
                    <th>Trạng thái</th>
                    <th>Bot AI</th>
                    <th>Inbox hôm nay</th>
                    <th>Lần cuối online</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPages.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{item.page_name}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{item.category || "Không rõ danh mục"}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{item.owner_name || `User #${item.owner_id}`}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{item.owner_email}</div>
                      </td>
                      <td style={{ fontSize: 13, color: "#52525b" }}>{item.page_id}</td>
                      <td>
                        <span className="cpanel-status-pill blue">{item.permissions.length} quyền</span>
                      </td>
                      <td>
                        <span className={`cpanel-status-pill ${item.status === "active" ? "green" : item.status === "paused" ? "orange" : "red"}`}>
                          {item.status === "active" ? "Hoạt động" : item.status === "paused" ? "Tạm dừng" : item.status === "disconnected" ? "Mất kết nối" : "Đã tắt"}
                        </span>
                      </td>
                      <td>
                        {item.ai_enabled ? (
                          <span className="cpanel-status-pill green">{item.bot_name || `Bot #${item.ai_bot_id}`}</span>
                        ) : (
                          <span className="cpanel-status-pill orange">Chưa bật</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 900 }}>{item.inbox_today}</td>
                      <td style={{ fontSize: 13, color: "#71717a" }}>{item.last_seen_at || item.connected_at || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => setViewing(item)}>
                            <Icon name="visibility" size={14} /> Chi tiết
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => setEditing(item)}>
                            <Icon name="edit_note" size={14} /> Sửa
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => deletePage(item)}>
                            <Icon name="delete" size={14} /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Không có fanpage phù hợp.</div>
          )}
          {filteredPages.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredPages.length}
              itemLabel="fanpage"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>

      {viewing ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setViewing(null)}>
          <div className="confirm-modal facebook-page-modal" role="dialog" aria-modal="true" aria-labelledby="facebook-page-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <span className="eyebrow">Chi tiết fanpage</span>
                <h2 id="facebook-page-detail-title">{viewing.page_name}</h2>
                <p className="subtitle" style={{ margin: "8px 0 0" }}>{viewing.page_id}</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setViewing(null)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="cpanel-card-body" style={{ padding: "18px 0 0", display: "grid", gap: 16 }}>
              <div className="grid-2">
                <div className="cpanel-card" style={{ padding: 16, boxShadow: "none" }}>
                  <div style={{ color: "#71717a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tình trạng</div>
                  <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    <span className={`cpanel-status-pill ${viewing.status === "active" ? "green" : viewing.status === "paused" ? "orange" : "red"}`}>
                      {viewing.status === "active" ? "Hoạt động" : viewing.status === "paused" ? "Tạm dừng" : viewing.status === "disconnected" ? "Mất kết nối" : "Đã tắt"}
                    </span>
                    <span className={`cpanel-status-pill ${viewing.ai_enabled ? "green" : "orange"}`}>
                      {viewing.ai_enabled ? "AI đang bật" : "AI đang tắt"}
                    </span>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="between" style={{ marginBottom: 8 }}>
                      <span style={{ color: "#52525b", fontWeight: 700 }}>Tiến trình hoạt động</span>
                      <strong>{getPageProgress(viewing)}%</strong>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
                      <div style={{ width: `${getPageProgress(viewing)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #ef4444, #f87171)" }} />
                    </div>
                    <p style={{ margin: "10px 0 0", color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                      Điểm này là ước tính theo trạng thái page, AI, inbox và lần online gần nhất.
                    </p>
                  </div>
                </div>

                <div className="cpanel-card" style={{ padding: 16, boxShadow: "none" }}>
                  <div style={{ color: "#71717a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Thông tin</div>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <div className="between"><span>Chủ sở hữu</span><strong>{viewing.owner_name || `User #${viewing.owner_id}`}</strong></div>
                    <div className="between"><span>Email</span><strong>{viewing.owner_email || "-"}</strong></div>
                    <div className="between"><span>Bot AI</span><strong>{viewing.bot_name || (viewing.ai_bot_id ? `Bot #${viewing.ai_bot_id}` : "Chưa gắn bot")}</strong></div>
                    <div className="between"><span>Quyền</span><strong>{viewing.permissions.length}</strong></div>
                    <div className="between"><span>Inbox hôm nay</span><strong>{viewing.inbox_today}</strong></div>
                    <div className="between"><span>Kết nối lần cuối</span><strong>{formatDate(viewing.last_seen_at || viewing.connected_at)}</strong></div>
                  </div>
                </div>
              </div>

              <div className="cpanel-card" style={{ padding: 16, boxShadow: "none" }}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <strong>Log gần đây</strong>
                  <span className="cpanel-status-pill blue">{viewingLogs.length} log</span>
                </div>
                {viewingLogs.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {viewingLogs.map((log) => (
                      <div key={log.id} style={{ padding: 12, border: "1px solid #e4e4e7", borderRadius: 12, background: "#fafafa" }}>
                        <div className="between" style={{ gap: 12, alignItems: "center" }}>
                          <strong>{log.action}</strong>
                          <span className={`cpanel-status-pill ${log.tone || "blue"}`}>{log.subject}</span>
                        </div>
                        <p style={{ margin: "6px 0 0", color: "#52525b", fontSize: 13, lineHeight: 1.5 }}>{log.detail}</p>
                        <div style={{ marginTop: 8, color: "#71717a", fontSize: 12 }}>{formatDate(log.created_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#71717a", fontSize: 13 }}>Chưa có log fanpage phù hợp.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="modal-backdrop">
          <form className="confirm-modal" onSubmit={savePage}>
            <div className="between">
              <h2>Sửa fanpage</h2>
              <button className="icon-btn" type="button" onClick={() => setEditing(null)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="stack" style={{ marginTop: 18 }}>
              <input className="input" value={editing.page_name || ""} onChange={(event) => setEditing({ ...editing, page_name: event.target.value })} placeholder="Tên fanpage" />
              <input className="input" value={editing.category || ""} onChange={(event) => setEditing({ ...editing, category: event.target.value })} placeholder="Danh mục" />
              <select className="input" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã tắt</option>
                <option value="disconnected">Mất kết nối</option>
                <option value="paused">Tạm dừng</option>
              </select>
              <label className="cpanel-toggle-row">
                <input type="checkbox" checked={editing.ai_enabled} onChange={(event) => setEditing({ ...editing, ai_enabled: event.target.checked })} />
                <span>Bật AI</span>
              </label>
              <input className="input" value={editing.ai_bot_id ?? ""} onChange={(event) => setEditing({ ...editing, ai_bot_id: Number(event.target.value || 0) || null })} placeholder="ID bot AI" />
            </div>
            <div className="dashboard-popup-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>Huỷ</button>
              <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
