"use client";

import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  deleteZaloAccount,
  fetchAiBots,
  fetchUserProxies,
  fetchZaloAccounts,
  pollZaloQrLogin,
  reconnectZaloAccount,
  startZaloQrLogin,
  updateZaloAccountAiSettings,
  updateZaloAccountStatus,
  useAuthUser,
  type AiBot,
  type UserProxy,
  type ZaloAccount
} from "../lib/auth";
import { showConfirm, showError, showToast } from "../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function normalizeRealtimeText(value?: string | null, fallback = "Mất kết nối") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (lower.includes("mất kết nối") || lower.includes("mất kết nối")) return "Mất kết nối";
  if (lower.includes("tạm dừng") || lower.includes("tạm dừng")) return "Tạm dừng";
  if (lower.includes("kết nối") || lower.includes("kết nối")) return "Đang kết nối";
  if (text.includes("?")) return fallback;
  return text;
}

function normalizeZaloQrStatus(value?: string | null, fallback = "Quét mã QR bằng ứng dụng Zalo trên điện thoại.") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();

  if (
    lower.includes("m? zalo") ||
    lower.includes("di?n tho?i") ||
    lower.includes("đang ch?") ||
    lower.includes("dang ch?") ||
    lower.includes("?ng d?ng zalo") ||
    lower.includes("d? đăng nhập") ||
    lower.includes("d? dang nh?p") ||
    lower.includes("mã qr zalo. m?")
  ) {
    if (lower.includes("đang ch?") || lower.includes("dang ch?") || lower.includes("?ng d?ng zalo")) {
      return "Đang chờ bạn quét và xác nhận đăng nhập trên ứng dụng Zalo.";
    }
    return "Đã tạo mã QR Zalo. Mở Zalo trên điện thoại và quét mã để đăng nhập.";
  }

  if (lower.includes("không th?") || lower.includes("khong th?")) {
    return fallback;
  }

  return text;
}

function zaloRealtimeBadge(account: ZaloAccount) {
  if (account.status !== "active") {
    return { className: "red", text: "Tạm dừng" };
  }
  if (account.runtime_online) {
    return {
      className: account.realtime_status === "connecting" ? "orange" : "green",
      text: account.realtime_status === "connecting" ? "Đang kết nối" : normalizeRealtimeText(account.realtime_status_text, "Online")
    };
  }
  return { className: "orange", text: normalizeRealtimeText(account.realtime_status_text, "Mất kết nối") };
}

