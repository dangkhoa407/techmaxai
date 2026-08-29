"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import { fetchActivityLogs, type ActivityLog } from "../lib/auth";

const pageSize = 10;

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ today_actions: 0, system_errors: 0, response_time_ms: 42 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchActivityLogs(page, search, pageSize)
      .then((payload) => {
        if (cancelled) return;
        setLogs(payload.logs);
        setTotal(payload.total);
        setPageCount(payload.page_count);
        setStats(payload.stats || { today_actions: payload.total, system_errors: 0, response_time_ms: 42 });
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải nhật ký hoạt động.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search]);

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  return (
    <AppFrame active="/activity" title="Nhật ký hoạt động">
      <PageHeader
        title="Nhật ký hoạt động"
        desc="Theo dõi các sự kiện quan trọng liên quan đến tài khoản của bạn."
        action={<Link className="btn btn-red" href="/deposit">Xem trang nạp tiền</Link>}
      />

      <div className="stack">
        <form className="glass activity-search" onSubmit={submitSearch}>
          <div className="activity-search-input">
            <Icon name="search" size={20} />
            <input
              className="input"
              placeholder="Tìm theo mã hành động, loại đối tượng..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="btn btn-secondary" type="submit">
            <Icon name="filter_list" size={18} />
            Tìm kiếm
          </button>
        </form>

        <div className="card activity-table-card">
          <div className="table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hành động</th>
                  <th>Người thực hiện</th>
                  <th>Đối tượng</th>
                  <th>Chi tiết</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.id}-${log.time}`}>
                    <td>
                      <strong>{log.id}</strong>
                      <div className="muted">{log.subject}</div>
                    </td>
                    <td><span className={`status ${log.tone}`}>{log.action}</span></td>
                    <td>{log.actor}</td>
                    <td className="muted">{log.target}</td>
                    <td>{log.detail}</td>
                    <td className="muted">{log.time}</td>
                  </tr>
                ))}
                {!logs.length ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="activity-empty">
                        <strong>{loading ? "Đang tải nhật ký..." : error || "Chưa có nhật ký hoạt động"}</strong>
                        <p>{loading ? "Hệ thống đang lấy dữ liệu từ database." : "Các thao tác mới như đăng nhập, đổi mật khẩu, mua gói hoặc thêm Zalo sẽ xuất hiện tại đây."}</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="activity-pagination">
            <p>Hiển thị {from} - {to} trong số {total} kết quả</p>
            <div className="row">
              <button className="btn btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
                Trước
              </button>
              {[1, 2, 3].filter((item) => item <= pageCount).map((item) => (
                <button className={page === item ? "btn btn-red" : "btn btn-secondary"} disabled={loading} onClick={() => setPage(item)} type="button" key={item}>
                  {item}
                </button>
              ))}
              {pageCount > 4 ? <span className="muted">...</span> : null}
              {pageCount > 3 ? (
                <button className={page === pageCount ? "btn btn-red" : "btn btn-secondary"} disabled={loading} onClick={() => setPage(pageCount)} type="button">
                  {pageCount}
                </button>
              ) : null}
              <button className="btn btn-secondary" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">
                Sau
              </button>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <StatCard label="Hành động hôm nay" value={stats.today_actions.toLocaleString("vi-VN")} help="Ghi nhận trong database" icon="bolt" />
          <StatCard label="Lỗi hệ thống" value={String(stats.system_errors)} help="Mọi thứ đang ổn định" icon="check_circle" />
          <StatCard label="Thời gian phản hồi" value={`${stats.response_time_ms}ms`} help="Theo dõi API nội bộ" icon="timer" />
        </div>
      </div>
    </AppFrame>
  );
}
