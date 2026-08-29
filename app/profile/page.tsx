"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent } from "react";
import { AppFrame, Icon, PageHeader, UserAvatar, VerifiedBadge } from "../components";
import { fetchLoginSessions, logoutLoginSessions, securityAction, updateProfile, useAuthUser, type LoginSession, type UserProfile } from "../lib/auth";
import { showToast, showError } from "../lib/swal";

type ProfileForm = {
  fullname: string;
  phone: string;
  address: string;
  region: string;
  tax_code: string;
  province_city: string;
  company: string;
  citizen_id: string;
};

const emptyForm: ProfileForm = {
  fullname: "",
  phone: "",
  address: "",
  region: "",
  tax_code: "",
  province_city: "",
  company: "",
  citizen_id: "",
};

function valueOrPending(value?: string | null) {
  return value && value.trim() ? value : "Chưa cập nhật";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể tải ảnh để crop."));
    image.src = src;
  });
}

async function cropAvatarDataUrl(src: string, zoom: number, offsetX: number, offsetY: number) {
  const image = await loadImage(src);
  const outputSize = 512;
  const previewSize = 300;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ crop ảnh.");

  const baseScale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight);
  const scale = baseScale * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const dx = (outputSize - width) / 2 + (offsetX * outputSize) / previewSize;
  const dy = (outputSize - height) / 2 + (offsetY * outputSize) / previewSize;

  context.clearRect(0, 0, outputSize, outputSize);
  context.drawImage(image, dx, dy, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function toForm(user: UserProfile | null): ProfileForm {
  if (!user) return emptyForm;

  return {
    fullname: user.fullname || "",
    phone: user.phone || "",
    address: user.address || "",
    region: user.region || "",
    tax_code: user.tax_code || "",
    province_city: user.province_city || "",
    company: user.company || "",
    citizen_id: user.citizen_id || "",
  };
}

export default function ProfilePage() {
  const { user, loading } = useAuthUser();
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<"profile" | "security" | "twoFactor">("profile");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const avatarDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const currentUser = profileUser || user;

  useEffect(() => {
    setProfileUser(user);
  }, [user]);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ảnh đại diện tối đa 5MB.");
      return;
    }
    try {
      setAvatarCropSrc(await fileToDataUrl(file));
      setAvatarZoom(1);
      setAvatarOffsetX(0);
      setAvatarOffsetY(0);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đọc ảnh đại diện.");
    }
  }

  function closeAvatarCrop() {
    if (avatarSaving) return;
    setAvatarCropSrc("");
    avatarDragRef.current = null;
  }

  async function handleSaveCroppedAvatar() {
    if (!avatarCropSrc) return;
    try {
      setAvatarSaving(true);
      const croppedAvatar = await cropAvatarDataUrl(avatarCropSrc, avatarZoom, avatarOffsetX, avatarOffsetY);
      const updatedUser = await updateProfile({ avatar_url: croppedAvatar });
      if (!updatedUser.avatar_url) throw new Error("Server chưa lưu ảnh đại diện. Vui lòng thử lại sau khi API đã khởi động lại.");
      setProfileUser(updatedUser);
      setAvatarCropSrc("");
      avatarDragRef.current = null;
      showToast("Đã cập nhật ảnh đại diện.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật ảnh đại diện.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleRemoveAvatar() {
    try {
      setAvatarSaving(true);
      const updatedUser = await updateProfile({ avatar_url: null });
      setProfileUser(updatedUser);
      showToast("Đã xóa ảnh đại diện.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa ảnh đại diện.");
    } finally {
      setAvatarSaving(false);
    }
  }

  function handleAvatarCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    avatarDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarOffsetX,
      originY: avatarOffsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleAvatarCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = avatarDragRef.current;
    if (!drag) return;
    event.preventDefault();
    setAvatarOffsetX(clamp(drag.originX + event.clientX - drag.startX, -120, 120));
    setAvatarOffsetY(clamp(drag.originY + event.clientY - drag.startY, -120, 120));
  }

  function handleAvatarCropPointerEnd(event: PointerEvent<HTMLDivElement>) {
    avatarDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <AppFrame active="/profile" title="Hồ sơ người dùng">
      <PageHeader
        title="Hồ sơ người dùng"
        desc="Quản lý thông tin tài khoản, doanh nghiệp và dữ liệu định danh."
        action={<Link className="btn btn-red" href="/deposit"><Icon name="payments" /> Nạp tiền</Link>}
      />

      <section className="card pad" style={{ marginBottom: 24 }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-shell">
              <UserAvatar name={currentUser?.fullname || currentUser?.email || "H"} src={currentUser?.avatar_url} size={80} />
              <label className="profile-avatar-edit" title="Đổi ảnh đại diện" aria-label="Đổi ảnh đại diện">
                <Icon name="edit_note" size={17} />
                <input accept="image/*" disabled={avatarSaving} onChange={handleAvatarChange} type="file" />
              </label>
              {currentUser?.avatar_url ? (
                <button className="profile-avatar-remove" disabled={avatarSaving} onClick={handleRemoveAvatar} title="Xóa ảnh đại diện" type="button">
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="name-with-badge" style={{ margin: 0, color: "var(--primary)" }}>
              {currentUser?.fullname || "hecker"}
              {currentUser?.verified_badge ? <VerifiedBadge size={22} /> : null}
            </h2>
            <p className="muted">{currentUser?.email || "khoablackcode407@gmail.com"}</p>
            <div className="row">
              <span className="status green">{currentUser?.status === "active" ? "Đang hoạt động" : "Demo tài khoản"}</span>
              {currentUser?.two_factor_enabled ? <span className="status green">Đã bật 2FA</span> : <span className="status red">Chưa bật 2FA</span>}
              {loading ? <span className="status">Đang tải hồ sơ</span> : null}
            </div>
          </div>
        </div>
        <div className="profile-tabs">
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")} type="button">
            <Icon name="account_circle" size={16} /> Hồ sơ
          </button>
          <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")} type="button">
            <Icon name="security" size={16} /> Bảo mật
          </button>
          <button className={tab === "twoFactor" ? "active" : ""} onClick={() => setTab("twoFactor")} type="button">
            <Icon name="shield" size={16} /> Xác thực 2 lớp
          </button>
        </div>
      </section>

      {tab === "profile" ? <ProfileTab user={currentUser} onUserUpdate={setProfileUser} /> : null}
      {tab === "security" ? <SecurityTab user={currentUser} /> : null}
      {tab === "twoFactor" ? <TwoFactorTab user={currentUser} /> : null}

      {avatarCropSrc ? (
        <div className="modal-backdrop profile-avatar-crop-backdrop" role="presentation" onMouseDown={closeAvatarCrop}>
          <div className="profile-avatar-crop-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="profile-avatar-crop-head">
              <h2 id="avatar-crop-title">Chọn ảnh đại diện</h2>
              <button className="profile-avatar-crop-close" type="button" aria-label="Đóng" disabled={avatarSaving} onClick={closeAvatarCrop}>
                <Icon name="close" size={22} />
              </button>
            </header>

            <div className="profile-avatar-crop-body">
              <div className="profile-avatar-crop-stage">
                <div
                  className="profile-avatar-crop-preview"
                  onPointerDown={handleAvatarCropPointerDown}
                  onPointerMove={handleAvatarCropPointerMove}
                  onPointerUp={handleAvatarCropPointerEnd}
                  onPointerCancel={handleAvatarCropPointerEnd}
                >
                  <img
                    src={avatarCropSrc}
                    alt="Preview ảnh đại diện"
                    draggable={false}
                    style={{ transform: `translate(-50%, -50%) translate(${avatarOffsetX}px, ${avatarOffsetY}px) scale(${avatarZoom})` }}
                  />
                </div>
              </div>

              <div className="profile-avatar-crop-zoom">
                <span aria-hidden="true">-</span>
                <input min="1" max="3" step="0.01" type="range" value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} />
                <span aria-hidden="true">+</span>
              </div>
            </div>

            <footer className="profile-avatar-crop-footer">
              <button className="profile-avatar-crop-cancel" disabled={avatarSaving} onClick={closeAvatarCrop} type="button">Hủy</button>
              <button className="profile-avatar-crop-save" disabled={avatarSaving} onClick={handleSaveCroppedAvatar} type="button">
                {avatarSaving ? "Đang lưu..." : "Lưu"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}

function ProfileTab({ user, onUserUpdate }: { user: UserProfile | null; onUserUpdate: (user: UserProfile) => void }) {
  const [form, setForm] = useState<ProfileForm>(() => toForm(user));
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    setForm(toForm(user));
  }, [user]);

  const profileItems = [
    { label: "Họ và tên", value: valueOrPending(user?.fullname), icon: "person_book" },
    { label: "Email đăng nhập", value: valueOrPending(user?.email), icon: "mail" },
    { label: "Số điện thoại", value: valueOrPending(user?.phone), icon: "phone" },
    { label: "Địa chỉ", value: valueOrPending(user?.address), icon: "location_on" },
    { label: "Khu vực", value: valueOrPending(user?.region), icon: "location_on" },
    { label: "Mã số thuế", value: valueOrPending(user?.tax_code), icon: "receipt_long" },
    { label: "Tỉnh/thành phố", value: valueOrPending(user?.province_city), icon: "location_on" },
    { label: "Công ty", value: valueOrPending(user?.company), icon: "business" },
    { label: "CCCD", value: valueOrPending(user?.citizen_id), icon: "fingerprint" },
    { label: "Trạng thái", value: user?.status === "active" ? "Đang hoạt động" : "Chưa đăng nhập", icon: "shield" },
  ];
  const [profileHeroName, profileHeroEmail, ...profileDetailItems] = profileItems;

  function updateField(name: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const updatedUser = await updateProfile(form);
      onUserUpdate(updatedUser);
      showToast("Cập nhật hồ sơ thành công.");
      setShowEditModal(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="stack profile-tab-panel">
        <div className="between profile-summary-header">
          <div className="row" style={{ color: "var(--red)", fontWeight: 900, textTransform: "uppercase", fontSize: 13, letterSpacing: ".06em" }}>
            <Icon name="shield" size={18} />
            Thông tin tài khoản
          </div>
          <button className="btn btn-red" type="button" onClick={() => setShowEditModal(true)}>
            <Icon name="edit_note" size={16} /> Cập nhật hồ sơ
          </button>
        </div>
        <div className="card pad profile-summary-card">
          <div className="profile-summary-hero">
            <div className="profile-summary-hero-main">
              <label>{profileHeroName.label}</label>
              <input className="input profile-summary-input" disabled value={profileHeroName.value} readOnly />
            </div>
            <div className="profile-summary-hero-side">
              <label>{profileHeroEmail.label}</label>
              <input className="input profile-summary-input" disabled value={profileHeroEmail.value} readOnly />
            </div>
          </div>
          <div className="profile-summary-divider" />
          <div className="profile-summary-grid">
            {profileDetailItems.map(({ label, value, icon }) => (
              <div className="profile-summary-item" key={label}>
                <label className="profile-summary-label">
                  <span className="profile-summary-label-icon"><Icon name={icon} size={12} /></span>
                  <span className="profile-summary-label-text">{label}</span>
                </label>
                <input className="input profile-summary-input" disabled value={value} readOnly />
              </div>
            ))}
          </div>
        </div>
      </section>

      {showEditModal ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowEditModal(false)}>
          <div className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <div className="profile-edit-title" id="profile-edit-title">Cập nhật hồ sơ</div>
                <p className="muted" style={{ margin: "6px 0 0" }}>Chỉnh sửa thông tin tài khoản của bạn.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Đóng" disabled={saving} onClick={() => setShowEditModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <form className="profile-form-grid profile-edit-form" onSubmit={onSubmit}>
              <label><span>Họ và tên</span><input className="input" value={form.fullname} onChange={(event) => updateField("fullname", event.target.value)} required /></label>
              <label><span>Số điện thoại</span><input className="input" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
              <label><span>Công ty</span><input className="input" value={form.company} onChange={(event) => updateField("company", event.target.value)} /></label>
              <label><span>Mã số thuế</span><input className="input" value={form.tax_code} onChange={(event) => updateField("tax_code", event.target.value)} /></label>
              <label><span>Tỉnh/thành phố</span><input className="input" value={form.province_city} onChange={(event) => updateField("province_city", event.target.value)} /></label>
              <label><span>Khu vực</span><input className="input" value={form.region} onChange={(event) => updateField("region", event.target.value)} /></label>
              <label><span>CCCD</span><input className="input" value={form.citizen_id} onChange={(event) => updateField("citizen_id", event.target.value)} /></label>
              <label><span>Địa chỉ</span><input className="input" value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
              <div className="profile-form-actions">
                <button className="btn btn-secondary" disabled={saving} type="button" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button className="btn btn-red" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu hồ sơ"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SecurityTab({ user }: { user: UserProfile | null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionPage, setSessionPage] = useState(1);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      setSessions(await fetchLoginSessions());
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải phiên đăng nhập.");
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function runAction(data: Record<string, unknown>, successFallback: string) {
    setSaving(true);
    try {
      const payload = await securityAction(data);
      showToast(payload.message || successFallback);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể thực hiện thao tác bảo mật.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction({
      action: "change_password",
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }, "Đổi mật khẩu thành công.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const sessionCount = user?.session_count || 1;
  const securityAlerts = user?.security_alerts_enabled ?? true;
  const otherSessions = sessions.filter((session) => !session.current);
  const sessionPageSize = 5;
  const sessionPageCount = Math.max(1, Math.ceil(sessions.length / sessionPageSize));
  const visibleSessions = sessions.slice((sessionPage - 1) * sessionPageSize, sessionPage * sessionPageSize);

  useEffect(() => {
    setSessionPage((current) => Math.min(current, sessionPageCount));
  }, [sessionPageCount]);

  async function logoutSelectedSessions(logoutOthers = false) {
    if (!logoutOthers && selectedSessions.length === 0) {
      showToast("Hãy chọn ít nhất một phiên để đăng xuất.", "error");
      return;
    }

    setSaving(true);
    try {
      const nextSessions = await logoutLoginSessions(selectedSessions, logoutOthers);
      setSessions(nextSessions);
      setSelectedSessions([]);
      setSessionPage(1);
      showToast(logoutOthers ? "Đã đăng xuất toàn bộ phiên khác." : "Đã đăng xuất các phiên đã chọn.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đăng xuất phiên.");
    } finally {
      setSaving(false);
    }
  }

  function toggleSession(sessionId: string) {
    setSelectedSessions((current) => current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId]);
  }

  return (
    <section className="stack profile-tab-panel">
      <div className="row" style={{ color: "var(--red)", fontWeight: 900, textTransform: "uppercase", fontSize: 13, letterSpacing: ".06em" }}>
        <Icon name="security" size={18} />
        Bảo mật tài khoản
      </div>
      <div className="grid-2">
        {[
          ["Mật khẩu", user?.password_changed_at ? `Đổi gần nhất: ${user.password_changed_at}` : "Đã thiết lập", "Đổi mật khẩu định kỳ để bảo vệ tài khoản."],
          ["Email đăng nhập", user?.email || "Chưa đăng nhập", "Email dùng để nhận thông báo và khôi phục tài khoản."],
          ["Phiên đăng nhập", `${sessionCount} phiên đang hoạt động`, "Theo dõi và đăng xuất các phiên không còn sử dụng."],
          ["Cảnh báo bảo mật", securityAlerts ? "Đang bật" : "Đang tắt", "Hệ thống sẽ thông báo khi có hoạt động bất thường."],
        ].map(([title, value, desc]) => (
          <div className="card pad profile-info security-card" key={title}>
            <label>{title}</label>
            <p>{value}</p>
            <span>{desc}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <form className="card pad profile-security-form" onSubmit={changePassword}>
          <div className="row"><Icon name="lock" /><h3>Đổi mật khẩu</h3></div>
          <label><span>Mật khẩu hiện tại</span><input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label><span>Mật khẩu mới</span><input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
          <label><span>Xác nhận mật khẩu mới</span><input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          <button className="btn btn-red" disabled={saving} type="submit">{saving ? "Đang xử lý..." : "Đổi mật khẩu"}</button>
        </form>

        <div className="card pad profile-security-form">
          <div className="row"><Icon name="shield" /><h3>Tùy chọn bảo mật</h3></div>
          <div className="between security-option-row">
            <div>
              <strong>Cảnh báo bảo mật</strong>
              <p className="muted">Bật thông báo khi có hoạt động đăng nhập hoặc thay đổi quan trọng.</p>
            </div>
            <button className={securityAlerts ? "btn btn-red" : "btn btn-secondary"} disabled={saving} onClick={() => runAction({ action: "toggle_security_alerts", enabled: !securityAlerts }, "Đã cập nhật cảnh báo bảo mật.")} type="button">
              {securityAlerts ? "Đang bật" : "Đang tắt"}
            </button>
          </div>
          <div className="between security-option-row">
            <div>
              <strong>Phiên đăng nhập khác</strong>
              <p className="muted">Giữ phiên hiện tại và đăng xuất toàn bộ phiên còn lại.</p>
            </div>
            <button className="btn btn-secondary" disabled={saving || otherSessions.length === 0} onClick={() => logoutSelectedSessions(true)} type="button">
              Đăng xuất tất cả phiên khác
            </button>
          </div>
        </div>
      </div>

      <div className="card pad login-session-panel">
        <div className="between">
          <div>
            <h3>Phiên đăng nhập</h3>
            <p className="muted">Phiên hiện tại được giữ lại. Bạn có thể chọn từng thiết bị khác để đăng xuất.</p>
          </div>
          <button className="btn btn-secondary" disabled={saving || otherSessions.length === 0} onClick={() => logoutSelectedSessions(true)} type="button">
            Đăng xuất tất cả phiên khác
          </button>
        </div>

        <div className="login-session-list">
          {loadingSessions ? (
            <p className="muted">Đang tải phiên đăng nhập...</p>
          ) : sessions.length ? (
            <>
              <div className="table-wrap login-session-table-wrap">
                <table className="login-session-table">
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>Thiết bị</th>
                      <th>Vị trí</th>
                      <th>Hoạt động gần nhất</th>
                      <th>Hết hạn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.map((session) => (
                      <tr className={session.current ? "current" : ""} key={session.session_id}>
                        <td>
                          <input
                            type="checkbox"
                            disabled={session.current || saving}
                            checked={selectedSessions.includes(session.session_id)}
                            onChange={() => toggleSession(session.session_id)}
                            aria-label={`Chọn phiên ${session.device_name}`}
                          />
                        </td>
                        <td>
                          <div className="row session-device-cell">
                            <div className="session-device-icon"><Icon name={session.device_type === "Điện thoại" ? "smart_toy" : "monitoring"} size={18} /></div>
                            <div>
                              <strong>{session.device_name}</strong>
                              <span>{session.browser} • {session.os}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{session.location}</strong>
                          <span>IP {session.ip_address}</span>
                        </td>
                        <td>{session.last_seen_at || "Chưa có"}</td>
                        <td>{session.expires_at || "Chưa có"}</td>
                        <td>
                          <span className={session.current ? "status green" : "status blue"}>{session.current ? "Phiên hiện tại" : "Phiên khác"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="datatable-footer">
                <span>
                  Hiển thị {(sessionPage - 1) * sessionPageSize + 1}-{Math.min(sessionPage * sessionPageSize, sessions.length)} trong {sessions.length} phiên
                </span>
                <div className="row">
                  <button className="btn btn-secondary" disabled={sessionPage <= 1} onClick={() => setSessionPage((page) => Math.max(1, page - 1))} type="button">
                    Trước
                  </button>
                  <strong>{sessionPage}/{sessionPageCount}</strong>
                  <button className="btn btn-secondary" disabled={sessionPage >= sessionPageCount} onClick={() => setSessionPage((page) => Math.min(sessionPageCount, page + 1))} type="button">
                    Sau
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">Chưa có phiên đăng nhập nào.</p>
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-red" disabled={saving || selectedSessions.length === 0} onClick={() => logoutSelectedSessions(false)} type="button">
            Đăng xuất phiên đã chọn
          </button>
        </div>
      </div>

      {/* Banners removed per toast request */}
    </section>
  );
}

function TwoFactorTab({ user }: { user: UserProfile | null }) {
  const [saving, setSaving] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupSecret, setSetupSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const twoFactorEnabled = user?.two_factor_enabled ?? false;
  const qrUrl = otpauthUri ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUri)}` : "";

  async function setupTwoFactor() {
    setSaving(true);
    try {
      const payload = await securityAction({ action: "setup_2fa" });
      setSetupSecret(payload.two_factor_secret || "");
      setOtpauthUri(payload.otpauth_uri || "");
      showToast(payload.message || "Quét mã QR bằng Google Authenticator hoặc Duo Mobile.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tạo thiết lập 2FA.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyTwoFactor() {
    setSaving(true);
    try {
      const payload = await securityAction({ action: "verify_2fa", code });
      setRecoveryCodes(payload.recovery_codes || []);
      setCode("");
      setSetupSecret("");
      setOtpauthUri("");
      showToast(payload.message || "Đã bật xác thực 2 lớp.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xác nhận mã 2FA.");
    } finally {
      setSaving(false);
    }
  }

  async function disableTwoFactor() {
    setSaving(true);
    try {
      const payload = await securityAction({ action: "disable_2fa", code });
      setRecoveryCodes([]);
      setCode("");
      showToast(payload.message || "Đã tắt xác thực 2 lớp.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tắt 2FA.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack profile-tab-panel">
      <div className="row" style={{ color: "var(--red)", fontWeight: 900, textTransform: "uppercase", fontSize: 13, letterSpacing: ".06em" }}>
        <Icon name="shield" size={18} />
        Xác thực 2 lớp
      </div>
      <div className="card pad twofa-hero">
        <div>
          <span className={twoFactorEnabled ? "status green" : "status red"}>{twoFactorEnabled ? "Đã bật 2FA" : "Chưa bật 2FA"}</span>
          <h2>Xác thực bằng Google Authenticator hoặc Duo Mobile</h2>
          <p>Mở Google Authenticator hoặc Duo Mobile, quét mã QR rồi nhập mã 6 số đang hiển thị trong ứng dụng.</p>
          {!twoFactorEnabled ? (
            <button className="btn btn-red" disabled={saving} onClick={setupTwoFactor} type="button">
              <Icon name="qr_code_scanner" size={18} />
              {saving ? "Đang tạo mã..." : setupSecret ? "Tạo lại mã QR" : "Tạo mã QR 2FA"}
            </button>
          ) : null}
        </div>
      </div>

      {!twoFactorEnabled && setupSecret ? (
        <div className="card pad twofa-setup-grid">
          <div className="twofa-qr-box">
            {qrUrl ? <img src={qrUrl} alt="QR Google Authenticator Duo Mobile" /> : null}
          </div>
          <div className="stack">
            <div>
              <h3 style={{ margin: 0 }}>Quét mã QR</h3>
              <p className="muted">Dùng Google Authenticator hoặc Duo Mobile. Nếu không quét được, nhập secret thủ công.</p>
            </div>
            <div className="manual-secret"><span>Secret</span><code>{setupSecret}</code></div>
            <label>
              <span className="muted" style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 800 }}>Mã 6 số</span>
              <input className="input" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
            <button className="btn btn-red" disabled={saving || code.length !== 6} onClick={verifyTwoFactor} type="button">Xác nhận bật 2FA</button>
          </div>
        </div>
      ) : null}

      {twoFactorEnabled ? (
        <div className="card pad profile-security-form">
          <div className="row"><Icon name="lock" /><h3>Tắt xác thực 2 lớp</h3></div>
          <p className="muted">Nhập mã 6 số hiện tại từ Google Authenticator hoặc Duo Mobile để tắt 2FA.</p>
          <input className="input" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button className="btn btn-secondary" disabled={saving || code.length !== 6} onClick={disableTwoFactor} type="button">Tắt xác thực 2 lớp</button>
        </div>
      ) : null}

      {recoveryCodes.length ? (
        <div className="card pad">
          <div className="row"><Icon name="mail" /><h3 style={{ margin: 0 }}>Mã khôi phục</h3></div>
          <p className="muted">Lưu lại các mã này. Mỗi mã chỉ nên dùng một lần khi bạn không thể xác thực bằng thiết bị chính.</p>
          <div className="recovery-code-grid">
            {recoveryCodes.map((item) => <code key={item}>{item}</code>)}
          </div>
        </div>
      ) : null}

      <div className="grid-3">
        {[
          ["qr_code_scanner", "Google Authenticator", "Quét QR hoặc nhập secret thủ công để nhận mã 6 số."],
          ["shield", "Duo Mobile", "Chọn thêm tài khoản bằng QR code trong Duo Mobile."],
          ["lock", "Mã đổi mỗi 30 giây", "Mã TOTP hết hạn nhanh để giảm rủi ro lộ mật khẩu."],
        ].map(([icon, title, desc]) => (
          <div className="card pad security-card" key={title}>
            <Icon name={icon} />
            <h3>{title}</h3>
            <p className="muted">{desc}</p>
          </div>
        ))}
      </div>

      {/* Banners removed per toast request */}
    </section>
  );
}

