"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAdminAi, fetchAdminDashboard, formatVnd } from "../lib/auth";
import { Icon } from "../components";
import Link from "next/link";
import { AdminPagination, paginate } from "./admin-pagination";

type AdminStats = {
  total_users: number;
  total_invoices: number;
  total_tickets: number;
  processed_tickets: number;
  pending_tickets: number;
  total_ai_bots: number;
  total_zalo: number;
  active_zalo: number;
  total_fanpages: number;
  conversations_today: number;
  total_money: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_this_year: number;
  revenue_last_year: number;
};

type AdminChartPoint = {
  label: string;
  value: number;
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeRevenueChart(data: AdminChartPoint[] = []) {
  const byLabel = new Map(data.map((item) => [item.label, Number(item.value || 0)]));
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const label = `${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
    return { label, value: byLabel.get(label) || 0 };
  });
}

function normalizeMessageChart(data: AdminChartPoint[] = []) {
  const byLabel = new Map(data.map((item) => [item.label, Number(item.value || 0)]));
  const now = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + index);
    const label = `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}`;
    return { label, value: byLabel.get(label) || 0 };
  });
}

type AdminRecentUser = {
  id: number;
  fullname: string;
  email: string;
  money: number;
  level: string;
  status: string;
  created_at: string;
};

type AdminRecentTicket = {
  id: number;
  subject: string;
  priority: string;
  status: string;
  user_name: string;
  created_at: string;
};

type AdminRecentLog = {
  id: number;
  subject: string;
  action: string;
  detail: string;
  tone: string;
  user_name: string;
  created_at: string;
};

function AdminMetricCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "blue" | "green" | "orange" | "red" | "gray";
}) {
  const colors = {
    blue: ["#eff6ff", "#1d4ed8"],
    green: ["#ecfdf5", "#047857"],
    orange: ["#fff7ed", "#c2410c"],
    red: ["#fef2f2", "#b91c1c"],
    gray: ["#f4f4f5", "#52525b"],
  } as const;
  const [backgroundColor, color] = colors[tone];
  const displayValue = value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))
    ? 0
    : value;

  return (
    <div className="cpanel-stat-card">
      <div>
        <div className="cpanel-stat-value">{displayValue}</div>
        <div className="cpanel-stat-label">{label}</div>
      </div>
      <div style={{ padding: 10, borderRadius: 8, backgroundColor, color, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={24} />
      </div>
    </div>
  );
}

function AdminBarChart({
  title,
  subtitle,
  data,
  formatValue,
  tone = "red",
}: {
  title: string;
  subtitle: string;
  data: AdminChartPoint[];
  formatValue: (value: number) => string;
  tone?: "red" | "blue" | "green";
}) {
  const maxValue = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  const barColor = tone === "blue" ? "#2563eb" : tone === "green" ? "#059669" : "#ef4444";

  return (
    <div className="cpanel-card">
      <div className="cpanel-card-header" style={{ display: "block" }}>
        <h2>{title}</h2>
        <p style={{ margin: "4px 0 0", color: "#71717a", fontSize: 13 }}>{subtitle}</p>
      </div>
      <div className="cpanel-card-body">
        {data.length ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(36px, 1fr))`, gap: 10, alignItems: "end", minHeight: 240 }}>
            {data.map((item) => {
              const value = Number(item.value || 0);
              const height = value > 0 ? Math.max(10, (value / maxValue) * 180) : 0;
              return (
                <div key={item.label} style={{ display: "grid", gap: 8, alignItems: "end", minWidth: 0 }}>
                  <div title={`${item.label}: ${formatValue(item.value)}`} style={{ display: "grid", alignItems: "end", height: 190 }}>
                    <div
                      style={{
                        height,
                        borderRadius: "8px 8px 4px 4px",
                        background: `linear-gradient(180deg, ${barColor}, ${barColor}99)`,
                        boxShadow: `0 10px 24px ${barColor}22`,
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: 11, color: "#52525b", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.label}
                  </strong>
                  <span style={{ fontSize: 11, color: "#71717a", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formatValue(item.value)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Chưa có dữ liệu biểu đồ.</div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    stats: AdminStats;
    charts?: {
      revenue: AdminChartPoint[];
      messages: AdminChartPoint[];
    };
    recent_users: AdminRecentUser[];
    recent_tickets: AdminRecentTicket[];
    recent_logs: AdminRecentLog[];
  } | null>(null);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState(5);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(5);
  const [logSearch, setLogSearch] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchAdminDashboard(), fetchAdminAi()])
      .then(([res, ai]) => {
        const dashboard = res as any;
        setData({
          ...dashboard,
          stats: {
            ...dashboard.stats,
            total_ai_bots: ai.selected_models.length,
          },
        });
      })
      .catch((err) => {
        setError(err.message || "Không thể tải dữ liệu.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const recentTickets = data?.recent_tickets ?? [];
  const recentUsers = data?.recent_users ?? [];
  const recentLogs = data?.recent_logs ?? [];
  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return recentTickets;
    return recentTickets.filter((ticket) =>
      `${ticket.subject} ${ticket.user_name} ${ticket.priority} ${ticket.status}`.toLowerCase().includes(q)
    );
  }, [recentTickets, ticketSearch]);
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return recentUsers;
    return recentUsers.filter((user) =>
      `${user.fullname} ${user.email} ${user.level} ${user.status}`.toLowerCase().includes(q)
    );
  }, [recentUsers, userSearch]);
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return recentLogs;
    return recentLogs.filter((log) =>
      `${log.created_at} ${log.user_name || ""} ${log.subject} ${log.action} ${log.detail}`.toLowerCase().includes(q)
    );
  }, [recentLogs, logSearch]);
  const paginatedTickets = paginate(filteredTickets, ticketPage, ticketPageSize);
  const paginatedUsers = paginate(filteredUsers, userPage, userPageSize);
  const paginatedLogs = paginate(filteredLogs, logPage, logPageSize);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải dữ liệu tổng quan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cpanel-card" style={{ padding: 24, borderColor: "#fecaca", backgroundColor: "#fef2f2" }}>
        <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>Lỗi: {error}</p>
      </div>
    );
  }

  const stats: AdminStats = data?.stats || {
    total_users: 0,
    total_invoices: 0,
    total_tickets: 0,
    processed_tickets: 0,
    pending_tickets: 0,
    total_ai_bots: 0,
    total_zalo: 0,
    active_zalo: 0,
    total_fanpages: 0,
    conversations_today: 0,
    total_money: 0,
    revenue_this_month: 0,
    revenue_last_month: 0,
    revenue_this_year: 0,
    revenue_last_year: 0,
  };

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Tổng quan Hệ thống</h1>
        <p>Thống kê thời gian thực và quản trị tài nguyên toàn website.</p>
      </div>

      {stats && (
        <>
          <div className="cpanel-stat-grid">
            <AdminMetricCard label="AI hiện có" value={stats.total_ai_bots ?? 0} icon="smart_toy" tone="blue" />
            <AdminMetricCard label="Doanh thu tháng này" value={formatVnd(stats.revenue_this_month ?? 0)} icon="payments" tone="green" />
            <AdminMetricCard label="Doanh thu tháng trước" value={formatVnd(stats.revenue_last_month ?? 0)} icon="history" tone="orange" />
            <AdminMetricCard label="Doanh thu năm nay" value={formatVnd(stats.revenue_this_year ?? 0)} icon="bar_chart" tone="green" />
            <AdminMetricCard label="Doanh thu năm trước" value={formatVnd(stats.revenue_last_year ?? 0)} icon="history" tone="gray" />
            <AdminMetricCard label="Tổng tài khoản Zalo" value={stats.total_zalo ?? 0} icon="account_circle" tone="blue" />
            <AdminMetricCard label="Tổng Fanpage" value={stats.total_fanpages ?? 0} icon="group_work" tone="blue" />
            <AdminMetricCard label="Cuộc hội thoại hôm nay" value={stats.conversations_today ?? 0} icon="message_circle" tone="orange" />
            <AdminMetricCard label="Tổng thành viên" value={stats.total_users ?? 0} icon="group" tone="blue" />
            <AdminMetricCard label="Ticket đã xử lý" value={stats.processed_tickets ?? 0} icon="check_circle" tone="green" />
            <AdminMetricCard label="Ticket chưa xử lý" value={stats.pending_tickets ?? 0} icon="support_agent" tone="red" />
            <AdminMetricCard label="Tổng hoá đơn" value={stats.total_invoices ?? 0} icon="receipt_long" tone="orange" />
          </div>

          <div className="cpanel-main-grid" style={{ marginTop: 24 }}>
            <AdminBarChart
              title="Biểu đồ doanh thu"
              subtitle="Doanh thu nạp tiền đã thanh toán trong 12 tháng gần nhất."
              data={normalizeRevenueChart(data?.charts?.revenue)}
              formatValue={formatVnd}
              tone="green"
            />
            <AdminBarChart
              title="Biểu đồ tin nhắn theo ngày"
              subtitle="Số tin nhắn ghi nhận trong 14 ngày gần nhất."
              data={normalizeMessageChart(data?.charts?.messages)}
              formatValue={(value) => Number(value || 0).toLocaleString("vi-VN")}
              tone="blue"
            />
          </div>
        </>
      )}

      {/* Stats Grid */}
      {false && stats && (
        <div className="cpanel-stat-grid">
          <div className="cpanel-stat-card">
            <div>
              <div className="cpanel-stat-value">{stats.total_users}</div>
              <div className="cpanel-stat-label">Tổng thành viên</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#eff6ff", color: "#1d4ed8", display: "grid", placeItems: "center" }}>
              <Icon name="group" size={24} />
            </div>
          </div>

          <div className="cpanel-stat-card">
            <div>
              <div className="cpanel-stat-value">{formatVnd(stats.total_money)}</div>
              <div className="cpanel-stat-label">Tổng số dư thành viên</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#ecfdf5", color: "#047857", display: "grid", placeItems: "center" }}>
              <Icon name="account_balance_wallet" size={24} />
            </div>
          </div>

          <div className="cpanel-stat-card">
            <div>
              <div className="cpanel-stat-value">{stats.total_invoices}</div>
              <div className="cpanel-stat-label">Tổng hóa đơn nạp</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#fff7ed", color: "#c2410c", display: "grid", placeItems: "center" }}>
              <Icon name="payments" size={24} />
            </div>
          </div>

          <div className="cpanel-stat-card">
            <div>
              <div className="cpanel-stat-value">{stats.total_tickets}</div>
              <div className="cpanel-stat-label">Tổng tickets hỗ trợ</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#fef2f2", color: "#b91c1c", display: "grid", placeItems: "center" }}>
              <Icon name="support_agent" size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="cpanel-main-grid admin-dashboard-list-grid">
        
        {/* Recent Tickets Card */}
        <div className="cpanel-card">
          <div className="cpanel-card-header">
            <h2>5 Tickets Hỗ trợ Gần nhất</h2>
            <Link href="/admin/tickets" className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }}>
              Xem tất cả
            </Link>
          </div>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e4e4e7" }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <input
                className="cpanel-input"
                value={ticketSearch}
                onChange={(event) => {
                  setTicketSearch(event.target.value);
                  setTicketPage(1);
                }}
                placeholder="Tìm ticket, khách hàng..."
                style={{ paddingLeft: 40 }}
              />
              <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
                <Icon name="search" size={18} />
              </div>
            </div>
          </div>
          <div className="cpanel-card-body" style={{ padding: 0 }}>
            {filteredTickets.length ? (
              <div className="cpanel-table-container">
                <table className="cpanel-table">
                  <thead>
                    <tr>
                      <th>Chủ đề</th>
                      <th>Người gửi</th>
                      <th>Độ ưu tiên</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTickets.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}>{t.subject}</td>
                        <td>{t.user_name || "Hệ thống"}</td>
                        <td>
                          <span className={`cpanel-status-pill ${t.priority === "high" ? "red" : t.priority === "medium" ? "orange" : "blue"}`}>
                            {t.priority === "high" ? "Cao" : t.priority === "medium" ? "Trung bình" : "Thấp"}
                          </span>
                        </td>
                        <td>
                          <span className={`cpanel-status-pill ${t.status === "resolved" ? "green" : t.status === "in_progress" ? "orange" : t.status === "closed" ? "red" : "blue"}`}>
                            {t.status === "resolved" ? "Đã giải quyết" : t.status === "in_progress" ? "Đang xử lý" : t.status === "closed" ? "Đóng" : "Mở"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#71717a" }}>Không có ticket nào.</div>
            )}
            {filteredTickets.length ? (
              <AdminPagination
                page={ticketPage}
                pageSize={ticketPageSize}
                total={filteredTickets.length}
                itemLabel="ticket"
                onPageChange={setTicketPage}
                onPageSizeChange={setTicketPageSize}
              />
            ) : null}
          </div>
        </div>

        {/* Recent Users Card */}
        <div className="cpanel-card">
          <div className="cpanel-card-header">
            <h2>Thành viên Mới đăng ký</h2>
            <Link href="/admin/users" className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }}>
              Xem tất cả
            </Link>
          </div>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e4e4e7" }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <input
                className="cpanel-input"
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setUserPage(1);
                }}
                placeholder="Tìm tên, email..."
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
                      <th>Tên</th>
                      <th>Email</th>
                      <th>Số dư</th>
                      <th>Quyền hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700 }}>{u.fullname}</td>
                        <td>{u.email}</td>
                        <td style={{ fontWeight: 700, color: "#047857" }}>{formatVnd(u.money)}</td>
                        <td>
                          <span className={`cpanel-status-pill ${u.level === "admin" ? "red" : "blue"}`}>
                            {u.level === "admin" ? "Admin" : "Thành viên"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#71717a" }}>Không có thành viên mới.</div>
            )}
            {filteredUsers.length ? (
              <AdminPagination
                page={userPage}
                pageSize={userPageSize}
                total={filteredUsers.length}
                itemLabel="thành viên"
                onPageChange={setUserPage}
                onPageSizeChange={setUserPageSize}
              />
            ) : null}
          </div>
        </div>

      </div>

      {/* Audit Logs Section */}
      <div className="cpanel-card" style={{ marginTop: 24 }}>
        <div className="cpanel-card-header">
          <h2>Nhật ký hoạt động hệ thống</h2>
          <Link href="/admin/logs" className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }}>
            Xem tất cả
          </Link>
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e4e4e7" }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              className="cpanel-input"
              value={logSearch}
              onChange={(event) => {
                setLogSearch(event.target.value);
                setLogPage(1);
              }}
              placeholder="Lọc nhật ký hoạt động..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredLogs.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Tài khoản</th>
                    <th>Chủ đề</th>
                    <th>Hành động</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontSize: 12, color: "#71717a" }}>{l.created_at}</td>
                      <td style={{ fontWeight: 700 }}>{l.user_name || "Khách"}</td>
                      <td style={{ color: "#27272a" }}>{l.subject}</td>
                      <td>
                        <span className={`cpanel-status-pill ${l.tone === "red" ? "red" : l.tone === "green" ? "green" : l.tone === "orange" ? "orange" : "blue"}`}>
                          {l.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#52525b", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "#71717a" }}>Không có hoạt động nào được ghi lại.</div>
          )}
          {filteredLogs.length ? (
            <AdminPagination
              page={logPage}
              pageSize={logPageSize}
              total={filteredLogs.length}
              itemLabel="nhật ký"
              onPageChange={setLogPage}
              onPageSizeChange={setLogPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
