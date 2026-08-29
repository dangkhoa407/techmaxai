"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminLogs } from "../../lib/auth";
import { Icon } from "../../components";
import { AdminPagination, paginate } from "../admin-pagination";

type AdminActivityLog = {
  id: number;
  subject: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  tone: string;
  ip_address: string | null;
  device_name: string | null;
  user_name: string | null;
  created_at: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = () => {
    setLoading(true);
    fetchAdminLogs()
      .then((data) => {
        setLogs(data as any);
      })
      .catch((err) => {
        setError(err.message || "Không thể tải nhật ký hoạt động.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      l.subject.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.user_name && l.user_name.toLowerCase().includes(q)) ||
      l.detail.toLowerCase().includes(q)
    );
  });
  const paginatedLogs = paginate(filteredLogs, page, pageSize);

  if (loading && !logs.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải nhật ký hệ thống...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Nhật ký hoạt động hệ thống</h1>
          <p>Danh sách các thao tác và sự kiện quan trọng trong hệ thống.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadLogs} disabled={loading}>
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      {error && (
        <div className="cpanel-card" style={{ padding: 24, borderColor: "#fecaca", backgroundColor: "#fef2f2", marginBottom: 20 }}>
          <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>Lỗi: {error}</p>
        </div>
      )}

      {/* Logs Card */}
      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "block" }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              type="text"
              className="cpanel-input"
              placeholder="Lọc nhật ký hoạt động..."
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
                    <th>IP / Thiết bị</th>
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
                      <td style={{ fontSize: 13, color: "#52525b", maxWidth: 450, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {l.detail}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{l.ip_address || "Unknown IP"}</div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{l.device_name || "Unknown device"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>
              Không tìm thấy nhật ký hoạt động nào phù hợp.
            </div>
          )}
          {filteredLogs.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredLogs.length}
              itemLabel="nhật ký"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
