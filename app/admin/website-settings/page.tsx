"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components";
import {
  fetchAdminAuthSettings,
  fetchAdminBankSetting,
  fetchAdminDashboardPopup,
  fetchAdminLandingSettings,
  fetchAdminMailSetting,
  type AuthSettings,
  type BankSetting,
  type DashboardPopupSettings,
  type LandingSettings,
  type MailSetting,
  sendAdminMailTest,
  updateAdminAuthSettings,
  updateAdminBankSetting,
  updateAdminDashboardPopup,
  updateAdminLandingSettings,
  updateAdminMailSetting,
} from "../../lib/auth";
import { showError, showToast } from "../../lib/swal";

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="cpanel-page-title-row" style={{ marginBottom: 12 }}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function formatVnd(value?: number | null) {
  if (value === null || value === undefined) return "Chưa có dữ liệu";
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

type SummernoteWindow = Window & {
  jQuery?: any;
  $?: any;
};

const defaultPopupFields: Pick<DashboardPopupSettings, "enabled" | "title" | "html"> = {
  enabled: false,
  title: "Thông báo",
  html: "",
};

function loadCss(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Không tải được ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.body.appendChild(script);
  });
}

function getYouTubeEmbedUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "watch") videoId = url.searchParams.get("v") || "";
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") videoId = parts[1] || "";
    }

    if (!videoId) return "";
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: videoId,
      controls: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  } catch {
    return "";
  }
}

