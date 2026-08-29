"use client";

import { useEffect, useState } from "react";
import { Icon } from "../../components";
import { fetchAdminAuthSettings, type AuthSettings, updateAdminAuthSettings } from "../../lib/auth";
import { showError, showToast } from "../../lib/swal";

const defaultSettings: AuthSettings = {
  registration_trial_enabled: false,
  frontend_callback_url: "",
  google: {
    enabled: false,
    client_id: "",
    client_secret: "",
    redirect_uri: "",
  },
  facebook: {
    enabled: false,
    app_id: "",
    app_secret: "",
    redirect_uri: "",
  },
};

export default function AdminAuthPage() {
  const [fields, setFields] = useState<AuthSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminAuthSettings()
      .then((settings) => setFields({
        registration_trial_enabled: Boolean(settings.registration_trial_enabled),
        frontend_callback_url: settings.frontend_callback_url || "",
        google: { ...defaultSettings.google, ...settings.google },
        facebook: { ...defaultSettings.facebook, ...settings.facebook },
      }))
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải cấu hình Auth."))
      .finally(() => setLoading(false));
  }, []);

  function setGoogleField<K extends keyof AuthSettings["google"]>(key: K, value: AuthSettings["google"][K]) {
    setFields((prev) => ({ ...prev, google: { ...prev.google, [key]: value } }));
  }

  function setFacebookField<K extends keyof AuthSettings["facebook"]>(key: K, value: AuthSettings["facebook"][K]) {
    setFields((prev) => ({ ...prev, facebook: { ...prev.facebook, [key]: value } }));
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await updateAdminAuthSettings(fields);
      setFields({
        registration_trial_enabled: Boolean(updated.registration_trial_enabled),
        frontend_callback_url: updated.frontend_callback_url || "",
        google: { ...defaultSettings.google, ...updated.google },
        facebook: { ...defaultSettings.facebook, ...updated.facebook },
      });
      showToast("Đã lưu cấu hình Auth.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu cấu hình Auth.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cấu hình Auth...</div>
      </div>
    );
  }

  const googleReady = fields.google.enabled && !!fields.google.client_id && !!fields.google.client_secret && !!fields.google.redirect_uri;
  const facebookReady = fields.facebook.enabled && !!fields.facebook.app_id && !!fields.facebook.app_secret && !!fields.facebook.redirect_uri;

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Quản lý Auth</h1>
          <p>Cấu hình đăng nhập và đăng ký bằng Google/Facebook cho toàn hệ thống.</p>
        </div>
        <div className="admin-summary-strip">
          <span>Google: <strong>{googleReady ? "Sẵn sàng" : "Chưa sẵn sàng"}</strong></span>
          <span>Facebook: <strong>{facebookReady ? "Sẵn sàng" : "Chưa sẵn sàng"}</strong></span>
        </div>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Cấu hình OAuth</h2>
          <span className="cpanel-status-pill orange">Admin chỉnh tại đây</span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={onSave} style={{ display: "grid", gap: 18 }}>
            <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div className="cpanel-card-header" style={{ marginBottom: 8 }}>
                <div>
                  <h2>Gói free 3 ngày khi đăng ký</h2>
                  <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                    Khi bật, tài khoản mới sau đăng ký hoặc đăng nhập OAuth lần đầu sẽ tự nhận gói dùng thử 3 ngày.
                  </p>
                </div>
                <label className={`cpanel-status-pill ${fields.registration_trial_enabled ? "green" : "red"}`} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={fields.registration_trial_enabled}
                    onChange={(event) => setFields((prev) => ({ ...prev, registration_trial_enabled: event.target.checked }))}
                    style={{ marginRight: 8 }}
                  />
                  {fields.registration_trial_enabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
            </section>

            <div className="cpanel-field">
              <label>Frontend callback URL mặc định</label>
              <input
                className="cpanel-input"
                value={fields.frontend_callback_url}
                onChange={(event) => setFields((prev) => ({ ...prev, frontend_callback_url: event.target.value }))}
                placeholder="Tự lấy theo domain web hiện tại"
              />
              <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                Backend tự dùng link này để chuyển người dùng về web sau khi đăng nhập Google/Facebook xong. Có thể giữ mặc định, chỉ sửa khi web chạy ở domain khác.
              </p>
              {fields.frontend_callback_url ? (
                <a href={fields.frontend_callback_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
                  {fields.frontend_callback_url}
                </a>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff" }}>
                <div className="cpanel-card-header" style={{ marginBottom: 12 }}>
                  <h2>Google OAuth</h2>
                  <label className="cpanel-status-pill green" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={fields.google.enabled}
                      onChange={(event) => setGoogleField("enabled", event.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    {fields.google.enabled ? "Đang bật" : "Đang tắt"}
                  </label>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="cpanel-field">
                    <label>Client ID</label>
                    <input
                      className="cpanel-input"
                      value={fields.google.client_id}
                      onChange={(event) => setGoogleField("client_id", event.target.value)}
                      placeholder="Google OAuth Client ID"
                    />
                  </div>
                  <div className="cpanel-field">
                    <label>Client Secret</label>
                    <input
                      className="cpanel-input"
                      type="password"
                      value={fields.google.client_secret}
                      onChange={(event) => setGoogleField("client_secret", event.target.value)}
                      placeholder="Google OAuth Client Secret"
                    />
                  </div>
                  <div className="cpanel-field">
                    <label>Redirect URI</label>
                    <input
                      className="cpanel-input"
                      value={fields.google.redirect_uri}
                      onChange={(event) => setGoogleField("redirect_uri", event.target.value)}
                      placeholder="https://api.your-domain.com/api/auth/oauth/google/callback"
                    />
                  </div>
                </div>
              </section>

              <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff" }}>
                <div className="cpanel-card-header" style={{ marginBottom: 12 }}>
                  <h2>Facebook OAuth</h2>
                  <label className="cpanel-status-pill blue" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={fields.facebook.enabled}
                      onChange={(event) => setFacebookField("enabled", event.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    {fields.facebook.enabled ? "Đang bật" : "Đang tắt"}
                  </label>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="cpanel-field">
                    <label>App ID</label>
                    <input
                      className="cpanel-input"
                      value={fields.facebook.app_id}
                      onChange={(event) => setFacebookField("app_id", event.target.value)}
                      placeholder="Facebook App ID"
                    />
                  </div>
                  <div className="cpanel-field">
                    <label>App Secret</label>
                    <input
                      className="cpanel-input"
                      type="password"
                      value={fields.facebook.app_secret}
                      onChange={(event) => setFacebookField("app_secret", event.target.value)}
                      placeholder="Facebook App Secret"
                    />
                  </div>
                  <div className="cpanel-field">
                    <label>Redirect URI</label>
                    <input
                      className="cpanel-input"
                      value={fields.facebook.redirect_uri}
                      onChange={(event) => setFacebookField("redirect_uri", event.target.value)}
                      placeholder="https://api.your-domain.com/api/auth/oauth/facebook/callback"
                    />
                  </div>
                </div>
              </section>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                className="cpanel-btn cpanel-btn-secondary"
                type="button"
                disabled={saving}
                onClick={() => setFields(defaultSettings)}
              >
                <Icon name="update" size={16} /> Về mặc định
              </button>
              <button className="cpanel-btn cpanel-btn-red" disabled={saving} type="submit">
                <Icon name="check" size={16} /> {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
