"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminUsers, updateUserMoney, updateUserStatus, updateUserVerifiedBadge, formatVnd } from "../../lib/auth";
import { Icon, UserAvatar, VerifiedBadge } from "../../components";
import { showConfirm, showError, showToast } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

type AdminUser = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  avatar_url?: string | null;
  verified_badge?: boolean;
  money: number;
  marketing_balance?: number;
  level: string;
  status: string;
  address?: string | null;
  province_city?: string | null;
  region?: string | null;
  company?: string | null;
  tax_code?: string | null;
  citizen_id?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  plan_price?: number;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // View User Info Modal State
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);

  // Balance Adjustment Modal State
  const [targetUser, setTargetUser] = useState<AdminUser | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    fetchAdminUsers()
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        showError(err.message || "Không thể tải danh sách thành viên.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdjustBalance = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!targetUser) return;
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      showError("Số tiền phải lớn hơn 0");
      return;
    }

    setAdjustSaving(true);
    try {
      await updateUserMoney(targetUser.id, amount, adjustType, adjustReason);
      setTargetUser(null);
      setAdjustAmount("");
      setAdjustReason("");
      showToast("Đã điều chỉnh số dư thành công.");
      loadUsers();
    } catch (err: any) {
      showError(err.message || "Lỗi điều chỉnh số dư.");
    } finally {
      setAdjustSaving(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = user.status === "active" ? "locked" : "active";
    const confirmMessage = user.status === "active"
      ? `Bạn có chắc chắn muốn KHÓA tài khoản của ${user.fullname}?`
      : `Bạn có chắc chắn muốn MỞ KHÓA tài khoản của ${user.fullname}?`;

    if (!(await showConfirm(confirmMessage))) return;

    try {
      await updateUserStatus(user.id, nextStatus);
      loadUsers();
    } catch (err: any) {
      await showError("Lỗi: " + err.message);
    }
  };

  const handleToggleVerifiedBadge = async (user: AdminUser) => {
    const nextVerified = !user.verified_badge;
    const confirmMessage = nextVerified
      ? `Bật tích xanh cho ${user.fullname}?`
      : `Tắt tích xanh của ${user.fullname}?`;

    if (!(await showConfirm(confirmMessage))) return;

    try {
      await updateUserVerifiedBadge(user.id, nextVerified);
      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, verified_badge: nextVerified } : item
      )));
      setViewUser((current) => current?.id === user.id ? { ...current, verified_badge: nextVerified } : current);
      showToast(nextVerified ? "Đã bật tích xanh." : "Đã tắt tích xanh.");
    } catch (err: any) {
      await showError("Lỗi: " + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  });
  const paginatedUsers = paginate(filteredUsers, page, pageSize);

  if (loading && !users.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải danh sách thành viên...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Quản lý Thành viên</h1>
          <p>Quản lý số dư, trạng thái hoạt động và quyền hạn của thành viên hệ thống.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadUsers} disabled={loading}>
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      {/* Banners removed per toast request */}

      {/* Filter & Table Card */}
      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "block" }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              type="text"
              className="cpanel-input"
              placeholder="Tìm kiếm tên, email, sđt..."
              value={search}
              onChange={(ev) => {
                setSearch(ev.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredUsers.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Họ và Tên</th>
                    <th>Email / SĐT</th>
                    <th>Số dư</th>
                    <th>Quyền</th>
                    <th>Trạng thái</th>
                    <th>Ngày tham gia</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ color: "#71717a", fontSize: 13 }}>#{u.id}</td>
                      <td style={{ fontWeight: 700 }}>
                        <div className="admin-user-cell">
                          <UserAvatar name={u.fullname || u.email} src={u.avatar_url} size={34} />
                          <span className="name-with-badge">
                            {u.fullname}
                            {u.verified_badge ? <VerifiedBadge size={19} /> : null}
                          </span>
                          <button
                            onClick={() => handleToggleVerifiedBadge(u)}
                            className="cpanel-btn cpanel-btn-secondary"
                            style={{ height: 32, fontSize: 12, padding: "0 10px", color: u.verified_badge ? "#2563eb" : "#71717a" }}
                          >
                            <Icon name={u.verified_badge ? "check_circle" : "circle_off"} size={14} />
                            {u.verified_badge ? "Bỏ tích" : "Tích xanh"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{u.email}</div>
                        <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{u.phone || "Không có SĐT"}</div>
                      </td>
                      <td style={{ fontWeight: 900, color: "#047857" }}>{formatVnd(u.money)}</td>
                      <td>
                        <span className={`cpanel-status-pill ${u.level === "admin" ? "red" : "blue"}`}>
                          {u.level === "admin" ? "Admin" : "Thành viên"}
                        </span>
                      </td>
                      <td>
                        <span className={`cpanel-status-pill ${u.status === "active" ? "green" : "red"}`}>
                          {u.status === "active" ? "Hoạt động" : "Bị khóa"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#71717a" }}>{u.created_at}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => setViewUser(u)}
                            className="cpanel-btn cpanel-btn-secondary"
                            style={{ height: 32, fontSize: 12, padding: "0 10px" }}
                            title="Xem chi tiết thành viên"
                          >
                            <Icon name="visibility" size={14} /> Chi tiết
                          </button>
                          <button
                            onClick={() => setTargetUser(u)}
                            className="cpanel-btn cpanel-btn-secondary"
                            style={{ height: 32, fontSize: 12, padding: "0 10px" }}
                            title="Điều chỉnh số dư"
                          >
                            <Icon name="account_balance_wallet" size={14} /> ± Tiền
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="cpanel-btn cpanel-btn-secondary"
                            style={{ height: 32, fontSize: 12, padding: "0 10px", color: u.status === "active" ? "#ef4444" : "#047857" }}
                          >
                            <Icon name={u.status === "active" ? "lock" : "lock_open"} size={14} />
                            {u.status === "active" ? "Khóa" : "Mở"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>
              Không tìm thấy thành viên nào phù hợp.
            </div>
          )}
          {filteredUsers.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredUsers.length}
              itemLabel="thành viên"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {targetUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(9, 9, 11, 0.4)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          zIndex: 999,
          padding: 20
        }}>
          <div className="cpanel-card" style={{ maxWidth: 440, width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div className="cpanel-card-header">
              <h2>Điều chỉnh số dư: {targetUser.fullname}</h2>
              <button
                onClick={() => setTargetUser(null)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#71717a" }}
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <form onSubmit={handleAdjustBalance}>
              <div className="cpanel-card-body">
                {/* Error messages replaced by alert dialogues */}

                <div className="cpanel-field">
                  <label>Loại điều chỉnh</label>
                  <select
                    className="cpanel-select"
                    value={adjustType}
                    onChange={(ev) => setAdjustType(ev.target.value as any)}
                  >
                    <option value="add">Cộng tiền (+)</option>
                    <option value="subtract">Trừ tiền (-)</option>
                  </select>
                </div>

                <div className="cpanel-field">
                  <label>Số tiền (VND)</label>
                  <input
                    type="number"
                    className="cpanel-input"
                    placeholder="Ví dụ: 50000"
                    value={adjustAmount}
                    onChange={(ev) => setAdjustAmount(ev.target.value)}
                    required
                  />
                  <span style={{ fontSize: 12, color: "#71717a", marginTop: 4, display: "block" }}>
                    Số dư hiện tại: <strong style={{ color: "#047857" }}>{formatVnd(targetUser.money)}</strong>
                  </span>
                </div>

                <div className="cpanel-field">
                  <label>Lý do điều chỉnh</label>
                  <textarea
                    className="cpanel-textarea"
                    placeholder="Ví dụ: Khách chuyển khoản nạp bù, thưởng sự kiện..."
                    value={adjustReason}
                    onChange={(ev) => setAdjustReason(ev.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="cpanel-card-header" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cpanel-btn cpanel-btn-secondary"
                  onClick={() => setTargetUser(null)}
                  disabled={adjustSaving}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="cpanel-btn cpanel-btn-red"
                  disabled={adjustSaving}
                >
                  {adjustSaving ? "Đang xử lý..." : "Xác nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {viewUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(9, 9, 11, 0.4)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          zIndex: 999,
          padding: 20
        }}>
          <div className="cpanel-card" style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div className="cpanel-card-header" style={{ position: "sticky", top: 0, background: "#ffffff", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="person" size={24} style={{ color: "#dc2626" }} />
                <h2>Thông tin chi tiết thành viên</h2>
              </div>
              <button
                onClick={() => setViewUser(null)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#71717a" }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            
            <div className="cpanel-card-body" style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24 }}>
                
                {/* Basic Info Group */}
                <div>
                  <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "#18181b", borderBottom: "2px solid #e4e4e7", paddingBottom: 6 }}>
                    Thông tin cơ bản
                  </h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>ID Thành viên</span>
                      <strong style={{ fontSize: 14 }}>#{viewUser.id}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Họ và tên</span>
                      <strong className="name-with-badge" style={{ fontSize: 14 }}>
                        {viewUser.fullname}
                        {viewUser.verified_badge ? <VerifiedBadge size={19} /> : null}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Địa chỉ Email</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{viewUser.email}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Số điện thoại</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{viewUser.phone || "Chưa cập nhật"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Số CCCD / Passport</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{viewUser.citizen_id || "Chưa cập nhật"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Ngày tham gia</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{viewUser.created_at}</span>
                    </div>
                  </div>
                </div>

                {/* Account & Plan Group */}
                <div>
                  <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "#18181b", borderBottom: "2px solid #e4e4e7", paddingBottom: 6 }}>
                    Trạng thái & Tài chính
                  </h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Quyền hạn</span>
                      <span className={`cpanel-status-pill ${viewUser.level === "admin" ? "red" : "blue"}`} style={{ display: "inline-block", marginTop: 4 }}>
                        {viewUser.level === "admin" ? "Quản trị viên" : "Thành viên"}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Trạng thái tài khoản</span>
                      <span className={`cpanel-status-pill ${viewUser.status === "active" ? "green" : "red"}`} style={{ display: "inline-block", marginTop: 4 }}>
                        {viewUser.status === "active" ? "Đang hoạt động" : "Bị khóa"}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Số dư khả dụng</span>
                      <strong style={{ fontSize: 16, color: "#047857" }}>{formatVnd(viewUser.money)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Số dư Marketing</span>
                      <strong style={{ fontSize: 14, color: "#0369a1" }}>{formatVnd(viewUser.marketing_balance)}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Service Plan Group */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "#18181b", borderBottom: "2px solid #e4e4e7", paddingBottom: 6 }}>
                  Gói dịch vụ đang sử dụng
                </h3>
                {viewUser.plan_name ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Tên gói cước</span>
                      <strong style={{ color: "#ef4444" }}>{viewUser.plan_name} ({viewUser.plan_code})</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Giá gói cước</span>
                      <strong>{formatVnd(viewUser.plan_price)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Ngày đăng ký</span>
                      <span>{viewUser.plan_started_at || "Không rõ"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Ngày hết hạn</span>
                      <span>{viewUser.plan_expires_at || "Không thời hạn"}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "10px 0", color: "#71717a", fontStyle: "italic", fontSize: 14 }}>
                    Chưa đăng ký gói dịch vụ nào.
                  </div>
                )}
              </div>

              {/* Business & Address Group */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "#18181b", borderBottom: "2px solid #e4e4e7", paddingBottom: 6 }}>
                  Thông tin doanh nghiệp & Liên hệ
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Công ty</span>
                    <span>{viewUser.company || "Không có"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Mã số thuế</span>
                    <span>{viewUser.tax_code || "Không có"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Địa chỉ</span>
                    <span>{viewUser.address || "Không có"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Tỉnh / Thành phố</span>
                    <span>{viewUser.province_city || "Không có"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#71717a", fontWeight: 700, display: "block" }}>Quốc gia / Vùng</span>
                    <span>{viewUser.region || "Không có"}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="cpanel-card-header" style={{ justifyContent: "flex-end", position: "sticky", bottom: 0, background: "#ffffff", borderTop: "1px solid #e4e4e7", padding: "12px 24px" }}>
              <button
                type="button"
                className="cpanel-btn cpanel-btn-secondary"
                onClick={() => setViewUser(null)}
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
