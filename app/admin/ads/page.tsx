"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createAdminSocialAd,
  deleteAdminSocialAd,
  fetchAdminSocialAds,
  reorderAdminSocialAds,
  updateAdminSocialAd,
  type SocialAd,
} from "../../lib/auth";
import { Icon } from "../../components";
import { showConfirm, showError, showToast } from "../../lib/swal";

type AdFields = {
  title: string;
  description: string;
  thumbnail_url: string;
  link_url: string;
  is_active: boolean;
};

const emptyFields: AdFields = {
  title: "",
  description: "",
  thumbnail_url: "",
  link_url: "",
  is_active: true,
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Khong the nap anh thumbnail."));
    image.src = dataUrl;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL("image/jpeg", quality));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}

async function compressThumbnailDataUrl(file: File) {
  const sourceDataUrl = await fileToDataUrl(file);

  const image = await loadImageFromDataUrl(sourceDataUrl);
  const maxEdge = 1600;
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return sourceDataUrl;
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.86;
  let dataUrl = await canvasToDataUrl(canvas, "image/webp", quality);
  while (dataUrl.length > 1_800_000 && quality > 0.55) {
    quality -= 0.08;
    dataUrl = await canvasToDataUrl(canvas, "image/webp", quality);
  }
  return dataUrl.length < sourceDataUrl.length ? dataUrl : sourceDataUrl;
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<SocialAd[]>([]);
  const [fields, setFields] = useState<AdFields>(emptyFields);
  const [selectedAd, setSelectedAd] = useState<SocialAd | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => ads.filter((ad) => ad.is_active).length, [ads]);
  const totalClicks = useMemo(() => ads.reduce((sum, ad) => sum + Number(ad.click_count || 0), 0), [ads]);

  useEffect(() => {
    loadAds();
  }, []);

  function loadAds() {
    setLoading(true);
    fetchAdminSocialAds()
      .then(setAds)
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải quảng cáo."))
      .finally(() => setLoading(false));
  }

  function openCreateModal() {
    setSelectedAd(null);
    setFields(emptyFields);
    setIsModalOpen(true);
  }

  function openEditModal(ad: SocialAd) {
    setSelectedAd(ad);
    setFields({
      title: ad.title || "",
      description: ad.description || "",
      thumbnail_url: ad.thumbnail_url || "",
      link_url: ad.link_url || "",
      is_active: Boolean(ad.is_active),
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  async function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ảnh thumbnail tối đa 5MB.");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressThumbnailDataUrl(file);
      setFields((current) => ({ ...current, thumbnail_url: dataUrl }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không đọc được ảnh.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.title.trim()) {
      showError("Vui lòng nhập tiêu đề quảng cáo.");
      return;
    }
    setSaving(true);
    try {
      const payload = selectedAd
        ? await updateAdminSocialAd(selectedAd.id, fields)
        : await createAdminSocialAd(fields);
      const typedPayload = payload as { message?: string; ad?: SocialAd };
      if (typedPayload.ad) {
        setAds((current) => {
          if (selectedAd) return current.map((ad) => (ad.id === selectedAd.id ? typedPayload.ad as SocialAd : ad));
          return [...current, typedPayload.ad as SocialAd].sort((left, right) => left.sort_order - right.sort_order || right.id - left.id);
        });
      } else {
        loadAds();
      }
      showToast(typedPayload.message || (selectedAd ? "Đã cập nhật quảng cáo." : "Đã thêm quảng cáo."));
      setIsModalOpen(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu quảng cáo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ad: SocialAd) {
    if (!(await showConfirm(`Xoá quảng cáo "${ad.title}"?`))) return;
    try {
      const payload = await deleteAdminSocialAd(ad.id);
      setAds((current) => current.filter((item) => item.id !== ad.id));
      showToast(payload.message || "Đã xoá quảng cáo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá quảng cáo.");
    }
  }

  async function handleToggle(ad: SocialAd) {
    try {
      const payload = await updateAdminSocialAd(ad.id, {
        title: ad.title,
        description: ad.description,
        thumbnail_url: ad.thumbnail_url,
        link_url: ad.link_url,
        is_active: !ad.is_active,
      }) as { message?: string; ad?: SocialAd };
      setAds((current) => current.map((item) => (item.id === ad.id ? payload.ad as SocialAd : item)));
      showToast(payload.message || "Đã cập nhật trạng thái quảng cáo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đổi trạng thái quảng cáo.");
    }
  }

  async function handleDrop(targetId: number) {
    if (!draggingId || draggingId === targetId) return;
    const draggingIndex = ads.findIndex((ad) => ad.id === draggingId);
    const targetIndex = ads.findIndex((ad) => ad.id === targetId);
    if (draggingIndex < 0 || targetIndex < 0) return;
    const nextAds = [...ads];
    const [dragged] = nextAds.splice(draggingIndex, 1);
    nextAds.splice(targetIndex, 0, dragged);
    setAds(nextAds);
    setDraggingId(null);
    try {
      const payload = await reorderAdminSocialAds(nextAds.map((ad) => ad.id)) as { message?: string; ads?: SocialAd[] };
      if (payload.ads) setAds(payload.ads);
      showToast(payload.message || "Đã cập nhật thứ tự quảng cáo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu thứ tự quảng cáo.");
      loadAds();
    }
  }

  return (
    <div className="cpanel-page admin-ads-page">
      <section className="admin-ads-hero">
        <div className="admin-ads-hero-top">
          <div>
            <h1>Quản lý Ads</h1>
            <p>Sắp xếp thứ tự hiển thị quảng cáo ở trang Mạng xã hội.</p>
          </div>
          <button className="cpanel-btn cpanel-btn-red" onClick={openCreateModal} type="button">
            <Icon name="add" size={18} /> Thêm quảng cáo
          </button>
        </div>

        <div className="admin-ads-stats" aria-label="Tổng quan quảng cáo">
          <div>
            <span>Tổng quảng cáo</span>
            <strong>{ads.length}</strong>
          </div>
          <div>
            <span>Đang bật</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Lượt click</span>
            <strong>{totalClicks.toLocaleString("vi-VN")}</strong>
          </div>
        </div>
      </section>

      <section className="cpanel-card">
        <div className="cpanel-card-head">
          <div>
            <h2>Danh sách quảng cáo</h2>
            <p>Kéo một dòng lên xuống để đổi thứ tự hiển thị ở Social.</p>
          </div>
        </div>

        <div className="cpanel-table-container">
          <table className="cpanel-table admin-ads-table">
            <thead>
              <tr>
                <th>Thứ tự</th>
                <th>Thumbnail</th>
                <th>Nội dung</th>
                <th>Link</th>
                <th>Lượt click</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Đang tải quảng cáo...</td></tr>
              ) : null}
              {!loading && !ads.length ? (
                <tr><td colSpan={7}>Chưa có quảng cáo nào.</td></tr>
              ) : null}
              {ads.map((ad, index) => (
                <tr
                  draggable
                  key={ad.id}
                  onDragStart={() => setDraggingId(ad.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(ad.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={draggingId === ad.id ? "dragging" : ""}
                >
                  <td>
                    <span className="admin-ad-drag-handle">::</span> #{index + 1}
                  </td>
                  <td>
                    {ad.thumbnail_url ? (
                      <img className="admin-ad-thumb" src={ad.thumbnail_url} alt={ad.title} />
                    ) : (
                      <div className="admin-ad-thumb empty"><Icon name="image" size={22} /></div>
                    )}
                  </td>
                  <td>
                    <strong>{ad.title}</strong>
                    <p>{ad.description || "Chưa có mô tả."}</p>
                  </td>
                  <td>{ad.link_url || "-"}</td>
                  <td>{Number(ad.click_count || 0).toLocaleString("vi-VN")}</td>
                  <td>
                    <span className={`cpanel-status-pill ${ad.is_active ? "green" : "gray"}`}>
                      {ad.is_active ? "Đang bật" : "Đã tắt"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-ad-actions">
                      <button className="cpanel-btn cpanel-btn-secondary" onClick={() => openEditModal(ad)} type="button">Sửa</button>
                      <button className="cpanel-btn cpanel-btn-secondary" onClick={() => handleToggle(ad)} type="button">
                        {ad.is_active ? "Tắt" : "Bật"}
                      </button>
                      <button className="cpanel-btn cpanel-btn-red" onClick={() => handleDelete(ad)} type="button">Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="admin-ads-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <form className="admin-ads-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{selectedAd ? "Sửa quảng cáo" : "Thêm quảng cáo"}</h2>
              <button onClick={closeModal} type="button" aria-label="Đóng">
                <Icon name="x" size={22} />
              </button>
            </header>

            <label className="field">
              <span>Tiêu đề</span>
              <input value={fields.title} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Mô tả</span>
              <textarea rows={4} value={fields.description} onChange={(event) => setFields((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="field">
              <span>Link khi nhấn nút</span>
              <input placeholder="https://... hoặc /duong-dan" value={fields.link_url} onChange={(event) => setFields((current) => ({ ...current, link_url: event.target.value }))} />
            </label>

            <div className="admin-ad-upload-row">
              {fields.thumbnail_url ? (
                <img className="admin-ad-preview" src={fields.thumbnail_url} alt="Preview thumbnail" />
              ) : (
                <div className="admin-ad-preview empty"><Icon name="image" size={30} /></div>
              )}
              <div>
                <label className="cpanel-btn cpanel-btn-secondary">
                  <Icon name="image" size={16} /> Chọn thumbnail
                  <input accept="image/*" onChange={handleThumbnailChange} type="file" />
                </label>
                <button className="cpanel-btn cpanel-btn-secondary" onClick={() => setFields((current) => ({ ...current, thumbnail_url: "" }))} type="button">
                  Bỏ ảnh
                </button>
              </div>
            </div>

            <label className="admin-ad-toggle">
              <input
                checked={fields.is_active}
                onChange={(event) => setFields((current) => ({ ...current, is_active: event.target.checked }))}
                type="checkbox"
              />
              <span>Hiển thị quảng cáo này trên Social</span>
            </label>

            <footer>
              <button className="cpanel-btn cpanel-btn-secondary" onClick={closeModal} type="button">Huỷ</button>
              <button className="cpanel-btn cpanel-btn-red" disabled={saving} type="submit">
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