export default function ZaloAccountsPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [accounts, setAccounts] = useState<ZaloAccount[]>([]);
  const [bots, setBots] = useState<AiBot[]>([]);
  const [proxies, setProxies] = useState<UserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [proxy, setProxy] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [qrSession, setQrSession] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [creatingQr, setCreatingQr] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingAiId, setUpdatingAiId] = useState<number | null>(null);
  const [reconnectingId, setReconnectingId] = useState<number | null>(null);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return accounts;

    return accounts.filter((account) =>
      [account.own_id, account.phone_number, account.display_name, account.proxy]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [accounts, search]);

  const activeCount = accounts.filter((account) => account.status === "active").length;
  const runtimeOnlineCount = accounts.filter((account) => account.runtime_online).length;
  const canCreateQr = Boolean(user?.plan_active);
  const qrDisabled = creatingQr || authLoading || !canCreateQr;

  function requireActivePlan() {
    if (canCreateQr) return true;
    showError("Bạn cần mua gói dịch vụ hoặc gia hạn gói đang hết hạn trước khi thêm tài khoản Zalo.", "Cần mua gói");
    return false;
  }

  async function loadAccounts() {
    setLoading(true);
    try {
      const [data, botData, proxyData] = await Promise.all([fetchZaloAccounts(), fetchAiBots(), fetchUserProxies()]);
      setAccounts(data);
      setBots((botData.bots || []).filter((bot: AiBot) => bot.status === "active"));
      setProxies(proxyData.filter((item) => item.status === "active"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải tài khoản Zalo.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRealtimeAccounts() {
    try {
      setAccounts(await fetchZaloAccounts());
    } catch {
      // Keep realtime polling quiet so it does not interrupt the operator.
    }
  }

  function handleOpenQrModal() {
    if (!requireActivePlan()) return;
    setQrImage("");
    setQrSession("");
    setQrStatus("");
    setQrOpen(true);
  }

  function handleCloseQrModal() {
    setQrOpen(false);
    setQrImage("");
    setQrSession("");
    setQrStatus("");
  }

  async function handleCreateQr() {
    if (!requireActivePlan()) return;
    setQrOpen(true);
    setCreatingQr(true);
    setQrStatus("Đang tạo mã QR...");

    try {
      const payload = await startZaloQrLogin(proxy);
      setQrImage(payload.qr_image || "");
      setQrSession(payload.session_token || "");
      setQrStatus(normalizeZaloQrStatus(payload.message, "Quét mã QR bằng ứng dụng Zalo trên điện thoại."));
      setQrOpen(true);
    } catch (error) {
      const message = normalizeZaloQrStatus(error instanceof Error ? error.message : "", "Không thể tạo mã QR Zalo.");
      setQrStatus(message);
      showError(message);
    } finally {
      setCreatingQr(false);
    }
  }

  async function handleDeleteAccount(id: number) {
    if (!(await showConfirm("Xóa tài khoản Zalo này khỏi hệ thống?"))) return;

    try {
      const nextAccounts = await deleteZaloAccount(id);
      setAccounts(nextAccounts);
      showToast("Đã xóa tài khoản Zalo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa tài khoản Zalo.");
    }
  }

  async function handleToggleAccount(account: ZaloAccount) {
    const nextStatus = account.status === "active" ? "inactive" : "active";
    setUpdatingId(account.id);
    try {
      const nextAccounts = await updateZaloAccountStatus(account.id, nextStatus);
      setAccounts(nextAccounts);
      showToast(nextStatus === "active" ? "Đã bật tài khoản Zalo." : "Đã tắt tài khoản Zalo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật trạng thái tài khoản Zalo.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReconnectAccount(account: ZaloAccount) {
    setReconnectingId(account.id);
    setQrStatus("Đang kết nối lại tài khoản Zalo...");
    try {
      const payload = await reconnectZaloAccount(account.id);
      setAccounts(payload.accounts || []);
      if (payload.requires_qr) {
        setQrImage(payload.qr_image || "");
        setQrSession(payload.session_token || "");
        setQrStatus(normalizeZaloQrStatus(payload.message, "Vui lòng quét QR để đăng nhập lại Zalo."));
        setQrOpen(true);
        showToast("Cookie cũ không kết nối được, vui lòng quét QR.");
      } else {
        showToast(payload.message || "Đã kết nối lại tài khoản Zalo.");
      }
    } catch (error) {
      setQrStatus("");
      showError(error instanceof Error ? error.message : "Không thể kết nối lại tài khoản Zalo.");
    } finally {
      setReconnectingId(null);
    }
  }

  async function handleUpdateAiSettings(account: ZaloAccount, aiEnabled: boolean, aiBotId = account.ai_bot_id) {
    setUpdatingAiId(account.id);
    try {
      const nextAccounts = await updateZaloAccountAiSettings(account.id, { aiEnabled, aiBotId });
      setAccounts(nextAccounts);
      showToast("Đã cập nhật AI tự động cho tài khoản Zalo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật AI tự động.");
    } finally {
      setUpdatingAiId(null);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const interval = window.setInterval(refreshRealtimeAccounts, 5000);
    return () => window.clearInterval(interval);
  }, [authLoading]);

  useEffect(() => {
    if (!qrOpen || !qrSession) return;

    const interval = window.setInterval(async () => {
      try {
        const payload = await pollZaloQrLogin(qrSession);
        setQrStatus(normalizeZaloQrStatus(payload.message, "Đang chờ xác nhận đăng nhập..."));

        if (payload.status === "success") {
          setAccounts(payload.accounts || []);
          showToast("Đã thêm tài khoản Zalo thành công.");
          setQrOpen(false);
          setQrImage("");
          setQrSession("");
        }

        if (payload.status === "expired" || payload.status === "failed") {
          setQrStatus(normalizeZaloQrStatus(payload.message, "Mã QR đã hết hạn."));
        }
      } catch (error) {
        setQrStatus(normalizeZaloQrStatus(error instanceof Error ? error.message : "", "Không thể kiểm tra trạng thái QR."));
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [qrOpen, qrSession]);

  return (
    <AppFrame active="/zalo-accounts" title="Zalo Management">
      <PageHeader
        title="Tài khoản Zalo"
        desc="Thêm tài khoản Zalo bằng mã QR, theo dõi trạng thái kết nối và quản lý phiên đăng nhập."
        action={
          <button className="btn btn-red" disabled={authLoading || !canCreateQr} onClick={handleOpenQrModal} title={!canCreateQr ? "Cần mua/gia hạn gói trước khi thêm Zalo" : undefined} type="button">
            <Icon name="qr_code_scanner" /> Thêm bằng QR
          </button>
        }
      />

      {/* Banners removed per toast request */}

      <div className="stack">
        <section className="grid-4">
          <StatCard label="Tổng tài khoản" value={String(accounts.length)} help="Tất cả tài khoản đã thêm" icon="person_book" />
          <StatCard label="Đang hoạt động" value={String(activeCount)} help="Có thể chạy chiến dịch" icon="toggle_on" />
          <StatCard label="Tạm dừng" value={String(accounts.length - activeCount)} help="Tài khoản tắt hoặc lỗi" icon="person_off" />
          <StatCard label="Phiên kết nối" value={String(runtimeOnlineCount)} help="Phiên Zalo đang online" icon="timer" />
        </section>

        <section className="card">
          <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ margin: 0 }}>Danh sách tài khoản Zalo</h2>
              <p className="subtitle">Dữ liệu được lưu theo tài khoản TechMax của bạn sau khi quét QR thành công.</p>
            </div>
            <div className="row">
              <input className="input" placeholder="Tìm theo tên, SĐT, ownId" style={{ width: 260 }} value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="btn btn-secondary" disabled={authLoading || !canCreateQr} onClick={handleOpenQrModal} title={!canCreateQr ? "Cần mua/gia hạn gói trước khi thêm Zalo" : undefined} type="button">
                <Icon name="add" size={18} /> Thêm tài khoản
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="timer" size={54} />
              <p className="subtitle">Đang tải tài khoản Zalo...</p>
            </div>
          ) : filteredAccounts.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Own ID</th>
                    <th>Số điện thoại</th>
                    <th>Proxy</th>
                    <th>Trạng thái</th>
                    <th>Bot AI</th>
                    <th>Lần cuối online</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const selectedBot = bots.find((bot) => bot.id === account.ai_bot_id);
                    const aiStatusClass = account.ai_enabled ? "green" : account.ai_bot_id ? "orange" : "red";
                    const aiStatusText = account.ai_enabled ? "AI đang bật" : account.ai_bot_id ? "AI đang tắt" : "Chưa chọn bot";
                    const realtimeStatus = zaloRealtimeBadge(account);
                    const canReconnect = account.status === "active" && !account.runtime_online;
                    return (
                      <tr key={account.id}>
                        <td>
                          <strong>{account.display_name || "Zalo Account"}</strong>
                          <p className="muted" style={{ margin: "4px 0 0" }}>Kết nối: {formatDate(account.connected_at)}</p>
                        </td>
                        <td>{account.own_id}</td>
                        <td>{account.phone_number || "N/A"}</td>
                        <td>{account.proxy || "Không dùng"}</td>
                        <td><span className={`status ${realtimeStatus.className}`}>{realtimeStatus.text}</span></td>
                        <td>
                          <div className="zalo-ai-settings">
                            <div className="zalo-ai-status">
                              <span className={`status ${aiStatusClass}`}>{aiStatusText}</span>
                              <small>{selectedBot?.full_name || "Chưa gắn bot AI"}</small>
                            </div>
                            <select
                              className="input"
                              disabled={updatingAiId === account.id || !bots.length}
                              value={account.ai_bot_id || ""}
                              onChange={(event) => handleUpdateAiSettings(account, account.ai_enabled, event.target.value ? Number(event.target.value) : null)}
                            >
                              <option value="">Chọn bot</option>
                              {bots.map((bot) => (
                                <option key={bot.id} value={bot.id}>{bot.full_name}</option>
                              ))}
                            </select>
                            <button
                              className={account.ai_enabled ? "btn btn-primary" : "btn btn-secondary"}
                              disabled={updatingAiId === account.id || (!account.ai_enabled && !account.ai_bot_id)}
                              onClick={() => handleUpdateAiSettings(account, !account.ai_enabled)}
                              type="button"
                            >
                              <Icon name="smart_toy" size={16} />
                              {account.ai_enabled ? "AI bật" : "Bật AI"}
                            </button>
                          </div>
                        </td>
                        <td>{formatDate(account.last_seen_at)}</td>
                        <td>
                          <div className="zalo-account-actions">
                            {canReconnect ? (
                              <button className="btn btn-secondary" disabled={reconnectingId === account.id} onClick={() => handleReconnectAccount(account)} type="button">
                                <Icon name="refresh_cw" size={16} />
                                {reconnectingId === account.id ? "Đang nối..." : "Kết nối lại"}
                              </button>
                            ) : null}
                            <button className="btn btn-secondary" disabled={updatingId === account.id} onClick={() => handleToggleAccount(account)} type="button">
                              <Icon name={account.status === "active" ? "toggle_off" : "toggle_on"} size={16} />
                              {account.status === "active" ? "Tắt" : "Bật"}
                            </button>
                            <button className="btn btn-secondary" disabled={updatingId === account.id} onClick={() => handleDeleteAccount(account.id)} type="button">
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="person_off" size={54} />
              <p className="subtitle">Chưa có tài khoản Zalo nào. Hãy tạo mã QR và quét bằng ứng dụng Zalo.</p>
              <button className="btn btn-red" disabled={authLoading || !canCreateQr} onClick={handleOpenQrModal} title={!canCreateQr ? "Cần mua/gia hạn gói trước khi thêm Zalo" : undefined} type="button">
                <Icon name="qr_code_scanner" /> Tạo mã QR
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="row"><Icon name="menu_book" /> Hướng dẫn sử dụng</h2>
          <div className="grid-3">
            {[
              ["qr_code_scanner", "Thêm tài khoản bằng QR", "Nhấn Thêm bằng QR, mở ứng dụng Zalo trên điện thoại rồi quét mã QR hiện ra."],
              ["timer", "QR có thời hạn", "Nếu mã hết hạn, hãy tạo mã QR mới để đăng nhập lại."],
              ["lock", "Tuân thủ chính sách", "Chỉ kết nối tài khoản Zalo bạn có quyền sử dụng và tuân thủ điều khoản nền tảng."]
            ].map(([icon, title, text]) => (
              <div className="card pad" key={title}>
                <Icon name={icon} />
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {qrOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={handleCloseQrModal}>
          <div className="confirm-modal confirm-modal-dark qr-login-modal" role="dialog" aria-modal="true" aria-labelledby="zalo-qr-title" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <span className="eyebrow">Đăng nhập Zalo</span>
                <h2 id="zalo-qr-title">{qrImage ? "Quét mã QR" : "Chọn proxy đăng nhập"}</h2>
                <p className="subtitle">Chọn proxy trước khi tạo mã QR để phiên đăng nhập Zalo đi qua proxy đó.</p>
              </div>
              <button className="btn btn-secondary icon-top-button" onClick={handleCloseQrModal} type="button" aria-label="Đóng">
                <Icon name="x" />
              </button>
            </div>

            <label className="qr-proxy-field">
              <span>Proxy đăng nhập</span>
              <select className="input" value={proxy} disabled={creatingQr || Boolean(qrSession)} onChange={(event) => setProxy(event.target.value)}>
                <option value="">Không dùng proxy</option>
                {proxies.map((item) => (
                  <option value={item.proxy} key={item.id}>{item.name || item.proxy}</option>
                ))}
              </select>
            </label>

            {qrImage || creatingQr ? (
              <>
                <div className="qr-login-box">
                  {qrImage ? (
                    <img src={qrImage} alt="Mã QR đăng nhập Zalo" />
                  ) : (
                    <div className="qr-login-placeholder">
                      <Icon name="timer" size={72} />
                      <span>Đang tạo mã QR...</span>
                    </div>
                  )}
                </div>

                <p className="subtitle" style={{ textAlign: "center" }}>
                  Mở ứng dụng Zalo trên điện thoại, chọn quét QR và xác nhận đăng nhập.
                </p>
              </>
            ) : null}

            {qrStatus ? <div className="form-message success" style={{ marginTop: 14 }}>{qrStatus}</div> : null}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={handleCloseQrModal} type="button">Đóng</button>
              <button className="btn btn-red" disabled={qrDisabled} onClick={handleCreateQr} title={!canCreateQr ? "Cần mua/gia hạn gói trước khi thêm Zalo" : undefined} type="button">
                {creatingQr ? "Đang tạo..." : qrImage ? "Tạo QR mới" : "Tiếp theo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}
