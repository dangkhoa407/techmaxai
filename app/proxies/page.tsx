"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  checkUserProxyLive,
  createUserProxy,
  deleteUserProxy,
  fetchUserProxies,
  updateUserProxyStatus,
  type ProxyCheckResult,
  type UserProxy
} from "../lib/auth";
import { showConfirm, showError, showToast } from "../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function maskProxy(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?:\/\/)?([^:\s]+):(\d+):([^:\s]+):(.+)$/);
  if (!match) return trimmed;
  return `${match[1] || ""}${match[2]}:${match[3]}:${match[4]}:***`;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<UserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", proxy: "", note: "" });
  const [checkingIds, setCheckingIds] = useState<number[]>([]);
  const [checkResults, setCheckResults] = useState<Record<number, ProxyCheckResult>>({});

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return proxies;
    return proxies.filter((item) =>
      [item.name, item.proxy, item.note, item.status].some((value) => String(value || "").toLowerCase().includes(keyword))
    );
  }, [proxies, search]);

  const activeCount = proxies.filter((item) => item.status === "active").length;

  async function loadProxies() {
    setLoading(true);
    try {
      setProxies(await fetchUserProxies());
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải danh sách proxy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProxies();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      setProxies(await createUserProxy(form));
      setForm({ name: "", proxy: "", note: "" });
      setModalOpen(false);
      showToast("Đã thêm proxy.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể thêm proxy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(proxy: UserProxy) {
    try {
      const nextStatus = proxy.status === "active" ? "inactive" : "active";
      setProxies(await updateUserProxyStatus(proxy.id, nextStatus));
      showToast(nextStatus === "active" ? "Đã bật proxy." : "Đã tắt proxy.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật proxy.");
    }
  }

  async function handleDelete(proxy: UserProxy) {
    if (!(await showConfirm(`Xóa proxy "${proxy.name || proxy.proxy}"?`))) return;
    try {
      setProxies(await deleteUserProxy(proxy.id));
      showToast("Đã xóa proxy.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa proxy.");
    }
  }

  async function handleCheckLive(proxy: UserProxy) {
    if (checkingIds.includes(proxy.id)) return;
    setCheckingIds((current) => [...current, proxy.id]);
    try {
      const result = await checkUserProxyLive(proxy.id);
      setCheckResults((current) => ({ ...current, [proxy.id]: result }));
      if (result.live) {
        showToast(`Proxy live${result.ip ? `: ${result.ip}` : ""}.`);
      } else {
        showError(result.error || "Proxy die hoặc không kết nối được.");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể check live proxy.");
    } finally {
      setCheckingIds((current) => current.filter((id) => id !== proxy.id));
    }
  }

  return (
    <AppFrame active="/proxies" title="Proxy">
      <PageHeader
        title="Proxy"
        desc="Quản lý proxy dùng cho đăng nhập Zalo và tài khoản Auto Facebook."
        action={
          <button className="btn btn-red" type="button" onClick={() => setModalOpen(true)}>
            <Icon name="add" /> Thêm proxy
          </button>
        }
      />

      <div className="stack">
        <section className="grid-3">
          <StatCard label="Tổng proxy" value={String(proxies.length)} help="Proxy đã lưu" icon="vpn_lock" />
          <StatCard label="Đang bật" value={String(activeCount)} help="Có thể chọn để sử dụng" icon="toggle_on" />
          <StatCard label="Đang tắt" value={String(proxies.length - activeCount)} help="Không hiện trong lựa chọn" icon="person_off" />
        </section>

        <section className="card">
          <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ margin: 0 }}>Danh sách proxy</h2>
              <p className="subtitle">Proxy active sẽ xuất hiện khi thêm Zalo và cấu hình tài khoản Facebook Auto.</p>
            </div>
            <div className="row">
              <input className="input" placeholder="Tìm proxy..." style={{ width: 260 }} value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="btn btn-secondary" type="button" onClick={loadProxies} disabled={loading}>
                <Icon name="update" size={18} /> Làm mới
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="timer" size={54} />
              <p className="subtitle">Đang tải proxy...</p>
            </div>
          ) : filtered.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Proxy</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th>Live</th>
                    <th>Cập nhật</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((proxy) => (
                    <tr key={proxy.id}>
                      <td><strong>{proxy.name || `Proxy #${proxy.id}`}</strong></td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>{maskProxy(proxy.proxy)}</td>
                      <td>{proxy.note || "-"}</td>
                      <td>
                        <span className={`source-badge ${proxy.status === "active" ? "zalo" : "fanpage"}`}>
                          {proxy.status === "active" ? "Đang bật" : "Đang tắt"}
                        </span>
                      </td>
                      <td>
                        {checkResults[proxy.id] ? (
                          <div className="proxy-live-cell">
                            <span className={`source-badge ${checkResults[proxy.id].live ? "zalo" : "fanpage"}`}>
                              {checkResults[proxy.id].live ? "Live" : "Die"}
                            </span>
                            <span className="proxy-live-meta">
                              {checkResults[proxy.id].live
                                ? [checkResults[proxy.id].ip, checkResults[proxy.id].country, `${checkResults[proxy.id].latency_ms}ms`].filter(Boolean).join(" · ")
                                : checkResults[proxy.id].error || "Không kết nối được"}
                            </span>
                          </div>
                        ) : (
                          <span className="subtitle">Chưa check</span>
                        )}
                      </td>
                      <td>{formatDate(proxy.updated_at)}</td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn-secondary" type="button" onClick={() => handleCheckLive(proxy)} disabled={checkingIds.includes(proxy.id)}>
                            <Icon name={checkingIds.includes(proxy.id) ? "timer" : "check_circle"} size={16} /> {checkingIds.includes(proxy.id) ? "Đang check" : "Check"}
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={() => handleToggle(proxy)}>
                            <Icon name={proxy.status === "active" ? "pause" : "play"} size={16} /> {proxy.status === "active" ? "Tắt" : "Bật"}
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={() => handleDelete(proxy)}>
                            <Icon name="x" size={16} /> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="vpn_lock" size={54} />
              <p className="subtitle">Chưa có proxy nào.</p>
              <button className="btn btn-red" type="button" onClick={() => setModalOpen(true)}>
                <Icon name="add" /> Thêm proxy
              </button>
            </div>
          )}
        </section>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <form className="proxy-modal" role="dialog" aria-modal="true" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
            <div className="proxy-modal-header">
              <div>
                <h2>Thêm proxy</h2>
                <p className="subtitle">Hỗ trợ host:port hoặc protocol://host:port:user:pass.</p>
              </div>
              <button className="proxy-modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Đóng">
                <Icon name="x" />
              </button>
            </div>

            <label className="field">
              <span>Tên proxy</span>
              <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Proxy US 01" />
            </label>
            <label className="field">
              <span>Proxy</span>
              <input className="input" value={form.proxy} onChange={(event) => setForm((current) => ({ ...current, proxy: event.target.value }))} placeholder="host:port hoặc http://host:port:user:pass" required />
            </label>
            <label className="field">
              <span>Ghi chú</span>
              <input className="input" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Dùng cho Zalo/Facebook..." />
            </label>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)}>Hủy</button>
              <button className="btn btn-red" type="submit" disabled={saving || !form.proxy.trim()}>
                {saving ? "Đang lưu..." : "Thêm proxy"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppFrame>
  );
}
