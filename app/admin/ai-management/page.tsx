"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components";
import {
  addAdminAiKey,
  deleteAdminAiKey,
  fetchAdminAi,
  fetchGeminiAiModels,
  fetchPuterAiModels,
  saveAdminAiModels,
  updateAdminAiKey,
  type AiApiKey,
  type PuterAiModel,
} from "../../lib/auth";
import { showConfirm, showToast, showError } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

type AiProvider = "puter" | "gemini";

function modelKey(model: PuterAiModel) {
  return safeText(model.puterId || model.model_id || model.id || model.name);
}

function safeText(value: unknown) {
  return String(value || "");
}

function formatNumber(value?: number | null) {
  if (!value) return "-";
  return Number(value).toLocaleString("vi-VN");
}

function providerLabel(provider: unknown) {
  const value = safeText(provider).toLowerCase();
  if (value === "gemini") return "Gemini";
  return "Puter";
}

function providerPillColor(provider: unknown) {
  const value = safeText(provider).toLowerCase();
  if (value === "gemini") return "blue";
  return "gray";
}

function shortErrorText(value?: string | null) {
  const text = safeText(value).trim();
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export default function AdminAiManagementPage() {
  const [keys, setKeys] = useState<AiApiKey[]>([]);
  const [selectedModels, setSelectedModels] = useState<PuterAiModel[]>([]);
  const [remoteModels, setRemoteModels] = useState<PuterAiModel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyProvider, setKeyProvider] = useState<AiProvider>("puter");
  const [keySearch, setKeySearch] = useState("");
  const [keyPage, setKeyPage] = useState(1);
  const [keyPageSize, setKeyPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [modelProviderSource, setModelProviderSource] = useState<AiProvider>("puter");
  const [provider, setProvider] = useState("all");
  const [modelPage, setModelPage] = useState(1);
  const [modelPageSize, setModelPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savingModels, setSavingModels] = useState(false);
  const [viewingKeyError, setViewingKeyError] = useState<AiApiKey | null>(null);

  useEffect(() => {
    fetchAdminAi()
      .then((data) => {
        setKeys(data.keys);
        setSelectedModels(data.selected_models);
        setSelectedIds(new Set(data.selected_models.map(modelKey)));
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải cấu hình AI.");
      })
      .finally(() => setLoading(false));
  }, []);

  const allModels = remoteModels.length ? remoteModels : selectedModels;
  const providers = useMemo(() => {
    const names = new Set(allModels.map((model) => safeText(model.provider)).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allModels]);

  const filteredModels = useMemo(() => {
    const term = safeText(search).trim().toLowerCase();
    return allModels.filter((model) => {
      const modelProvider = safeText(model.provider);
      const matchesProvider = provider === "all" || modelProvider === provider;
      const haystack = [model.name, model.puterId, model.id, model.provider].map(safeText).join(" ").toLowerCase();
      return matchesProvider && (!term || haystack.includes(term));
    });
  }, [allModels, provider, search]);
  const filteredKeys = useMemo(() => {
    const term = safeText(keySearch).trim().toLowerCase();
    if (!term) return keys;
    return keys.filter((key) => {
      const haystack = [key.provider, key.label, key.key_preview, key.status, key.last_error].map(safeText).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [keys, keySearch]);
  const paginatedKeys = paginate(filteredKeys, keyPage, keyPageSize);
  const paginatedModels = paginate(filteredModels, modelPage, modelPageSize);

  async function onAddKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey(true);
    try {
      const updatedKeys = await addAdminAiKey({ api_key: apiKey, label, provider: keyProvider });
      setKeys(updatedKeys);
      setApiKey("");
      setLabel("");
      showToast("Đã thêm API key AI.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể thêm API key.");
    } finally {
      setSavingKey(false);
    }
  }

  async function onToggleKey(key: AiApiKey) {
    try {
      const updatedKeys = await updateAdminAiKey(key.id, {
        status: key.status === "active" ? "inactive" : "active",
      });
      setKeys(updatedKeys);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật API key.");
    }
  }

  async function onDeleteKey(key: AiApiKey) {
    if (!(await showConfirm(`Xóa API key ${key.key_preview}?`))) return;
    try {
      const updatedKeys = await deleteAdminAiKey(key.id);
      setKeys(updatedKeys);
      showToast("Đã xóa API key AI.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa API key.");
    }
  }

  async function onFetchModels() {
    setFetchingModels(true);
    try {
      const data = modelProviderSource === "gemini"
        ? await fetchGeminiAiModels()
        : await fetchPuterAiModels();
      setRemoteModels(data.models);
      showToast(`Đã lấy ${data.models.length} model ${providerLabel(modelProviderSource)}${data.used_key ? ` bằng key ${data.used_key.key_preview}` : ""}.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lấy model AI.");
    } finally {
      setFetchingModels(false);
    }
  }

  async function onSaveModels() {
    setSavingModels(true);
    try {
      const byId = new Map<string, PuterAiModel>();
      for (const model of [...selectedModels, ...allModels]) byId.set(modelKey(model), model);
      const selected = Array.from(selectedIds).map((id) => byId.get(id)).filter(Boolean) as PuterAiModel[];
      const updatedModels = await saveAdminAiModels(selected);
      setSelectedModels(updatedModels);
      setSelectedIds(new Set(updatedModels.map(modelKey)));
      showToast(`Đã lưu ${updatedModels.length} model AI cho khách hàng.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu danh sách model AI.");
    } finally {
      setSavingModels(false);
    }
  }

  function toggleModel(model: PuterAiModel) {
    const id = modelKey(model);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisibleModels(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const model of paginatedModels) {
        const id = modelKey(model);
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cấu hình AI...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Quản lý AI</h1>
        <p>Lưu API key AI, lấy danh sách model và chọn model khách hàng được sử dụng.</p>
      </div>

      {/* Banners removed per toast request */}

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>API key AI</h2>
          <span className="cpanel-status-pill blue">{keys.filter((key) => key.status === "active").length} key đang bật</span>
        </div>
        <div className="cpanel-card-body">
          <form onSubmit={onAddKey}>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "end" }}>
              <div className="cpanel-field" style={{ marginBottom: 0 }}>
                <label>Tên ghi chú</label>
                <input className="cpanel-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="AI key 1" />
              </div>
              <div className="cpanel-field" style={{ marginBottom: 0 }}>
                <label>Nhà cung cấp</label>
                <select className="cpanel-select" value={keyProvider} onChange={(event) => setKeyProvider(event.target.value as AiProvider)}>
                  <option value="puter">Puter</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <div className="cpanel-field" style={{ marginBottom: 0 }}>
                <label>API key</label>
                <input className="cpanel-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={keyProvider === "gemini" ? "Gemini API key" : "Bearer token Puter"} />
              </div>
              <button className="cpanel-btn cpanel-btn-red" disabled={savingKey} type="submit">
                <Icon name="add" size={16} /> {savingKey ? "Đang thêm..." : "Thêm key"}
              </button>
            </div>
          </form>

          <div style={{ position: "relative", maxWidth: 360, marginTop: 18 }}>
            <input
              className="cpanel-input"
              value={keySearch}
              onChange={(event) => {
                setKeySearch(event.target.value);
                setKeyPage(1);
              }}
              placeholder="Tìm key, trạng thái, lỗi..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>

          <div className="cpanel-table-container" style={{ marginTop: 20 }}>
            <table className="cpanel-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Provider</th>
                  <th>Thứ tự</th>
                  <th>Lỗi</th>
                  <th>Dùng gần nhất</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.length ? paginatedKeys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <strong>{key.label || `Key #${key.id}`}</strong>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#71717a", marginTop: 2 }}>{key.key_preview}</div>
                    </td>
                    <td>
                      <span className={`cpanel-status-pill ${providerPillColor(key.provider)}`}>
                        {providerLabel(key.provider)}
                      </span>
                    </td>
                    <td>{key.sort_order}</td>
                    <td style={{ width: 260, maxWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ fontWeight: 800 }}>{key.fail_count}</span>
                        {key.last_error ? (
                          <button
                            className="cpanel-btn cpanel-btn-secondary"
                            style={{ height: 28, minWidth: 0, maxWidth: 190, padding: "0 10px", color: "#b91c1c", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            type="button"
                            title="Xem lỗi chi tiết"
                            onClick={() => setViewingKeyError(key)}
                          >
                            {shortErrorText(key.last_error)}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{key.last_used_at || "-"}</td>
                    <td>
                      <span className={`cpanel-status-pill ${key.status === "active" ? "green" : "red"}`}>
                        {key.status === "active" ? "Đang bật" : "Đang tắt"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 34 }} type="button" onClick={() => onToggleKey(key)}>
                          <Icon name="toggle_on" size={14} /> {key.status === "active" ? "Tắt" : "Bật"}
                        </button>
                        <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 34, color: "#b91c1c" }} type="button" onClick={() => onDeleteKey(key)}>
                          <Icon name="x" size={14} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#71717a" }}>Chưa có API key AI.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredKeys.length ? (
            <AdminPagination
              page={keyPage}
              pageSize={keyPageSize}
              total={filteredKeys.length}
              itemLabel="key"
              onPageChange={setKeyPage}
              onPageSizeChange={setKeyPageSize}
            />
          ) : null}
        </div>
      </div>

      {viewingKeyError ? (
        <div className="modal-backdrop" onClick={() => setViewingKeyError(null)}>
          <div className="confirm-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="between" style={{ alignItems: "flex-start", gap: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Chi tiết lỗi API key</h3>
                <p style={{ margin: "6px 0 0", color: "#71717a" }}>
                  {viewingKeyError.label || `Key #${viewingKeyError.id}`} · {viewingKeyError.key_preview}
                </p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setViewingKeyError(null)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div
              style={{
                marginTop: 18,
                maxHeight: "55vh",
                overflow: "auto",
                border: "1px solid #fee2e2",
                borderRadius: 10,
                background: "#fff7f7",
                color: "#b91c1c",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.55,
                padding: 14,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {viewingKeyError.last_error}
            </div>
          </div>
        </div>
      ) : null}

      <div className="cpanel-card" style={{ marginTop: 20 }}>
        <div className="cpanel-card-header">
          <h2>Model AI</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "nowrap", alignItems: "center" }}>
            <select className="cpanel-select" style={{ width: 180, flex: "0 0 180px" }} value={modelProviderSource} onChange={(event) => setModelProviderSource(event.target.value as AiProvider)}>
              <option value="puter">Puter</option>
              <option value="gemini">Gemini</option>
            </select>
            <button className="cpanel-btn cpanel-btn-red" style={{ whiteSpace: "nowrap" }} disabled={fetchingModels || !keys.some((key) => key.status === "active" && key.provider === modelProviderSource)} type="button" onClick={onFetchModels}>
              <Icon name="update" size={16} /> {fetchingModels ? "Đang lấy..." : `Lấy model ${providerLabel(modelProviderSource)}`}
            </button>
          </div>
        </div>
        <div className="cpanel-card-body">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "center", marginBottom: 16 }}>
            <input
              className="cpanel-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setModelPage(1);
              }}
              placeholder="Tìm theo tên, provider, model id..."
            />
            <select
              className="cpanel-select"
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
                setModelPage(1);
              }}
            >
              <option value="all">Tất cả provider</option>
              {providers.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={() => selectVisibleModels(true)}>
              <Icon name="check" size={16} /> Chọn trang này
            </button>
            <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={() => selectVisibleModels(false)}>
              <Icon name="x" size={16} /> Bỏ chọn trang này
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ color: "#71717a", fontWeight: 700 }}>
              Đang chọn <strong style={{ color: "#09090b" }}>{selectedIds.size}</strong> model. Hiển thị {filteredModels.length}/{allModels.length}.
            </div>
            <button className="cpanel-btn cpanel-btn-red" disabled={savingModels} type="button" onClick={onSaveModels}>
              <Icon name="check" size={16} /> {savingModels ? "Đang lưu..." : "Lưu model cho khách hàng"}
            </button>
          </div>

          <div className="cpanel-table-container">
            <table className="cpanel-table">
              <thead>
                <tr>
                  <th>Chọn</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Input</th>
                  <th>Context</th>
                  <th>Max tokens</th>
                  <th>Tool</th>
                  <th>Release</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.length ? paginatedModels.map((model) => {
                  const id = modelKey(model);
                  return (
                    <tr key={id}>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleModel(model)} />
                      </td>
                      <td>
                        <strong>{model.name}</strong>
                        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#71717a", marginTop: 2 }}>{model.puterId}</div>
                      </td>
                      <td>{model.provider || "-"}</td>
                      <td>{model.modalities?.input?.join(", ") || "-"}</td>
                      <td>{formatNumber(model.context)}</td>
                      <td>{formatNumber(model.max_tokens)}</td>
                      <td>
                        <span className={`cpanel-status-pill ${model.tool_call ? "green" : "blue"}`}>
                          {model.tool_call ? "Có" : "Không"}
                        </span>
                      </td>
                      <td>{model.release_date || "-"}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#71717a" }}>
                      Chưa có model. Hãy thêm API key rồi bấm lấy model AI.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredModels.length ? (
            <AdminPagination
              page={modelPage}
              pageSize={modelPageSize}
              total={filteredModels.length}
              itemLabel="model"
              onPageChange={setModelPage}
              onPageSizeChange={setModelPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
