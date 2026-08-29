"use client";

import { useEffect, useState } from "react";
import { Icon } from "../../components";
import {
  fetchAdminLandingSettings,
  updateAdminLandingSettings,
  type LandingSettings,
} from "../../lib/auth";
import { showError, showToast } from "../../lib/swal";

const defaultSettings: LandingSettings = {
  demo_video_url: "",
  demo_poster_url: "/dashboard-preview.png",
};

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

export default function AdminLandingSettingsPage() {
  const [fields, setFields] = useState<LandingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminLandingSettings()
      .then((settings) => setFields({ ...defaultSettings, ...settings }))
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải cấu hình landing.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await updateAdminLandingSettings({
        demo_video_url: fields.demo_video_url.trim(),
        demo_poster_url: fields.demo_poster_url.trim() || "/dashboard-preview.png",
      });
      setFields({ ...defaultSettings, ...updated });
      showToast("Đã lưu video demo landing page.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu cấu hình landing.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cấu hình landing...</div>
      </div>
    );
  }

  const previewPoster = fields.demo_poster_url || "/dashboard-preview.png";
  const youtubeEmbedUrl = getYouTubeEmbedUrl(fields.demo_video_url);

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Cấu hình Landing</h1>
        <p>Quản lý video demo hiển thị trong khung preview ở trang chủ.</p>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Video demo trang chủ</h2>
          <span className={`cpanel-status-pill ${fields.demo_video_url ? "green" : "orange"}`}>
            {fields.demo_video_url ? "Đang dùng video" : "Đang dùng ảnh fallback"}
          </span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={onSave}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 520px)", alignItems: "start" }}>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="cpanel-field">
                  <label>URL/path video demo</label>
                  <input
                    className="cpanel-input"
                    value={fields.demo_video_url}
                    onChange={(event) => setFields((prev) => ({ ...prev, demo_video_url: event.target.value }))}
                    placeholder="/videos/landing-demo.mp4 hoặc https://..."
                  />
                  <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                    Hỗ trợ path trong thư mục public như <strong>/videos/demo.mp4</strong> hoặc link video ngoài. Để trống sẽ dùng ảnh poster.
                  </p>
                </div>

                <div className="cpanel-field">
                  <label>Ảnh poster/fallback</label>
                  <input
                    className="cpanel-input"
                    value={fields.demo_poster_url}
                    onChange={(event) => setFields((prev) => ({ ...prev, demo_poster_url: event.target.value }))}
                    placeholder="/dashboard-preview.png"
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
              </div>

              <div>
                <div style={{ marginBottom: 8, color: "#18181b", fontSize: 13, fontWeight: 900 }}>Preview</div>
                <div
                  style={{
                    overflow: "hidden",
                    border: "1px solid #e4e4e7",
                    borderRadius: 12,
                    background: "#111111",
                    aspectRatio: "16 / 9",
                  }}
                >
                  {youtubeEmbedUrl ? (
                    <iframe
                      key={youtubeEmbedUrl}
                      src={youtubeEmbedUrl}
                      title="Landing YouTube preview"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      style={{ display: "block", width: "100%", height: "100%", border: 0 }}
                    />
                  ) : fields.demo_video_url ? (
                    <video
                      key={fields.demo_video_url}
                      src={fields.demo_video_url}
                      poster={previewPoster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                    />
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
    </div>
  );
}
