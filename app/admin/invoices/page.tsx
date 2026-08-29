"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminInvoices, updateAdminInvoiceStatus, formatVnd, type AdminInvoice, type AdminInvoiceStats } from "../../lib/auth";
import { Icon } from "../../components";
import { showConfirm, showError } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [stats, setStats] = useState<AdminInvoiceStats | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadInvoices = () => {
    setLoading(true);
    fetchAdminInvoices()
      .then((data) => {
        setInvoices(data.invoices);
        setStats(data.stats);
      })
      .catch((err) => {
        setError(err.message || "Không thể tải danh sách hóa đơn.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleUpdateStatus = async (invoiceId: number, nextStatus: "paid" | "cancelled") => {
    const confirmMessage = nextStatus === "paid" 
      ? "Bạn có chắc chắn muốn duyệt hóa đơn này? Khách hàng sẽ được cộng tiền tự động." 
      : "Bạn có chắc chắn muốn hủy hóa đơn này?";
    
    if (!(await showConfirm(confirmMessage))) return;

    setUpdatingId(invoiceId);
    try {
      await updateAdminInvoiceStatus(invoiceId, nextStatus);
      loadInvoices();
    } catch (err: any) {
      await showError("Lỗi: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      (i.invoice_code && i.invoice_code.toLowerCase().includes(q)) ||
      (i.transfer_content && i.transfer_content.toLowerCase().includes(q)) ||
      (i.user_name && i.user_name.toLowerCase().includes(q)) ||
      (i.user_email && i.user_email.toLowerCase().includes(q))
    );

    const matchesStatus = statusFilter === "all" || i.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  const paginatedInvoices = paginate(filteredInvoices, page, pageSize);

  if (loading && !invoices.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải danh sách hóa đơn...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1>Quản lý Hóa đơn Nạp tiền</h1>
          <p>Duyệt, hủy và theo dõi lịch sử thanh toán hóa đơn của thành viên.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadInvoices} disabled={loading}>
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      {error && (
        <div className="cpanel-card" style={{ padding: 24, borderColor: "#fecaca", backgroundColor: "#fef2f2", marginBottom: 20 }}>
          <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>Lỗi: {error}</p>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="cpanel-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Revenue */}
          <div className="cpanel-stat-card" style={{ borderLeft: "4px solid #047857" }}>
            <div>
              <div className="cpanel-stat-value" style={{ color: "#047857" }}>{formatVnd(stats.total_revenue)}</div>
              <div className="cpanel-stat-label">Tổng doanh thu đã nạp</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#ecfdf5", color: "#047857", display: "grid", placeItems: "center" }}>
              <Icon name="payments" size={24} />
            </div>
          </div>

          {/* Total Invoices */}
          <div className="cpanel-stat-card" style={{ borderLeft: "4px solid #1d4ed8" }}>
            <div>
              <div className="cpanel-stat-value">{stats.total_count}</div>
              <div className="cpanel-stat-label">Tổng số hóa đơn</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#eff6ff", color: "#1d4ed8", display: "grid", placeItems: "center" }}>
              <Icon name="receipt" size={24} />
            </div>
          </div>

          {/* Pending Invoices */}
          <div className="cpanel-stat-card" style={{ borderLeft: "4px solid #c2410c" }}>
            <div>
              <div className="cpanel-stat-value" style={{ color: "#c2410c" }}>{stats.pending_count}</div>
              <div className="cpanel-stat-label">Đang xử lý (Chờ bank)</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#fff7ed", color: "#c2410c", display: "grid", placeItems: "center" }}>
              <Icon name="pending" size={24} />
            </div>
          </div>

          {/* Paid Invoices */}
          <div className="cpanel-stat-card" style={{ borderLeft: "4px solid #047857" }}>
            <div>
              <div className="cpanel-stat-value" style={{ color: "#047857" }}>{stats.paid_count}</div>
              <div className="cpanel-stat-label">Đã hoàn thành</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#ecfdf5", color: "#047857", display: "grid", placeItems: "center" }}>
              <Icon name="check_circle" size={24} />
            </div>
          </div>

          {/* Expired / Cancelled Invoices */}
          <div className="cpanel-stat-card" style={{ borderLeft: "4px solid #71717a" }}>
            <div>
              <div className="cpanel-stat-value" style={{ color: "#71717a", fontSize: 18, fontWeight: 900 }}>
                {stats.expired_count} <span style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 500 }}>Hết hạn</span> / {stats.cancelled_count} <span style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 500 }}>Hủy</span>
              </div>
              <div className="cpanel-stat-label">Hết hạn hoặc Bị hủy</div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, backgroundColor: "#f4f4f5", color: "#71717a", display: "grid", placeItems: "center" }}>
              <Icon name="cancel" size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Content Card */}
      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          {/* Search */}
          <div style={{ position: "relative", maxWidth: 360, width: "100%" }}>
            <input
              type="text"
              className="cpanel-input"
              placeholder="Tìm mã hóa đơn, nội dung, khách hàng..."
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

          {/* Filter Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#71717a" }}>Trạng thái:</span>
            <select
              className="cpanel-select"
              value={statusFilter}
              onChange={(ev) => {
                setStatusFilter(ev.target.value);
                setPage(1);
              }}
              style={{ height: 44, padding: "0 12px", borderRadius: 8, border: "1px solid #e4e4e7", minWidth: 160, fontWeight: 700 }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Đang xử lý (Pending)</option>
              <option value="paid">Đã hoàn thành (Paid)</option>
              <option value="expired">Đã hết hạn (Expired)</option>
              <option value="cancelled">Đã hủy bỏ (Cancelled)</option>
            </select>
          </div>
        </div>

        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredInvoices.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Khách hàng</th>
                    <th>Nội dung chuyển khoản</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th>Thời gian tạo / Hết hạn</th>
                    <th>Mã GD Bank / Chi tiết duyệt</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong style={{ fontSize: 13, color: "#09090b" }}>{i.invoice_code || "Chưa tạo"}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{i.user_name || "N/A"}</div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{i.user_email}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, padding: "4px 8px", backgroundColor: "#f4f4f5", borderRadius: 4, border: "1px solid #e4e4e7" }}>
                          {i.transfer_content}
                        </span>
                      </td>
                      <td style={{ fontWeight: 900, color: i.status === "paid" ? "#047857" : "#09090b" }}>
                        {formatVnd(i.amount)}
                      </td>
                      <td>
                        <span className={`cpanel-status-pill ${i.status === "paid" ? "green" : i.status === "pending" ? "orange" : i.status === "cancelled" ? "red" : "gray"}`}>
                          {i.status === "paid" ? "Hoàn thành" : i.status === "pending" ? "Chờ duyệt" : i.status === "cancelled" ? "Đã hủy" : "Hết hạn"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{i.created_at}</div>

                        {i.status === "paid" && i.paid_at && (
                          <div style={{ fontSize: 11, color: "#047857", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                            <Icon name="check" size={12} /> Nạp lúc: {i.paid_at}
                          </div>
                        )}
                      </td>
                      <td>
                        {i.paid_ref_no ? (
                          <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>
                            Ref: {i.paid_ref_no}
                          </div>
                        ) : i.status === "paid" ? (
                          <span style={{ fontSize: 11, color: "#71717a", fontStyle: "italic" }}>Duyệt thủ công</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#a1a1aa" }}>—</span>
                        )}
                        {i.payment_description && (
                          <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.payment_description}>
                            {i.payment_description}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {i.status === "pending" || i.status === "expired" ? (
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              onClick={() => handleUpdateStatus(i.id, "paid")}
                              disabled={updatingId === i.id}
                              className="cpanel-btn cpanel-btn-green"
                              style={{ height: 32, fontSize: 12, padding: "0 10px", backgroundColor: "#047857", color: "#ffffff" }}
                              title="Duyệt hóa đơn nạp tiền"
                            >
                              <Icon name="check" size={14} /> Duyệt
                            </button>
                            {i.status === "pending" && (
                              <button
                                onClick={() => handleUpdateStatus(i.id, "cancelled")}
                                disabled={updatingId === i.id}
                                className="cpanel-btn cpanel-btn-red"
                                style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#ef4444", borderColor: "#fecaca" }}
                                title="Hủy hóa đơn"
                              >
                                <Icon name="close" size={14} /> Hủy
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#a1a1aa" }}>Không có thao tác</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#71717a" }}>
              Không tìm thấy hóa đơn nào phù hợp.
            </div>
          )}
          {filteredInvoices.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredInvoices.length}
              itemLabel="hóa đơn"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
