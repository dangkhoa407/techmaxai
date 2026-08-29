"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components";
import {
  fetchAdminDashboardPopup,
  updateAdminDashboardPopup,
  type DashboardPopupSettings,
} from "../../lib/auth";
import { showError, showToast } from "../../lib/swal";

type SummernoteWindow = Window & {
  jQuery?: any;
  $?: any;
};

const defaultFields: Pick<DashboardPopupSettings, "enabled" | "title" | "html"> = {
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

export default function AdminDashboardPopupPage() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [fields, setFields] = useState(defaultFields);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    fetchAdminDashboardPopup()
      .then((popup) => setFields({ ...defaultFields, ...popup }))
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải thông báo dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !editorRef.current) return;
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
              setFields((prev) => ({ ...prev, html: contents }));
            },
          },
        });
        $editor.summernote("code", fields.html || "");
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
  }, [loading]);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      let html = fields.html;
      const win = window as SummernoteWindow;
      const $ = win.jQuery || win.$;
      if (editorRef.current && $?.fn?.summernote) {
        html = $(editorRef.current).summernote("code");
      }
      const updated = await updateAdminDashboardPopup({
        enabled: fields.enabled,
        title: fields.title.trim() || "Thông báo",
        html,
      });
      setFields({ ...defaultFields, ...updated });
      showToast("Đã lưu popup dashboard.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu popup dashboard.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải popup dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Popup Dashboard</h1>
        <p>Soạn thông báo HTML hiển thị cho khách hàng ở trang dashboard.</p>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Nội dung thông báo</h2>
          <span className={`cpanel-status-pill ${fields.enabled ? "green" : "orange"}`}>
            {fields.enabled ? "Đang bật" : "Đang tắt"}
          </span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={onSave}>
            <div className="dashboard-popup-admin-grid">
              <div className="dashboard-popup-admin-form">
                <label className="cpanel-toggle-row">
                  <input
                    type="checkbox"
                    checked={fields.enabled}
                    onChange={(event) => setFields((prev) => ({ ...prev, enabled: event.target.checked }))}
                  />
                  <span>Bật popup trên dashboard</span>
                </label>

                <div className="cpanel-field">
                  <label>Tiêu đề popup</label>
                  <input
                    className="cpanel-input"
                    value={fields.title}
                    onChange={(event) => setFields((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Thông báo"
                  />
                </div>

                <div className="cpanel-field">
                  <label>Nội dung</label>
                  <textarea
                    ref={editorRef}
                    className="cpanel-textarea"
                    defaultValue={fields.html}
                    onChange={(event) => setFields((prev) => ({ ...prev, html: event.target.value }))}
                  />
                  <p className="dashboard-popup-admin-note">
                    {editorReady ? "Đang dùng Summernote để định dạng nội dung." : "Đang tải trình soạn thảo Summernote..."}
                  </p>
                </div>

                <div className="dashboard-popup-admin-actions">
                  <button
                    className="cpanel-btn cpanel-btn-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => setFields(defaultFields)}
                  >
                    <Icon name="update" size={16} /> Xóa nội dung
                  </button>
                  <button className="cpanel-btn cpanel-btn-red" disabled={saving} type="submit">
                    <Icon name="check" size={16} /> {saving ? "Đang lưu..." : "Lưu popup"}
                  </button>
                </div>
              </div>

              <div>
                <div className="dashboard-popup-admin-preview-label">Preview</div>
                <div className="dashboard-popup-admin-preview">
                  <h3>{fields.title || "Thông báo"}</h3>
                  <div dangerouslySetInnerHTML={{ __html: fields.html || "<p>Chưa có nội dung.</p>" }} />
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
    </div>
  );
}
