"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components";
import { deleteAdminZaloAccount, fetchAdminZaloAccounts, scanAdminZaloAccountMessages, updateAdminZaloAccount, type AdminZaloAccount } from "../../lib/auth";
import { showConfirm, showError, showToast } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

function statusTone(status?: string) {
  if (status === "active" || status === "online") return "green";
  if (status === "connecting") return "orange";
  return "red";
}

function normalizeRealtimeText(value?: string | null, fallback = "Chưa rõ") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (lower.includes("mất kết nối") || lower.includes("máº¥t káº¿t ná»‘i")) return "Mất kết nối";
  if (lower.includes("tạm dừng") || lower.includes("táº¡m dá»«ng")) return "Tạm dừng";
  if (lower.includes("kết nối") || lower.includes("káº¿t ná»‘i")) return "Đang kết nối";
  if (text.includes("?")) return fallback;
  return text;
}

function realtimeStatusLabel(status?: string | null, fallback?: string | null) {
  switch (status) {
    case "online":
      return "Online";
    case "connecting":
      return "Đang kết nối";
    case "offline":
    case "inactive":
      return "Tạm dừng";
    case "error":
      return "Lỗi";
    default:
      return normalizeRealtimeText(fallback, "Chưa rõ");
  }
}

export default function AdminZaloAccountsPage() {
  const [accounts, setAccounts] = useState<AdminZaloAccount[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminZaloAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanningId, setScanningId] = useState<number | null>(null);

  function loadAccounts() {
    setLoading(true);
    fetchAdminZaloAccounts()
      .then(setAccounts)
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải tài khoản Zalo."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter((account) =>
      [
        account.display_name,
        account.phone_number,
        account.own_id,
        account.owner_name,
        account.owner_email,
        account.bot_name,
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [accounts, search]);

  const paginatedAccounts = paginate(filteredAccounts, page, pageSize);
  const activeCount = accounts.filter((account) => account.status === "active").length;
  const onlineCount = accounts.filter((account) => account.runtime_online).length;

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await updateAdminZaloAccount(editing.id, {
        display_name: editing.display_name,
        phone_number: editing.phone_number,
        proxy: editing.proxy,
        status: editing.status,
        ai_enabled: editing.ai_enabled,
        ai_bot_id: editing.ai_bot_id,
      });
      showToast("Đã cập nhật tài khoản Zalo.");
      setEditing(null);
      loadAccounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật tài khoản Zalo.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(account: AdminZaloAccount) {
    if (!(await showConfirm(`Xoá tài khoản Zalo "${account.display_name || account.own_id}"?`))) return;
    try {
      await deleteAdminZaloAccount(account.id);
      showToast("Đã xoá tài khoản Zalo.");
      loadAccounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá tài khoản Zalo.");
    }
  }

  async function scanMessages(account: AdminZaloAccount) {
    setScanningId(account.id);
    try {
      const payload = await scanAdminZaloAccountMessages(account.id);
      showToast(payload.message || "Đã gửi yêu cầu quét tin nhắn Zalo.");
      window.setTimeout(loadAccounts, 2500);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể quét tin nhắn Zalo.");
    } finally {
      setScanningId(null);
    }
  }

  if (loading && !accounts.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải tài khoản Zalo...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Quản lý tài khoản Zalo</h1>
          <p>Theo dõi toàn bộ tài khoản Zalo khách hàng đã kết nối trong hệ thống.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadAccounts} disabled={loading} type="button">
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      <div className="admin-summary-strip">
        <span>Tổng: <strong>{accounts.length}</strong></span>
        <span>Đang bật: <strong>{activeCount}</strong></span>
        <span>Online realtime: <strong>{onlineCount}</strong></span>
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
              placeholder="Tìm theo tên, SĐT, ownId, chủ sở hữu..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredAccounts.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Chủ sở hữu</th>
                    <th>Own ID</th>
                    <th>Proxy</th>
                    <th>Trạng thái</th>
                    <th>Bot AI</th>
                    <th>Lần cuối online</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{account.display_name || "Chưa có tên"}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{account.phone_number || "Không có SĐT"}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{account.owner_name || `User #${account.owner_id}`}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{account.owner_email}</div>
                      </td>
                      <td style={{ fontSize: 13, color: "#52525b" }}>{account.own_id}</td>
                      <td>{account.proxy || "Không dùng"}</td>
                      <td>
                        <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                          <span className={`cpanel-status-pill ${account.status === "active" ? "green" : "red"}`}>
                            {account.status === "active" ? "Hoạt động" : "Đã tắt"}
                          </span>
                          <span className={`cpanel-status-pill ${statusTone(account.realtime_status)}`}>
                            {realtimeStatusLabel(account.realtime_status, account.realtime_status_text)}
                          </span>
                        </div>
                      </td>
                      <td>
                        {account.ai_enabled ? (
                          <span className="cpanel-status-pill green">{account.bot_name || `Bot #${account.ai_bot_id}`}</span>
                        ) : (
                          <span className="cpanel-status-pill orange">Chưa bật</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: "#71717a" }}>{account.last_seen_at || account.connected_at || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="cpanel-btn cpanel-btn-secondary" disabled={scanningId === account.id || !account.runtime_online} style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => scanMessages(account)}>
                            <Icon name="refresh_cw" size={14} /> {scanningId === account.id ? "Đang quét" : "Quét tin"}
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => setEditing(account)}>
                            <Icon name="edit_note" size={14} /> Sửa
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => deleteAccount(account)}>
                            <Icon name="x" size={14} /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Không có tài khoản Zalo phù hợp.</div>
          )}
          {filteredAccounts.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredAccounts.length}
              itemLabel="tài khoản"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="modal-backdrop">
          <form className="confirm-modal" onSubmit={saveAccount}>
            <div className="between">
              <h2>Sửa tài khoản Zalo</h2>
              <button className="icon-btn" type="button" onClick={() => setEditing(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="stack" style={{ marginTop: 18 }}>
              <input className="input" value={editing.display_name || ""} onChange={(event) => setEditing({ ...editing, display_name: event.target.value })} placeholder="Tên hiển thị" />
              <input className="input" value={editing.phone_number || ""} onChange={(event) => setEditing({ ...editing, phone_number: event.target.value })} placeholder="Số điện thoại" />
              <input className="input" value={editing.proxy || ""} onChange={(event) => setEditing({ ...editing, proxy: event.target.value })} placeholder="Proxy" />
              <select className="input" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã tắt</option>
                <option value="locked">Bị khoá</option>
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
