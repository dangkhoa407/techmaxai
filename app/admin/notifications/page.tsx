"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAdminNotifications,
  fetchAdminUsers,
  sendAdminNotification,
  type AppNotification
} from "../../lib/auth";
import { Icon } from "../../components";
import { showError, showToast } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

type AdminUser = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  status: string;
  level: string;
};

const toneOptions = [
  { value: "blue", label: "Thông tin" },
  { value: "green", label: "Thành công" },
  { value: "orange", label: "Cảnh báo" },
  { value: "red", label: "Khẩn cấp" },
  { value: "gray", label: "Hệ thống" },
] as const;

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("blue");
  const [actionUrl, setActionUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationPageSize, setNotificationPageSize] = useState(10);

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchAdminUsers(), fetchAdminNotifications()])
      .then(([userRows, notificationRows]) => {
        setUsers(userRows);
        setNotifications(notificationRows);
      })
      .catch((err) => showError(err.message || "Không thể tải dữ liệu thông báo."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => (
      user.fullname.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.phone || "").includes(q)
    ));
  }, [search, users]);

  const paginatedUsers = paginate(filteredUsers, page, pageSize);
  const filteredNotifications = useMemo(() => {
    const q = notificationSearch.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((item) =>
      [
        item.id,
        item.user_id,
        item.user_name,
        item.user_email,
        item.title,
        item.message,
        item.read_at ? "Đã đọc" : "Chưa đọc",
        item.created_at,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [notificationSearch, notifications]);
  const paginatedNotifications = paginate(filteredNotifications, notificationPage, notificationPageSize);
  const activeUserCount = users.filter((user) => user.status === "active").length;
  const selectedCount = selectedUserIds.length;

  const toggleUser = (userId: number) => {
    setSelectedUserIds((items) => (
      items.includes(userId) ? items.filter((id) => id !== userId) : [...items, userId]
    ));
  };

  const selectVisibleUsers = () => {
    const visibleIds = paginatedUsers.map((user) => user.id);
    setSelectedUserIds((items) => [...new Set([...items, ...visibleIds])]);
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (target === "selected" && !selectedUserIds.length) {
      showError("Vui lòng chọn ít nhất một thành viên nhận thông báo.");
      return;
    }

    setSaving(true);
    try {
      const payload = await sendAdminNotification({
        target,
        user_ids: target === "selected" ? selectedUserIds : [],
        title,
        message,
        tone,
        action_url: actionUrl.trim() || undefined,
      });
      showToast(payload.message || "Đã gửi thông báo.");
      setTitle("");
      setMessage("");
      setActionUrl("");
      setSelectedUserIds([]);
      setTarget("all");
      loadData();
    } catch (err: any) {
      showError(err.message || "Không thể gửi thông báo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Quản lý thông báo</h1>
          <p>Gửi thông báo cho toàn bộ thành viên hoặc chọn từng thành viên cụ thể trong hệ thống.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadData} disabled={loading} type="button">
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      <div className="admin-notification-grid">
        <form className="cpanel-card" onSubmit={handleSubmit}>
          <div className="cpanel-card-header">
            <div>
              <h2>Soạn thông báo</h2>
              <p style={{ margin: "4px 0 0", color: "#71717a", fontSize: 13 }}>
                Người dùng sẽ thấy thông báo trong biểu tượng chuông ở dashboard.
              </p>
            </div>
          </div>
          <div className="cpanel-card-body">
            <div className="cpanel-field">
              <label>Người nhận</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className={target === "all" ? "cpanel-btn cpanel-btn-red" : "cpanel-btn cpanel-btn-secondary"}
                  type="button"
                  onClick={() => setTarget("all")}
                >
                  <Icon name="groups" size={16} /> Tất cả user active ({activeUserCount})
                </button>
                <button
                  className={target === "selected" ? "cpanel-btn cpanel-btn-red" : "cpanel-btn cpanel-btn-secondary"}
                  type="button"
                  onClick={() => setTarget("selected")}
                >
                  <Icon name="group" size={16} /> Từng user ({selectedCount})
                </button>
              </div>
            </div>

            <div className="cpanel-field">
              <label>Tiêu đề</label>
              <input className="cpanel-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Bảo trì hệ thống tối nay" required />
            </div>

            <div className="cpanel-field">
              <label>Nội dung</label>
              <textarea className="cpanel-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Nhập nội dung thông báo..." required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <div className="cpanel-field">
                <label>Màu trạng thái</label>
                <select className="cpanel-select" value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
                  {toneOptions.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="cpanel-field">
                <label>Link hành động</label>
                <input className="cpanel-input" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="/deposit, /packages..." />
              </div>
            </div>
          </div>
          <div className="cpanel-card-header" style={{ justifyContent: "flex-end", gap: 10 }}>
            <button className="cpanel-btn cpanel-btn-red" disabled={saving} type="submit">
              <Icon name="schedule_send" size={16} /> {saving ? "Đang gửi..." : "Gửi thông báo"}
            </button>
          </div>
        </form>

        <div className="cpanel-card">
          <div className="cpanel-card-header" style={{ display: "block" }}>
            <h2>Chọn từng user</h2>
            <div style={{ position: "relative", marginTop: 12 }}>
              <input
                className="cpanel-input"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm tên, email, SĐT..."
                style={{ paddingLeft: 40 }}
              />
              <span style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
                <Icon name="search" size={18} />
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={selectVisibleUsers}>
                Chọn trang này
              </button>
              <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={clearSelectedUsers}>
                Bỏ chọn
              </button>
            </div>
          </div>
          <div className="cpanel-card-body" style={{ padding: 0 }}>
            <div style={{ maxHeight: 430, overflow: "auto" }}>
              {paginatedUsers.map((user) => (
                <label
                  key={user.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                >
                  <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} />
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{user.fullname}</strong>
                    <span style={{ fontSize: 12, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
                  </span>
                  <span className={`cpanel-status-pill ${user.status === "active" ? "green" : "red"}`} style={{ marginLeft: "auto" }}>
                    {user.status === "active" ? "Active" : "Locked"}
                  </span>
                </label>
              ))}
              {!paginatedUsers.length ? (
                <div style={{ padding: 24, textAlign: "center", color: "#71717a" }}>Không tìm thấy user phù hợp.</div>
              ) : null}
            </div>
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredUsers.length}
              itemLabel="user"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      <div className="cpanel-card" style={{ marginTop: 20 }}>
        <div className="cpanel-card-header" style={{ gap: 12, flexWrap: "wrap" }}>
          <h2>Lịch sử thông báo gần đây</h2>
          <div style={{ position: "relative", width: "min(360px, 100%)" }}>
            <input
              className="cpanel-input"
              value={notificationSearch}
              onChange={(event) => {
                setNotificationSearch(event.target.value);
                setNotificationPage(1);
              }}
              placeholder="Tìm người nhận, email, nội dung..."
              style={{ paddingLeft: 40 }}
            />
            <span style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </span>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          <div className="cpanel-table-container">
            <table className="cpanel-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Người nhận</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNotifications.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>
                      <strong>{item.user_name || `User #${item.user_id}`}</strong>
                      <div style={{ color: "#71717a", fontSize: 12 }}>{item.user_email || ""}</div>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <div style={{ color: "#71717a", fontSize: 13, marginTop: 4 }}>{item.message}</div>
                    </td>
                    <td>
                      <span className={`cpanel-status-pill ${item.read_at ? "green" : item.tone}`}>
                        {item.read_at ? "Đã đọc" : "Chưa đọc"}
                      </span>
                    </td>
                    <td style={{ color: "#71717a", fontSize: 13 }}>{item.created_at}</td>
                  </tr>
                ))}
                {!paginatedNotifications.length ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 28, color: "#71717a" }}>
                      {loading ? "Đang tải lịch sử..." : (notificationSearch ? "Không tìm thấy thông báo phù hợp." : "Chưa có thông báo nào.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={notificationPage}
            pageSize={notificationPageSize}
            total={filteredNotifications.length}
            itemLabel="thông báo"
            onPageChange={setNotificationPage}
            onPageSizeChange={setNotificationPageSize}
          />
        </div>
      </div>
    </div>
  );
}
