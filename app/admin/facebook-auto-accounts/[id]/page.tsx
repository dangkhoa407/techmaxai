"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../../../components";
import {
  fetchAdminFacebookAutoAccount,
  updateAdminFacebookAutoAccount,
  deleteAdminFacebookAutoAccount,
  type AdminFacebookAutoAccount,
  type AdminFacebookAutoLog
} from "../../../lib/auth";
import { showConfirm, showError, showToast } from "../../../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function accountStatusTone(account: AdminFacebookAutoAccount) {
  if (account.admin_disabled) return "gray";
  if (account.status === "active") return "green";
  if (account.status === "checkpoint") return "orange";
  if (account.status === "invalid") return "red";
  return "gray";
}

function accountStatusLabel(account: AdminFacebookAutoAccount) {
  if (account.admin_disabled) return "Đã tắt";
  if (account.status === "active") return "Hoạt động";
  if (account.status === "checkpoint") return "Checkpoint";
  if (account.status === "invalid") return "Cookie lỗi";
  return "Không xác định";
}

function jobStatusTone(status?: string | null) {
  if (status === "running") return "green";
  if (status === "paused") return "orange";
  if (status === "completed") return "blue";
  if (status === "stopped") return "gray";
  return "gray";
}

function jobStatusLabel(status?: string | null) {
  if (status === "running") return "Đang chạy";
  if (status === "paused") return "Tạm dừng";
  if (status === "completed") return "Hoàn tất";
  if (status === "stopped") return "Đã dừng";
  return "Chưa có";
}

function logTone(level?: string) {
  if (level === "success") return "green";
  if (level === "warn") return "orange";
  if (level === "error") return "red";
  return "blue";
}

export default function AdminFacebookAutoAccountDetailPage({ params }: { params: { id: string } }) {
  const [account, setAccount] = useState<AdminFacebookAutoAccount | null>(null);
  const [logs, setLogs] = useState<AdminFacebookAutoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchAdminFacebookAutoAccount(params.id)
      .then((data) => {
        if (!mounted) return;
        setAccount(data.account);
        setLogs(data.logs);
      })
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải chi tiết tài khoản."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [params]);

  async function toggleAccount() {
    if (!account) return;
    setBusy(true);
    try {
      await updateAdminFacebookAutoAccount(account.id, { admin_disabled: !account.admin_disabled });
      showToast(account.admin_disabled ? "Đã bật tài khoản." : "Đã tắt tài khoản.");
      const data = await fetchAdminFacebookAutoAccount(account.id);
      setAccount(data.account);
      setLogs(data.logs);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!account) return;
    if (!(await showConfirm(`Xoá tài khoản Auto Facebook "${account.name}"?`))) return;
    setBusy(true);
    try {
      await deleteAdminFacebookAutoAccount(account.id);
      showToast("Đã xoá tài khoản Auto Facebook.");
      window.location.href = "/admin/facebook-auto";
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá tài khoản.");
      setBusy(false);
    }
  }

  if (loading && !account) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải chi tiết tài khoản...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Không tìm thấy tài khoản.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <Link href="/admin/facebook-auto" className="cpanel-btn cpanel-btn-secondary" style={{ textDecoration: "none" }}>
              <Icon name="arrow_back" size={16} /> Quay lại
            </Link>
            <span className={`cpanel-status-pill ${accountStatusTone(account)}`}>{accountStatusLabel(account)}</span>
            <span className={`cpanel-status-pill ${jobStatusTone(account.job_status)}`}>{jobStatusLabel(account.job_status)}</span>
          </div>
          <h1>Chi tiết tài khoản Auto Facebook</h1>
          <p>{account.name} · {account.facebookName || account.userId}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={toggleAccount} disabled={busy}>
            <Icon name={account.admin_disabled ? "play_arrow" : "pause"} size={16} /> {account.admin_disabled ? "Bật" : "Tắt"}
          </button>
          <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={deleteAccount} disabled={busy} style={{ color: "#dc2626" }}>
            <Icon name="delete" size={16} /> Xoá
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="cpanel-card" style={{ padding: 16 }}>
          <div style={{ color: "#71717a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Thông tin tài khoản</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <div className="between"><span>Chủ sở hữu</span><strong>{account.owner_name || `User #${account.owner_id}`}</strong></div>
            <div className="between"><span>Email</span><strong>{account.owner_email || "-"}</strong></div>
            <div className="between"><span>Facebook UID</span><strong>{account.userId}</strong></div>
            <div className="between"><span>Tên Facebook</span><strong>{account.facebookName || "-"}</strong></div>
            <div className="between"><span>Cookie preview</span><strong>{account.cookiePreview}</strong></div>
            <div className="between"><span>Thiết bị</span><strong>{account.deviceKeyHash || "-"}</strong></div>
            <div className="between"><span>Tạo lúc</span><strong>{formatDate(account.createdAt)}</strong></div>
            <div className="between"><span>Cập nhật</span><strong>{formatDate(account.updatedAt)}</strong></div>
          </div>
        </div>

        <div className="cpanel-card" style={{ padding: 16 }}>
          <div style={{ color: "#71717a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tiến trình chạy</div>
          <div style={{ marginTop: 12 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span style={{ color: "#52525b", fontWeight: 700 }}>Job progress</span>
              <strong>{Math.min(100, Math.max(0, account.job_progress || 0))}%</strong>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, account.job_progress || 0))}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #ef4444, #f87171)"
                }}
              />
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div className="between"><span>Hoàn thành</span><strong>{account.job_completed || 0}</strong></div>
              <div className="between"><span>Tổng tác vụ</span><strong>{account.job_total || 0}</strong></div>
              <div className="between"><span>Bắt đầu</span><strong>{formatDate(account.job_started_at)}</strong></div>
              <div className="between"><span>Cập nhật job</span><strong>{formatDate(account.job_updated_at)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="cpanel-card" style={{ padding: 16, marginTop: 16 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <strong>Log chi tiết</strong>
          <span className="cpanel-status-pill blue">{logs.length} log</span>
        </div>
        {logs.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ padding: 12, border: "1px solid #e4e4e7", borderRadius: 12, background: "#fafafa" }}>
                <div className="between" style={{ gap: 12, alignItems: "center" }}>
                  <strong>{log.account_user_id || "Hệ thống"}</strong>
                  <span className={`cpanel-status-pill ${logTone(log.level)}`}>{log.level}</span>
                </div>
                <p style={{ margin: "6px 0 0", color: "#52525b", fontSize: 13, lineHeight: 1.5 }}>{log.message}</p>
                <div style={{ marginTop: 8, color: "#71717a", fontSize: 12 }}>
                  {formatDate(log.created_at)} · {log.owner_name || `User #${log.owner_id}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#71717a", fontSize: 13 }}>Chưa có log cho tài khoản này.</div>
        )}
      </div>
    </div>
  );
}
