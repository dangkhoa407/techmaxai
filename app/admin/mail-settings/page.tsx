"use client";

import { useEffect, useState } from "react";
import { Icon } from "../../components";
import {
  fetchAdminMailSetting,
  sendAdminMailTest,
  updateAdminMailSetting,
  type MailSetting,
} from "../../lib/auth";
import { showToast, showError } from "../../lib/swal";

export default function AdminMailSettingsPage() {
  const [fields, setFields] = useState<MailSetting>({
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_secure: true,
    smtp_user: "",
    smtp_pass: "",
    smtp_pass_configured: false,
    from_name: "TechMax",
    from_email: "",
    is_enabled: false,
  });
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchAdminMailSetting()
      .then((data) => {
        setFields({ ...data, smtp_pass: "" });
        setTestEmail(data.smtp_user || data.from_email || "");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải cấu hình mail.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await updateAdminMailSetting({
        smtp_host: fields.smtp_host,
        smtp_port: Number(fields.smtp_port || 465),
        smtp_secure: Boolean(fields.smtp_secure),
        smtp_user: fields.smtp_user,
        smtp_pass: fields.smtp_pass || undefined,
        from_name: fields.from_name,
        from_email: fields.from_email || fields.smtp_user,
        is_enabled: Boolean(fields.is_enabled),
      });
      setFields({ ...updated, smtp_pass: "" });
      showToast("Đã lưu cấu hình Gmail SMTP.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu cấu hình mail.");
    } finally {
      setSaving(false);
    }
  }

  async function onSendTest() {
    setTesting(true);

    try {
      const payload = await sendAdminMailTest(testEmail);
      showToast(payload.message || "Đã gửi email test.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể gửi email test.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cấu hình mail...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Cấu hình Mail xác thực</h1>
        <p>Quản lý Gmail SMTP dùng để gửi mã xác thực khi người dùng đăng ký tài khoản.</p>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Gmail SMTP</h2>
          <span className={`cpanel-status-pill ${fields.is_enabled ? "green" : "red"}`}>
            {fields.is_enabled ? "Đang bật" : "Đang tắt"}
          </span>
        </div>
        <div className="cpanel-card-body">
          {/* Banners removed per toast request */}

          <form onSubmit={onSave}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className="cpanel-field">
                <label>SMTP Host</label>
                <input
                  className="cpanel-input"
                  value={fields.smtp_host}
                  onChange={(event) => setFields((prev) => ({ ...prev, smtp_host: event.target.value }))}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="cpanel-field">
                <label>SMTP Port</label>
                <input
                  className="cpanel-input"
                  type="number"
                  value={fields.smtp_port}
                  onChange={(event) => setFields((prev) => ({ ...prev, smtp_port: Number(event.target.value) }))}
                  placeholder="465"
                />
              </div>

              <div className="cpanel-field">
                <label>Gmail gửi mail</label>
                <input
                  className="cpanel-input"
                  type="email"
                  value={fields.smtp_user}
                  onChange={(event) => setFields((prev) => ({ ...prev, smtp_user: event.target.value }))}
                  placeholder="your@gmail.com"
                />
              </div>

              <div className="cpanel-field">
                <label>Gmail App Password</label>
                <input
                  className="cpanel-input"
                  type="password"
                  value={fields.smtp_pass || ""}
                  onChange={(event) => setFields((prev) => ({ ...prev, smtp_pass: event.target.value }))}
                  placeholder={fields.smtp_pass_configured ? "Đã cấu hình, để trống nếu không đổi" : "Nhập app password Gmail"}
                />
              </div>

              <div className="cpanel-field">
                <label>Tên người gửi</label>
                <input
                  className="cpanel-input"
                  value={fields.from_name}
                  onChange={(event) => setFields((prev) => ({ ...prev, from_name: event.target.value }))}
                  placeholder="TechMax"
                />
              </div>

              <div className="cpanel-field">
                <label>Email hiển thị</label>
                <input
                  className="cpanel-input"
                  type="email"
                  value={fields.from_email}
                  onChange={(event) => setFields((prev) => ({ ...prev, from_email: event.target.value }))}
                  placeholder="Để trống sẽ dùng Gmail gửi mail"
                />
              </div>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#18181b", fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={fields.smtp_secure}
                  onChange={(event) => setFields((prev) => ({ ...prev, smtp_secure: event.target.checked }))}
                />
                Dùng SSL/TLS
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#18181b", fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={fields.is_enabled}
                  onChange={(event) => setFields((prev) => ({ ...prev, is_enabled: event.target.checked }))}
                />
                Bật gửi mã xác thực khi đăng ký
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button className="cpanel-btn cpanel-btn-red" disabled={saving} type="submit">
                <Icon name="check" size={16} /> {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="cpanel-card" style={{ marginTop: 20 }}>
        <div className="cpanel-card-header">
          <h2>Gửi thử email</h2>
        </div>
        <div className="cpanel-card-body">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="cpanel-field" style={{ flex: "1 1 280px" }}>
              <label>Email nhận test</label>
              <input
                className="cpanel-input"
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <button className="cpanel-btn cpanel-btn-secondary" disabled={testing} onClick={onSendTest} type="button">
              <Icon name="mail" size={16} /> {testing ? "Đang gửi..." : "Gửi email test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
