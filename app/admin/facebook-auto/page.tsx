"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../components";
import { AdminPagination, paginate } from "../admin-pagination";
import {
  deleteAdminFacebookAutoAccount,
  deleteAdminThreadsAutoAccount,
  fetchAdminFacebookAutoAccounts,
  fetchAdminFacebookAutoSettings,
  fetchAdminThreadsAutoAccounts,
  updateAdminFacebookAutoAccount,
  updateAdminFacebookAutoSettings,
  updateAdminThreadsAutoAccount,
  type AdminThreadsAutoAccount,
  type AdminFacebookAutoAccount
} from "../../lib/auth";
import { showConfirm, showError, showToast } from "../../lib/swal";

type SocialTab = "facebook" | "threads";
type AdminSocialAutoAccount = AdminFacebookAutoAccount | AdminThreadsAutoAccount;

function accountStatusTone(account: AdminSocialAutoAccount) {
  if (account.admin_disabled) return "gray";
  if (account.status === "active") return "green";
  if (account.status === "checkpoint") return "orange";
  if (account.status === "invalid") return "red";
  return "gray";
}

function accountStatusLabel(account: AdminSocialAutoAccount) {
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function accountSecondary(account: AdminSocialAutoAccount) {
  return ("facebookName" in account ? account.facebookName : account.threadsName) || account.cookiePreview;
}

export default function AdminFacebookAutoPage() {
  const [activeTab, setActiveTab] = useState<SocialTab>("facebook");
  const [accounts, setAccounts] = useState<AdminFacebookAutoAccount[]>([]);
  const [threadsAccounts, setThreadsAccounts] = useState<AdminThreadsAutoAccount[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [threadsAccountsLoading, setThreadsAccountsLoading] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [maxWorkers, setMaxWorkers] = useState(5);
  const [headlessChrome, setHeadlessChrome] = useState(true);
  const [lowResourceMode, setLowResourceMode] = useState(true);

  const loading = settingsLoading || accountsLoading || threadsAccountsLoading;

  function loadAccounts() {
    setAccountsLoading(true);
    fetchAdminFacebookAutoAccounts()
      .then(({ accounts: nextAccounts }) => setAccounts(nextAccounts))
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải tài khoản Auto Facebook."))
      .finally(() => setAccountsLoading(false));
  }

  function loadThreadsAccounts() {
    setThreadsAccountsLoading(true);
    fetchAdminThreadsAutoAccounts()
      .then(({ accounts: nextAccounts }) => {
        setThreadsAccounts(nextAccounts);
        setThreadsLoaded(true);
      })
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải tài khoản Auto Threads."))
      .finally(() => setThreadsAccountsLoading(false));
  }

  useEffect(() => {
    let mounted = true;
    setSettingsLoading(true);
    setAccountsLoading(true);

    Promise.allSettled([fetchAdminFacebookAutoSettings(), fetchAdminFacebookAutoAccounts()]).then(([settingsResult, accountsResult]) => {
      if (!mounted) return;

      if (settingsResult.status === "fulfilled") {
        setMaxWorkers(settingsResult.value.max_workers);
        setHeadlessChrome(settingsResult.value.headless_chrome);
        setLowResourceMode(settingsResult.value.low_resource_mode);
      } else {
        showError(settingsResult.reason instanceof Error ? settingsResult.reason.message : "Không thể tải cấu hình.");
      }

      if (accountsResult.status === "fulfilled") {
        setAccounts(accountsResult.value.accounts);
      } else {
        showError(accountsResult.reason instanceof Error ? accountsResult.reason.message : "Không thể tải tài khoản Auto Facebook.");
      }

      setSettingsLoading(false);
      setAccountsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const currentAccounts: AdminSocialAutoAccount[] = activeTab === "facebook" ? accounts : threadsAccounts;
  const currentLoading = activeTab === "facebook" ? accountsLoading : threadsAccountsLoading;

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return currentAccounts;
    return currentAccounts.filter((account) =>
      [
        account.name,
        account.userId,
        "facebookName" in account ? account.facebookName : account.threadsName,
        account.owner_name,
        account.owner_email,
        account.status,
        account.job_status,
        account.admin_disabled ? "da tat" : ""
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [currentAccounts, search]);

  const paginatedAccounts = paginate(filteredAccounts, page, pageSize);
  const activeCount = currentAccounts.filter((account) => account.status === "active" && !account.admin_disabled).length;
  const disabledCount = currentAccounts.filter((account) => account.admin_disabled).length;
  const runningCount = currentAccounts.filter((account) => account.job_status === "running").length;

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const settings = await updateAdminFacebookAutoSettings({ max_workers: maxWorkers, headless_chrome: headlessChrome, low_resource_mode: lowResourceMode });
      setMaxWorkers(settings.max_workers);
      setHeadlessChrome(settings.headless_chrome);
      setLowResourceMode(settings.low_resource_mode);
      showToast("Đã cập nhật Auto Facebook/Threads.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(account: AdminSocialAutoAccount) {
    setBusyId(account.id);
    try {
      if (activeTab === "facebook") {
        await updateAdminFacebookAutoAccount(account.id, { admin_disabled: !account.admin_disabled });
      } else {
        await updateAdminThreadsAutoAccount(account.id, { admin_disabled: !account.admin_disabled });
      }
      showToast(account.admin_disabled ? "Đã bật tài khoản." : "Đã tắt tài khoản.");
      if (activeTab === "facebook") loadAccounts();
      else loadThreadsAccounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật tài khoản.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAccount(account: AdminSocialAutoAccount) {
    if (!(await showConfirm(`Xoá tài khoản Auto ${activeTab === "facebook" ? "Facebook" : "Threads"} "${account.name}"?`))) return;
    setBusyId(account.id);
    try {
      if (activeTab === "facebook") {
        await deleteAdminFacebookAutoAccount(account.id);
      } else {
        await deleteAdminThreadsAutoAccount(account.id);
      }
      showToast(`Đã xoá tài khoản Auto ${activeTab === "facebook" ? "Facebook" : "Threads"}.`);
      if (activeTab === "facebook") loadAccounts();
      else loadThreadsAccounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá tài khoản.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !accounts.length && !threadsAccounts.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải Auto Social...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Auto Social</h1>
          <p>Quản lý cấu hình worker và danh sách tài khoản Facebook/Threads trên cùng một trang.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={activeTab === "facebook" ? loadAccounts : loadThreadsAccounts} disabled={currentLoading} type="button">
          <Icon name="update" size={16} /> Làm mới tài khoản
        </button>
      </div>

      <div className="admin-summary-strip">
        <span>Tổng: <strong>{currentAccounts.length}</strong></span>
        <span>Đang hoạt động: <strong>{activeCount}</strong></span>
        <span>Đã tắt: <strong>{disabledCount}</strong></span>
        <span>Đang chạy: <strong>{runningCount}</strong></span>
      </div>

      <div style={{ display: "inline-flex", gap: 6, padding: 4, border: "1px solid #e4e4e7", borderRadius: 10, background: "#fff", marginBottom: 20 }}>
        {(["facebook", "threads"] as SocialTab[]).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "cpanel-btn cpanel-btn-red" : "cpanel-btn cpanel-btn-secondary"}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
              setSearch("");
              if (tab === "threads" && !threadsLoaded && !threadsAccountsLoading) {
                loadThreadsAccounts();
              }
            }}
          >
            {tab === "facebook" ? "Facebook" : "Threads"}
          </button>
        ))}
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2>Cấu hình hệ thống</h2>
            <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 13 }}>Thiết lập số luồng tối đa và chế độ chạy Chrome.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`cpanel-status-pill ${headlessChrome ? "green" : "gray"}`}>
              {headlessChrome ? "Headless bật" : "Headless tắt"}
            </span>
            <span className={`cpanel-status-pill ${lowResourceMode ? "orange" : "gray"}`}>
              {lowResourceMode ? "Máy yếu bật" : "Máy yếu tắt"}
            </span>
          </div>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={saveSettings} style={{ display: "grid", gap: 16 }}>
            <div className="grid-2">
              <div className="cpanel-field">
                <label htmlFor="max-workers">Số luồng tối đa toàn hệ thống</label>
                <input
                  id="max-workers"
                  className="cpanel-input"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={maxWorkers}
                  onChange={(event) => setMaxWorkers(Number(event.target.value))}
                  disabled={saving}
                />
                <p style={{ color: "#71717a", fontSize: 12, margin: "6px 0 0" }}>
                  Tài khoản vượt giới hạn sẽ vào hàng đợi.
                </p>
              </div>

              <div className="cpanel-field">
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>Headless Chrome</span>
                  <input
                    type="checkbox"
                    checked={headlessChrome}
                    onChange={(event) => setHeadlessChrome(event.target.checked)}
                    disabled={saving}
                  />
                </label>
                <p style={{ color: "#71717a", fontSize: 12, margin: "6px 0 0" }}>
                  Bật để chạy ẩn trình duyệt, tắt để mở Chrome hiển thị khi bot hoạt động.
                </p>
              </div>

              <div className="cpanel-field">
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>Máy yếu - giảm tải Chrome</span>
                  <input
                    type="checkbox"
                    checked={lowResourceMode}
                    onChange={(event) => setLowResourceMode(event.target.checked)}
                    disabled={saving}
                  />
                </label>
                <p style={{ color: "#71717a", fontSize: 12, margin: "6px 0 0" }}>
                  Bật để tắt tải ảnh và giảm dịch vụ nền của Chrome khi check live hoặc chạy bot.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button className="cpanel-btn cpanel-btn-red" type="submit" disabled={saving || maxWorkers < 1 || maxWorkers > 100}>
                <Icon name="toggle_on" size={16} /> {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="cpanel-card" style={{ marginTop: 20 }}>
        <div className="cpanel-card-header" style={{ display: "block" }}>
          <div style={{ position: "relative", maxWidth: 420 }}>
            <input
              className="cpanel-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên, userId, chủ sở hữu, trạng thái..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {currentLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Đang tải tài khoản Auto {activeTab === "facebook" ? "Facebook" : "Threads"}...</div>
          ) : filteredAccounts.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Chủ sở hữu</th>
                    <th>Trạng thái</th>
                    <th>Tiến trình</th>
                    <th>Cập nhật</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{account.name || "Chưa có tên"}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{accountSecondary(account)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{account.owner_name || `User #${account.owner_id}`}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{account.owner_email || "-"}</div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                          <span className={`cpanel-status-pill ${accountStatusTone(account)}`}>{accountStatusLabel(account)}</span>
                          <span className={`cpanel-status-pill ${jobStatusTone(account.job_status)}`}>{jobStatusLabel(account.job_status)}</span>
                        </div>
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <div className="between" style={{ marginBottom: 8, gap: 12 }}>
                          <strong>{account.job_progress || 0}%</strong>
                          <span style={{ color: "#71717a", fontSize: 12 }}>{account.job_completed || 0}/{account.job_total || 0}</span>
                        </div>
                        <div style={{ height: 9, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, account.job_progress || 0))}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: "linear-gradient(90deg, #ef4444, #f87171)"
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: "#71717a" }}>{formatDate(account.updatedAt || account.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {activeTab === "facebook" ? (
                            <Link href={`/admin/facebook-auto-accounts/${encodeURIComponent(account.id)}`} className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }}>
                              Chi tiết
                            </Link>
                          ) : null}
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => toggleAccount(account)} disabled={busyId === account.id}>
                            {account.admin_disabled ? "Bật" : "Tắt"}
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => deleteAccount(account)} disabled={busyId === account.id}>
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Không có tài khoản Auto {activeTab === "facebook" ? "Facebook" : "Threads"} phù hợp.</div>
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
    </div>
  );
}
