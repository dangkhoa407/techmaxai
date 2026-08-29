"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminTickets, updateTicketStatus, type Ticket } from "../../lib/auth";
import { Icon } from "../../components";
import { showError } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

interface AdminTicket extends Ticket {
  user_name?: string;
  user_email?: string;
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadTickets = () => {
    setLoading(true);
    fetchAdminTickets()
      .then((data) => {
        setTickets(data);
      })
      .catch((err) => {
        setError(err.message || "Không thể tải danh sách ticket.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleStatusChange = async (ticketId: number, newStatus: any) => {
    setUpdatingId(ticketId);
    try {
      await updateTicketStatus(ticketId, newStatus);
      // Update list
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      await showError("Lỗi: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      t.subject.toLowerCase().includes(q) ||
      (t.user_name && t.user_name.toLowerCase().includes(q)) ||
      (t.user_email && t.user_email.toLowerCase().includes(q))
    );
  });
  const paginatedTickets = paginate(filteredTickets, page, pageSize);

  if (loading && !tickets.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải danh sách ticket...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Quản lý Tickets Hỗ trợ</h1>
          <p>Xem, phân loại và cập nhật trạng thái các yêu cầu trợ giúp từ thành viên.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadTickets} disabled={loading}>
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      {error && (
        <div className="cpanel-card" style={{ padding: 24, borderColor: "#fecaca", backgroundColor: "#fef2f2", marginBottom: 20 }}>
          <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>Lỗi: {error}</p>
        </div>
      )}

      <div className={`cpanel-tickets-layout ${selectedTicket ? "split" : ""}`}>
        {/* Ticket List Column */}
        <div className="cpanel-card">
          <div className="cpanel-card-header" style={{ display: "block" }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <input
                type="text"
                className="cpanel-input"
                placeholder="Tìm kiếm chủ đề, tên khách hàng..."
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
            {filteredTickets.length ? (
              <div className="cpanel-table-container">
                <table className="cpanel-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Chủ đề</th>
                      <th>Khách hàng</th>
                      <th>Ưu tiên</th>
                      <th>Trạng thái</th>
                      <th>Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTickets.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        style={{ cursor: "pointer", backgroundColor: selectedTicket?.id === t.id ? "#fafafa" : "transparent" }}
                      >
                        <td style={{ color: "#71717a", fontSize: 13 }}>#{t.id}</td>
                        <td style={{ fontWeight: 700 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {t.subject}
                            {t.attachments && t.attachments.length > 0 && (
                              <Icon name="attach_file" size={14} style={{ color: "#a1a1aa" }} />
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#71717a", fontWeight: 400, marginTop: 2 }}>{t.category || "Hỗ trợ chung"}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.user_name || "Hệ thống"}</div>
                          <div style={{ fontSize: 11, color: "#71717a" }}>{t.user_email}</div>
                        </td>
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
                        <td style={{ fontSize: 13, color: "#71717a" }}>{t.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>
                Không có ticket nào cần xử lý.
              </div>
            )}
            {filteredTickets.length ? (
              <AdminPagination
                page={page}
                pageSize={pageSize}
                total={filteredTickets.length}
                itemLabel="ticket"
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : null}
          </div>
        </div>

        {/* Ticket Details Inspector Column */}
        {selectedTicket && (
          <div className="cpanel-card" style={{ alignSelf: "start" }}>
            <div className="cpanel-card-header">
              <h2>Chi tiết Ticket #{selectedTicket.id}</h2>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#71717a" }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="cpanel-card-body">
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 4 }}>
                  Chủ đề ticket
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#09090b" }}>{selectedTicket.subject}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 4 }}>
                    Khách hàng
                  </span>
                  <strong style={{ display: "block", fontSize: 14 }}>{selectedTicket.user_name}</strong>
                  <span style={{ fontSize: 12, color: "#71717a" }}>{selectedTicket.user_email}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 4 }}>
                    Thời gian gửi
                  </span>
                  <span style={{ fontSize: 13, color: "#27272a" }}>{selectedTicket.created_at}</span>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 6 }}>
                  Trạng thái xử lý
                </span>
                <select
                  className="cpanel-select"
                  value={selectedTicket.status}
                  onChange={(ev) => handleStatusChange(selectedTicket.id, ev.target.value as any)}
                  disabled={updatingId === selectedTicket.id}
                  style={{ fontWeight: 700 }}
                >
                  <option value="open">Mở (Open)</option>
                  <option value="in_progress">Đang xử lý (In Progress)</option>
                  <option value="resolved">Đã giải quyết (Resolved)</option>
                  <option value="closed">Đóng (Closed)</option>
                </select>
              </div>

              <div style={{ height: 1, backgroundColor: "#e4e4e7", margin: "20px 0" }} />

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 8 }}>
                  Nội dung yêu cầu
                </span>
                <div style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  borderRadius: 8,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#18181b",
                  whiteSpace: "pre-wrap"
                }}>
                  {selectedTicket.body}
                </div>
              </div>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: 10 }}>
                    Tệp đính kèm ({selectedTicket.attachments.length}/5)
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                    {selectedTicket.attachments.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          border: "1px solid #e4e4e7",
                          borderRadius: 6,
                          overflow: "hidden",
                          aspectRatio: "1",
                          display: "block",
                          position: "relative"
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Attachment ${i + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