export default function AdminWebsiteSettingsPage() {
  const [activeTab, setActiveTab] = useState<"landing" | "bank" | "mail" | "auth" | "popup">("landing");
  const [landing, setLanding] = useState<LandingSettings>({ demo_video_url: "", demo_poster_url: "/dashboard-preview.png" });
  const [bank, setBank] = useState<BankSetting | null>(null);
  const [bankFields, setBankFields] = useState<Partial<BankSetting>>({
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
    branch: "",
    transfer_prefix: "",
    history_api_url: "",
    mb_username: "",
    mb_password: "",
    min_amount: 0,
    max_amount: 0,
  });
  const [logoData, setLogoData] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [mailFields, setMailFields] = useState<MailSetting>({
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
  const [authFields, setAuthFields] = useState<AuthSettings>({
    registration_trial_enabled: false,
    frontend_callback_url: "",
    google: { enabled: false, client_id: "", client_secret: "", redirect_uri: "" },
    facebook: { enabled: false, app_id: "", app_secret: "", redirect_uri: "" },
  });
  const [popupFields, setPopupFields] = useState<Pick<DashboardPopupSettings, "enabled" | "title" | "html">>({
    enabled: false,
    title: "Thông báo",
    html: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingLanding, setSavingLanding] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingMail, setSavingMail] = useState(false);
  const [savingAuth, setSavingAuth] = useState(false);
  const [savingPopup, setSavingPopup] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const tabs = [
    { key: "landing", label: "Landing", icon: "image" },
    { key: "bank", label: "Bank", icon: "account_balance" },
    { key: "mail", label: "Mail", icon: "mail" },
    { key: "auth", label: "Auth", icon: "vpn_lock" },
    { key: "popup", label: "Popup Dashboard", icon: "campaign" },
  ] as const;

  useEffect(() => {
    Promise.allSettled([
      fetchAdminLandingSettings(),
      fetchAdminBankSetting(),
      fetchAdminMailSetting(),
      fetchAdminAuthSettings(),
      fetchAdminDashboardPopup(),
    ]).then(([landingResult, bankResult, mailResult, authResult, popupResult]) => {
      if (landingResult.status === "fulfilled") {
        setLanding(landingResult.value);
      } else {
        showError(landingResult.reason instanceof Error ? landingResult.reason.message : "Không thể tải cấu hình Landing.");
      }

      if (bankResult.status === "fulfilled") {
        const bank = bankResult.value;
        setBank(bank);
        setBankFields({
          bank_code: bank.bank_code,
          bank_name: bank.bank_name,
          account_number: bank.account_number,
          account_name: bank.account_name,
          branch: bank.branch || "",
          transfer_prefix: bank.transfer_prefix,
          history_api_url: bank.history_api_url || "",
          mb_username: bank.mb_username || "",
          mb_password: "",
          min_amount: bank.min_amount,
          max_amount: bank.max_amount,
        });
        setLogoData(bank.logo_data || null);
      } else {
        showError(bankResult.reason instanceof Error ? bankResult.reason.message : "Không thể tải cấu hình Bank.");
      }

      if (mailResult.status === "fulfilled") {
        setMailFields({ ...mailResult.value, smtp_pass: "" });
        setTestEmail(mailResult.value.smtp_user || mailResult.value.from_email || "");
      } else {
        showError(mailResult.reason instanceof Error ? mailResult.reason.message : "Không thể tải cấu hình Mail.");
      }

      if (authResult.status === "fulfilled") {
        setAuthFields(authResult.value);
      } else {
        showError(authResult.reason instanceof Error ? authResult.reason.message : "Không thể tải cấu hình Auth.");
      }

      if (popupResult.status === "fulfilled") {
        setPopupFields({
          enabled: popupResult.value.enabled,
          title: popupResult.value.title,
          html: popupResult.value.html,
        });
      } else {
        showError(popupResult.reason instanceof Error ? popupResult.reason.message : "Không thể tải popup dashboard.");
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || activeTab !== "popup" || !editorRef.current) return;
    let disposed = false;

    async function setupEditor() {
      try {
        loadCss("summernote-lite-css", "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.css");
        await loadScript("jquery-3-7-1", "https://code.jquery.com/jquery-3.7.1.min.js");
        await loadScript("summernote-lite-js", "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.js");
        if (disposed || !editorRef.current) return;
        const win = window as SummernoteWindow;
        const $ = win.jQuery || win.$;
        if (!$?.fn?.summernote) throw new Error("Summernote chưa sẵn sàng.");
        const $editor = $(editorRef.current);
        $editor.summernote({
          height: 300,
          placeholder: "Nhập nội dung thông báo...",
          toolbar: [
            ["style", ["style"]],
            ["font", ["bold", "italic", "underline", "clear"]],
            ["fontname", ["fontname"]],
            ["color", ["color"]],
            ["para", ["ul", "ol", "paragraph"]],
            ["insert", ["link", "picture", "table"]],
            ["view", ["codeview", "help"]],
          ],
          callbacks: {
            onChange: (contents: string) => {
              setPopupFields((prev) => ({ ...prev, html: contents }));
            },
          },
        });
        $editor.summernote("code", popupFields.html || "");
        setEditorReady(true);
      } catch (error) {
        setEditorReady(false);
        showError(error instanceof Error ? error.message : "Không thể tải Summernote.");
      }
    }

    setupEditor();

    return () => {
      disposed = true;
      const win = window as SummernoteWindow;
      const $ = win.jQuery || win.$;
      if (editorRef.current && $?.fn?.summernote) {
        try {
          $(editorRef.current).summernote("destroy");
        } catch {
          // Summernote can throw if it was never initialized.
        }
      }
    };
  }, [loading, activeTab]);

  const handleLogoFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError("Ảnh không được vượt quá 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoData(reader.result as string);
      setLogoDirty(true);
    };
    reader.readAsDataURL(file);
  };

  async function saveLanding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingLanding(true);
    try {
      const updated = await updateAdminLandingSettings(landing);
      setLanding(updated);
      showToast("Đã lưu cấu hình Landing.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu Landing.");
    } finally {
      setSavingLanding(false);
    }
  }

  async function saveBank(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBank(true);
    try {
      const payload: Partial<BankSetting> = {
        bank_code: bankFields.bank_code || "",
        bank_name: bankFields.bank_name || "",
        account_number: bankFields.account_number || "",
        account_name: bankFields.account_name || "",
        branch: bankFields.branch || "",
        transfer_prefix: bankFields.transfer_prefix || "",
        history_api_url: "",
        mb_username: bankFields.mb_username || "",
        min_amount: Number(bankFields.min_amount || 0),
        max_amount: Number(bankFields.max_amount || 0),
      };
      if (bankFields.mb_password) payload.mb_password = bankFields.mb_password;
      (payload as Partial<BankSetting> & { check_mb_login: boolean }).check_mb_login = true;
      if (logoDirty) payload.logo_data = logoData;
      const updated = await updateAdminBankSetting(payload);
      setBank(updated);
      setBankFields((prev) => ({ ...prev, mb_password: "" }));
      setLogoDirty(false);
      setLogoData(updated.logo_data || logoData);
      showToast("Đã lưu cấu hình Bank.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu Bank.");
    } finally {
      setSavingBank(false);
    }
  }

  async function saveMail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingMail(true);
    try {
      const updated = await updateAdminMailSetting({
        smtp_host: mailFields.smtp_host,
        smtp_port: Number(mailFields.smtp_port || 465),
        smtp_secure: Boolean(mailFields.smtp_secure),
        smtp_user: mailFields.smtp_user,
        smtp_pass: mailFields.smtp_pass || undefined,
        from_name: mailFields.from_name,
        from_email: mailFields.from_email || mailFields.smtp_user,
        is_enabled: Boolean(mailFields.is_enabled),
      });
      setMailFields({ ...updated, smtp_pass: "" });
      showToast("Đã lưu cấu hình Mail.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu Mail.");
    } finally {
      setSavingMail(false);
    }
  }

  async function saveAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAuth(true);
    try {
      const updated = await updateAdminAuthSettings(authFields);
      setAuthFields(updated);
      showToast("Đã lưu cấu hình Auth.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu Auth.");
    } finally {
      setSavingAuth(false);
    }
  }

  async function savePopup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPopup(true);
    try {
      const updated = await updateAdminDashboardPopup(popupFields);
      setPopupFields({ enabled: updated.enabled, title: updated.title, html: updated.html });
      showToast("Đã lưu Popup Dashboard.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu Popup Dashboard.");
    } finally {
      setSavingPopup(false);
    }
  }

  async function onSendTestMail() {
    setTestingMail(true);
    try {
      const payload = await sendAdminMailTest(testEmail);
      showToast(payload.message || "Đã gửi email test.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể gửi email test.");
    } finally {
      setTestingMail(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cài đặt website...</div>
      </div>
    );
  }

  const previewPoster = landing.demo_poster_url || "/dashboard-preview.png";
  const youtubeEmbedUrl = getYouTubeEmbedUrl(landing.demo_video_url);
  return (
    <div>
      <SectionTitle
        title="Cài đặt website"
        description="Gộp toàn bộ cấu hình Landing, Bank, Mail, Auth và Popup Dashboard vào một nơi."
      />

      <div className="cpanel-card" style={{ marginBottom: 20 }}>
        <div className="cpanel-card-body">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`cpanel-btn ${activeTab === tab.key ? "cpanel-btn-red" : "cpanel-btn-secondary"}`}
                style={{
                  justifyContent: "center",
                  minHeight: 48,
                  borderRadius: 12,
                  opacity: activeTab === tab.key ? 1 : 0.88,
                }}
              >
                <Icon name={tab.icon} size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "landing" ? (
      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Cấu hình Landing</h2>
          <span className={`cpanel-status-pill ${landing.demo_video_url ? "green" : "orange"}`}>
            {landing.demo_video_url ? "Đang dùng video" : "Đang dùng ảnh fallback"}
          </span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={saveLanding}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 520px)", alignItems: "start" }}>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="cpanel-field">
                  <label>URL/path video demo</label>
                  <input className="cpanel-input" value={landing.demo_video_url} onChange={(event) => setLanding((prev) => ({ ...prev, demo_video_url: event.target.value }))} placeholder="/videos/landing-demo.mp4 hoặc https://..." />
                </div>
                <div className="cpanel-field">
                  <label>Ảnh poster/fallback</label>
                  <input className="cpanel-input" value={landing.demo_poster_url} onChange={(event) => setLanding((prev) => ({ ...prev, demo_poster_url: event.target.value }))} placeholder="/dashboard-preview.png" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="cpanel-btn cpanel-btn-red" disabled={savingLanding} type="submit">
                    <Icon name="check" size={16} /> {savingLanding ? "Đang lưu..." : "Lưu Landing"}
                  </button>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 8, color: "#18181b", fontSize: 13, fontWeight: 900 }}>Preview</div>
                <div style={{ overflow: "hidden", border: "1px solid #e4e4e7", borderRadius: 12, background: "#111111", aspectRatio: "16 / 9" }}>
                  {youtubeEmbedUrl ? (
                    <iframe key={youtubeEmbedUrl} src={youtubeEmbedUrl} title="Landing YouTube preview" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ display: "block", width: "100%", height: "100%", border: 0 }} />
                  ) : landing.demo_video_url ? (
                    <video key={landing.demo_video_url} src={landing.demo_video_url} poster={previewPoster} autoPlay muted loop playsInline controls style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewPoster} alt="Landing preview" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      ) : null}

      {activeTab === "bank" ? (
      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Cấu hình Bank</h2>
          <span className="cpanel-status-pill orange">MB Bank</span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={saveBank}>
            <div className="cpanel-field" style={{ marginBottom: 16 }}>
              <label>Logo Ngân hàng</label>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div
                  style={{ width: 72, height: 72, borderRadius: 8, background: "#ffffff", border: "2px dashed #e4e4e7", display: "grid", placeItems: "center", overflow: "hidden", cursor: "pointer" }}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoData} alt="Logo Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#047857" }}>{bankFields.bank_code?.slice(0, 3).toUpperCase() || "VCB"}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="cpanel-btn cpanel-btn-secondary" onClick={() => logoInputRef.current?.click()} disabled={savingBank} style={{ height: 36 }}>
                      <Icon name="upload" size={14} /> Chọn ảnh logo
                    </button>
                    {logoData && (
                      <button type="button" className="cpanel-btn cpanel-btn-secondary" onClick={() => { setLogoData(null); setLogoDirty(true); }} disabled={savingBank} style={{ height: 36, color: "#ef4444" }}>
                        <Icon name="delete" size={14} /> Xóa logo
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#71717a" }}>Chấp nhận JPG, PNG, WEBP, SVG. Dung lượng tối đa 2MB.</span>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
            </div>

            <div
              style={{
                marginBottom: 16,
                padding: 12,
                border: "1px solid #e4e4e7",
                borderRadius: 10,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className={`cpanel-status-pill ${bank?.bank_status === "active" ? "green" : bank?.bank_status === "error" ? "red" : "orange"}`} style={{ fontSize: 10, padding: "2px 8px" }}>
                    • {bank?.bank_status === "active" ? "Bank đang hoạt động" : bank?.bank_status === "error" ? "Bank lỗi đăng nhập" : "Bank chưa kích hoạt"}
                  </span>
                  {bank?.bank_last_checked_at ? <span style={{ fontSize: 11, color: "#71717a" }}>Kiểm tra cuối: {bank.bank_last_checked_at}</span> : null}
                </div>
                {bank?.bank_last_error ? <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{bank.bank_last_error}</div> : null}
                <div style={{ fontSize: 12, color: "#71717a", fontWeight: 700 }}>Số tiền hiện có trong bank</div>
                <strong style={{ fontSize: 22, color: "#047857" }}>{formatVnd(bank?.bank_balance)}</strong>
              </div>
              {bank?.bank_balance_updated_at ? (
                <span style={{ fontSize: 11, color: "#71717a" }}>Cập nhật: {bank.bank_balance_updated_at}</span>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className="cpanel-field"><label>Bank code</label><input className="cpanel-input" value={bankFields.bank_code || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, bank_code: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Tên bank</label><input className="cpanel-input" value={bankFields.bank_name || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, bank_name: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Số tài khoản</label><input className="cpanel-input" value={bankFields.account_number || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, account_number: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Tên chủ tài khoản</label><input className="cpanel-input" value={bankFields.account_name || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, account_name: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Chi nhánh</label><input className="cpanel-input" value={bankFields.branch || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, branch: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Prefix chuyển khoản</label><input className="cpanel-input" value={bankFields.transfer_prefix || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, transfer_prefix: event.target.value }))} /></div>
              <div className="cpanel-field"><label>MB Username</label><input className="cpanel-input" value={bankFields.mb_username || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, mb_username: event.target.value }))} /></div>
              <div className="cpanel-field"><label>MB Password</label><input className="cpanel-input" type="password" value={bankFields.mb_password || ""} onChange={(event) => setBankFields((prev) => ({ ...prev, mb_password: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Min amount</label><input className="cpanel-input" type="number" value={bankFields.min_amount || 0} onChange={(event) => setBankFields((prev) => ({ ...prev, min_amount: Number(event.target.value) }))} /></div>
              <div className="cpanel-field"><label>Max amount</label><input className="cpanel-input" type="number" value={bankFields.max_amount || 0} onChange={(event) => setBankFields((prev) => ({ ...prev, max_amount: Number(event.target.value) }))} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <span style={{ color: "#71717a", fontSize: 12 }}>Đang kiểm tra đăng nhập MB Bank khi lưu.</span>
              <button className="cpanel-btn cpanel-btn-red" disabled={savingBank} type="submit">
                <Icon name="check" size={16} /> {savingBank ? "Đang lưu..." : "Lưu Bank"}
              </button>
            </div>
          </form>
        </div>
      </div>
      ) : null}

      {activeTab === "mail" ? (
      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Cấu hình Mail</h2>
          <span className={`cpanel-status-pill ${mailFields.is_enabled ? "green" : "red"}`}>{mailFields.is_enabled ? "Đang bật" : "Đang tắt"}</span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={saveMail}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className="cpanel-field"><label>SMTP Host</label><input className="cpanel-input" value={mailFields.smtp_host} onChange={(event) => setMailFields((prev) => ({ ...prev, smtp_host: event.target.value }))} /></div>
              <div className="cpanel-field"><label>SMTP Port</label><input className="cpanel-input" type="number" value={mailFields.smtp_port} onChange={(event) => setMailFields((prev) => ({ ...prev, smtp_port: Number(event.target.value) }))} /></div>
              <div className="cpanel-field"><label>Gmail gửi mail</label><input className="cpanel-input" type="email" value={mailFields.smtp_user} onChange={(event) => setMailFields((prev) => ({ ...prev, smtp_user: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Gmail App Password</label><input className="cpanel-input" type="password" value={mailFields.smtp_pass || ""} onChange={(event) => setMailFields((prev) => ({ ...prev, smtp_pass: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Tên người gửi</label><input className="cpanel-input" value={mailFields.from_name} onChange={(event) => setMailFields((prev) => ({ ...prev, from_name: event.target.value }))} /></div>
              <div className="cpanel-field"><label>Email hiển thị</label><input className="cpanel-input" type="email" value={mailFields.from_email} onChange={(event) => setMailFields((prev) => ({ ...prev, from_email: event.target.value }))} /></div>
            </div>
            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#18181b", fontWeight: 800 }}>
                <input type="checkbox" checked={mailFields.smtp_secure} onChange={(event) => setMailFields((prev) => ({ ...prev, smtp_secure: event.target.checked }))} />
                Dùng SSL/TLS
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#18181b", fontWeight: 800 }}>
                <input type="checkbox" checked={mailFields.is_enabled} onChange={(event) => setMailFields((prev) => ({ ...prev, is_enabled: event.target.checked }))} />
                Bật gửi mã xác thực khi đăng ký
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <div className="cpanel-field" style={{ flex: "1 1 280px" }}>
                <label>Email nhận test</label>
                <input className="cpanel-input" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="cpanel-btn cpanel-btn-secondary" type="button" disabled={testingMail} onClick={onSendTestMail}>
                  <Icon name="mail" size={16} /> {testingMail ? "Đang gửi..." : "Gửi email test"}
                </button>
                <button className="cpanel-btn cpanel-btn-red" disabled={savingMail} type="submit">
                  <Icon name="check" size={16} /> {savingMail ? "Đang lưu..." : "Lưu Mail"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      ) : null}

      {activeTab === "auth" ? (
      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Quản lý Auth</h2>
          <span className="cpanel-status-pill orange">Google / Facebook</span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={saveAuth}>
            <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 16 }}>
              <div className="cpanel-card-header" style={{ marginBottom: 8 }}>
                <div>
                  <h2>Gói free 3 ngày khi đăng ký</h2>
                  <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                    Khi bật, tài khoản mới sẽ tự nhận gói dùng thử 3 ngày sau khi đăng ký thành công.
                  </p>
                </div>
                <label className={`cpanel-status-pill ${authFields.registration_trial_enabled ? "green" : "red"}`} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={authFields.registration_trial_enabled}
                    onChange={(event) => setAuthFields((prev) => ({ ...prev, registration_trial_enabled: event.target.checked }))}
                    style={{ marginRight: 8 }}
                  />
                  {authFields.registration_trial_enabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
            </section>

            <div className="cpanel-field" style={{ marginBottom: 16 }}>
              <label>Frontend callback URL</label>
              <input className="cpanel-input" value={authFields.frontend_callback_url} onChange={(event) => setAuthFields((prev) => ({ ...prev, frontend_callback_url: event.target.value }))} placeholder="https://your-domain.com/auth/oauth/callback" />
            </div>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff" }}>
                <div className="cpanel-card-header" style={{ marginBottom: 12 }}>
                  <h2>Google OAuth</h2>
                  <label className="cpanel-status-pill green" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={authFields.google.enabled} onChange={(event) => setAuthFields((prev) => ({ ...prev, google: { ...prev.google, enabled: event.target.checked } }))} style={{ marginRight: 8 }} />
                    {authFields.google.enabled ? "Đang bật" : "Đang tắt"}
                  </label>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="cpanel-field"><label>Client ID</label><input className="cpanel-input" value={authFields.google.client_id} onChange={(event) => setAuthFields((prev) => ({ ...prev, google: { ...prev.google, client_id: event.target.value } }))} /></div>
                  <div className="cpanel-field"><label>Client Secret</label><input className="cpanel-input" type="password" value={authFields.google.client_secret} onChange={(event) => setAuthFields((prev) => ({ ...prev, google: { ...prev.google, client_secret: event.target.value } }))} /></div>
                  <div className="cpanel-field"><label>Redirect URI</label><input className="cpanel-input" value={authFields.google.redirect_uri} onChange={(event) => setAuthFields((prev) => ({ ...prev, google: { ...prev.google, redirect_uri: event.target.value } }))} /></div>
                </div>
              </section>
              <section style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 16, background: "#fff" }}>
                <div className="cpanel-card-header" style={{ marginBottom: 12 }}>
                  <h2>Facebook OAuth</h2>
                  <label className="cpanel-status-pill blue" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={authFields.facebook.enabled} onChange={(event) => setAuthFields((prev) => ({ ...prev, facebook: { ...prev.facebook, enabled: event.target.checked } }))} style={{ marginRight: 8 }} />
                    {authFields.facebook.enabled ? "Đang bật" : "Đang tắt"}
                  </label>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="cpanel-field"><label>App ID</label><input className="cpanel-input" value={authFields.facebook.app_id} onChange={(event) => setAuthFields((prev) => ({ ...prev, facebook: { ...prev.facebook, app_id: event.target.value } }))} /></div>
                  <div className="cpanel-field"><label>App Secret</label><input className="cpanel-input" type="password" value={authFields.facebook.app_secret} onChange={(event) => setAuthFields((prev) => ({ ...prev, facebook: { ...prev.facebook, app_secret: event.target.value } }))} /></div>
                  <div className="cpanel-field"><label>Redirect URI</label><input className="cpanel-input" value={authFields.facebook.redirect_uri} onChange={(event) => setAuthFields((prev) => ({ ...prev, facebook: { ...prev.facebook, redirect_uri: event.target.value } }))} /></div>
                </div>
              </section>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="cpanel-btn cpanel-btn-red" disabled={savingAuth} type="submit">
                <Icon name="check" size={16} /> {savingAuth ? "Đang lưu..." : "Lưu Auth"}
              </button>
            </div>
          </form>
        </div>
      </div>
      ) : null}

      {activeTab === "popup" ? (
        <div className="cpanel-card">
          <div className="cpanel-card-header">
            <h2>Popup Dashboard</h2>
            <span className={`cpanel-status-pill ${popupFields.enabled ? "green" : "orange"}`}>{popupFields.enabled ? "Đang Bật" : "Đang Tắt"}</span>
          </div>
          <div className="cpanel-card-body">
            <form onSubmit={savePopup}>
              <div className="dashboard-popup-admin-grid">
                <div className="dashboard-popup-admin-form">
                  <label className="cpanel-toggle-row">
                    <input
                      type="checkbox"
                      checked={popupFields.enabled}
                      onChange={(event) => setPopupFields((prev) => ({ ...prev, enabled: event.target.checked }))}
                    />
                    <span>Bật popup trên dashboard</span>
                  </label>

                  <div className="cpanel-field">
                    <label>Tiêu đề popup</label>
                    <input
                      className="cpanel-input"
                      value={popupFields.title}
                      onChange={(event) => setPopupFields((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Thông báo"
                    />
                  </div>

                  <div className="cpanel-field">
                    <label>Nội dung</label>
                    <textarea
                      ref={editorRef}
                      className="cpanel-textarea"
                      defaultValue={popupFields.html}
                      onChange={(event) => setPopupFields((prev) => ({ ...prev, html: event.target.value }))}
                    />
                    <p className="dashboard-popup-admin-note">
                      {editorReady ? "Đang dùng Summernote để định dạng nội dung." : "Đang tải trình soạn thảo Summernote..."}
                    </p>
                  </div>

                  <div className="dashboard-popup-admin-actions">
                    <button
                      className="cpanel-btn cpanel-btn-secondary"
                      type="button"
                      disabled={savingPopup}
                      onClick={() => setPopupFields(defaultPopupFields)}
                    >
                      <Icon name="update" size={16} /> Xóa nội dung
                    </button>
                    <button className="cpanel-btn cpanel-btn-red" disabled={savingPopup} type="submit">
                      <Icon name="check" size={16} /> {savingPopup ? "Đang lưu..." : "Lưu popup"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="dashboard-popup-admin-preview-label">Preview</div>
                  <div className="dashboard-popup-admin-preview">
                    <h3>{popupFields.title || "Thông báo"}</h3>
                    <div dangerouslySetInnerHTML={{ __html: popupFields.html || "<p>Chưa có nội dung.</p>" }} />
                    <div className="dashboard-popup-preview-footer">
                      <button className="btn btn-secondary" type="button">
                        <Icon name="notifications" size={16} /> Tắt trong 2 tiếng
                      </button>
                      <button className="btn btn-primary" type="button">
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
