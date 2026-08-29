"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components";
import {
  createAdminServicePlan,
  deleteAdminServicePlan,
  fetchAdminServicePlans,
  fetchAdminServicePlanComparisonRows,
  formatVnd,
  updateAdminServicePlanComparisonRows,
  updateAdminServicePlan,
  type PuterAiModel,
  type ServicePlan,
  type ServicePlanComparisonRow,
} from "../../lib/auth";
import { showConfirm, showError, showToast } from "../../lib/swal";

const emptyPlan: Partial<ServicePlan> = {
  code: "",
  name: "",
  price: 0,
  days: 30,
  cycle: "tháng",
  description: "",
  bots: "",
  channels: "",
  messages: "",
  campaign_usage_limit: 0,
  campaign_usage_unlimited: false,
  automation_usage_limit: 0,
  automation_usage_unlimited: false,
  ai_model_ids: [],
  support: "",
  features: [
    { text: "1 bot AI", included: true },
    { text: "1 Zalo/Facebook", included: true },
    { text: "500 cuộc hội thoại AI/ngày", included: true },
    { text: "100 lượt chạy chiến dịch", included: true },
    { text: "100 lượt dùng Auto Facebook/Threads", included: true },
  ],
  popular: false,
  is_active: true,
  sort_order: 0,
};

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function aiModelSource(model: PuterAiModel) {
  const puterId = String(model.puterId || model.model_id || model.id || "").toLowerCase();
  return puterId.startsWith("gemini:") ? "Gemini" : "Puter";
}

function aiModelSourceTone(source: string) {
  return source === "Gemini" ? "blue" : "gray";
}

export default function AdminServicePlansPage() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [aiModels, setAiModels] = useState<PuterAiModel[]>([]);
  const [comparisonRows, setComparisonRows] = useState<ServicePlanComparisonRow[]>([]);
  const [fields, setFields] = useState<Partial<ServicePlan>>(emptyPlan);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingComparison, setSavingComparison] = useState(false);

  useEffect(() => {
    Promise.all([fetchAdminServicePlans(), fetchAdminServicePlanComparisonRows()])
      .then(([planPayload, comparison]) => {
        setPlans(planPayload.plans);
        setAiModels(planPayload.ai_models);
        setComparisonRows(comparison.length ? comparison : []);
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải dữ liệu gói.");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedId) || null, [plans, selectedId]);
  const comparisonPlans = useMemo(() => plans.filter((plan) => plan.is_active !== false), [plans]);

  function updateField<K extends keyof ServicePlan>(key: K, value: ServicePlan[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function toggleAiModel(modelId: number) {
    setFields((current) => {
      const ids = new Set((current.ai_model_ids || []).map(Number).filter(Boolean));
      if (ids.has(modelId)) ids.delete(modelId);
      else ids.add(modelId);
      return { ...current, ai_model_ids: Array.from(ids) };
    });
  }

  function createNew() {
    setSelectedId(null);
    setFields({ ...emptyPlan, features: [...(emptyPlan.features || [])] });
    setIsModalOpen(true);
  }

  function editPlan(plan: ServicePlan) {
    setSelectedId(plan.id);
    setFields({ ...plan, features: plan.features.map((feature) => ({ ...feature })) });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  function updateFeature(index: number, key: "text" | "included", value: string | boolean) {
    const features = [...(fields.features || [])];
    features[index] = { text: features[index]?.text || "", included: Boolean(features[index]?.included), [key]: value };
    setFields((current) => ({ ...current, features }));
  }

  function addFeature() {
    setFields((current) => ({
      ...current,
      features: [...(current.features || []), { text: "", included: true }],
    }));
  }

  function removeFeature(index: number) {
    setFields((current) => ({
      ...current,
      features: (current.features || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addComparisonRow() {
    const row: ServicePlanComparisonRow = { feature: "" };
    comparisonPlans.forEach((plan) => {
      row[plan.code] = "";
    });
    setComparisonRows((current) => [
      ...current,
      row,
    ]);
  }

  function updateComparisonRow(index: number, key: keyof ServicePlanComparisonRow, value: string) {
    setComparisonRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function removeComparisonRow(index: number) {
    setComparisonRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function savePlan() {
    setSaving(true);
    try {
      const payload = {
        ...fields,
        code: fields.code || slugify(fields.name || ""),
        price: Number(fields.price || 0),
        days: Number(fields.days || 30),
        sort_order: Number(fields.sort_order || 0),
        bots: digitsOnly(String(fields.bots || "")),
        channels: digitsOnly(String(fields.channels || "")),
        messages: digitsOnly(String(fields.messages || "")),
        ai_model_ids: (fields.ai_model_ids || []).map(Number).filter(Boolean),
      };
      const saved = selectedId
        ? await updateAdminServicePlan(selectedId, payload)
        : await createAdminServicePlan(payload);
      setPlans((current) => {
        const exists = current.some((plan) => plan.id === saved.id);
        return exists
          ? current.map((plan) => (plan.id === saved.id ? saved : plan)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
          : [...current, saved].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      });
      setSelectedId(saved.id);
      setFields({ ...saved, features: saved.features.map((feature) => ({ ...feature })) });
      setIsModalOpen(false);
      showToast(selectedId ? "Đã cập nhật gói dịch vụ." : "Đã tạo gói dịch vụ.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu gói dịch vụ.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan: ServicePlan) {
    if (!(await showConfirm(`Xoá ${plan.name}?`))) return;
    try {
      const successMessage = await deleteAdminServicePlan(plan.id);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      if (selectedId === plan.id) {
        setSelectedId(null);
        setFields({ ...emptyPlan, features: [...(emptyPlan.features || [])] });
        setIsModalOpen(false);
      }
      showToast(successMessage);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá gói dịch vụ.");
    }
  }

  async function saveComparisonRows() {
    setSavingComparison(true);
    try {
      const rows = comparisonRows
        .map((row) => {
          const normalized: ServicePlanComparisonRow = { feature: (row.feature || "").trim() };
          comparisonPlans.forEach((plan) => {
            normalized[plan.code] = (row[plan.code] || "").trim();
          });
          return normalized;
        })
        .filter((row) => row.feature);
      const savedRows = await updateAdminServicePlanComparisonRows(rows);
      setComparisonRows(savedRows);
      showToast("Đã cập nhật bảng quyền lợi.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu bảng quyền lợi.");
    } finally {
      setSavingComparison(false);
    }
  }

  if (loading) {
    return <div className="cpanel-card" style={{ padding: 24, fontWeight: 800 }}>Đang tải gói dịch vụ...</div>;
  }

  return (
    <div>
      <div className="cpanel-card-header" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Quản lý gói dịch vụ</h1>
          <p style={{ margin: "6px 0 0", color: "#71717a" }}>Chỉ hiển thị danh sách gói dạng bảng để dễ chỉnh sửa và xoá.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-red" type="button" onClick={createNew}>
          <Icon name="add" size={16} /> Thêm gói
        </button>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Danh sách gói</h2>
          <span className="cpanel-status-pill blue">{plans.length} gói</span>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {plans.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Tên gói</th>
                    <th>Mã gói</th>
                    <th>Giá</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{plan.name}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{plan.description || "Chưa có mô tả"}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: "#52525b" }}>{plan.code}</td>
                      <td style={{ fontWeight: 900 }}>{formatVnd(plan.price)}/{plan.cycle}</td>
                      <td>
                        <span className={`cpanel-status-pill ${plan.is_active ? "green" : "gray"}`}>
                          {plan.is_active ? "Đang bật" : "Đã tắt"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => editPlan(plan)}>
                            <Icon name="edit_note" size={14} /> Sửa
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => deletePlan(plan)}>
                            <Icon name="delete" size={14} /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Chưa có gói dịch vụ nào.</div>
          )}
        </div>
      </div>

      <div className="cpanel-card" style={{ marginTop: 18 }}>
        <div className="cpanel-card-header">
          <div>
            <h2>Bảng so sánh quyền lợi</h2>
            <p style={{ margin: "4px 0 0", color: "#71717a", fontSize: 13 }}>Chỉnh nội dung hiển thị ở bảng so sánh trên landing page và trang gói dịch vụ.</p>
          </div>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={addComparisonRow}>
              <Icon name="add" size={14} /> Thêm dòng
            </button>
            <button className="cpanel-btn cpanel-btn-red" type="button" disabled={savingComparison} onClick={saveComparisonRows}>
              <Icon name="check" size={14} /> {savingComparison ? "Đang lưu..." : "Lưu bảng"}
            </button>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          <div className="cpanel-table-container">
            <table className="cpanel-table">
              <thead>
                <tr>
                  <th>Tính năng</th>
                  {comparisonPlans.map((plan) => (
                    <th key={plan.id || plan.code}>{plan.name}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.length ? (
                  comparisonRows.map((row, index) => (
                    <tr key={`${row.feature || "row"}-${index}`}>
                      <td><input className="cpanel-input" value={row.feature} onChange={(event) => updateComparisonRow(index, "feature", event.target.value)} placeholder="Ví dụ: Số bot AI" /></td>
                      {comparisonPlans.map((plan) => (
                        <td key={`${row.feature || "row"}-${plan.id || plan.code}`}>
                          <input
                            className="cpanel-input"
                            value={row[plan.code] || ""}
                            onChange={(event) => updateComparisonRow(index, plan.code, event.target.value)}
                            placeholder={`Giá trị cho ${plan.name}`}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "right" }}>
                        <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => removeComparisonRow(index)}>
                          <Icon name="delete" size={14} /> Xoá
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={comparisonPlans.length + 2} style={{ padding: 24, textAlign: "center", color: "#71717a" }}>
                      Chưa có dòng so sánh nào. Nhấn "Thêm dòng" để bắt đầu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <form
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-plan-modal-title"
            style={{ width: "min(1080px, 100%)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              savePlan();
            }}
          >
            <div className="between">
              <div>
                <span className="eyebrow">{selectedPlan ? "Chỉnh sửa gói" : "Thêm gói mới"}</span>
                <h2 id="service-plan-modal-title">{selectedPlan ? selectedPlan.name : "Tạo gói dịch vụ"}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={closeModal} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="cpanel-card-body" style={{ padding: "18px 0 0", display: "grid", gap: 14 }}>
              <div className="grid-2">
                <label><span>Tên gói</span><input className="cpanel-input" value={fields.name || ""} onChange={(event) => updateField("name", event.target.value)} /></label>
                <label><span>Mã gói</span><input className="cpanel-input" value={fields.code || ""} onChange={(event) => updateField("code", slugify(event.target.value))} placeholder="starter" /></label>
                <label><span>Giá</span><input className="cpanel-input" type="number" value={fields.price || 0} onChange={(event) => updateField("price", Number(event.target.value || 0))} /></label>
                <label><span>Số ngày</span><input className="cpanel-input" type="number" value={fields.days || 30} onChange={(event) => updateField("days", Number(event.target.value || 30))} /></label>
                <label><span>Chu kỳ hiển thị</span><input className="cpanel-input" value={fields.cycle || ""} onChange={(event) => updateField("cycle", event.target.value)} /></label>
                <label><span>Thứ tự</span><input className="cpanel-input" type="number" value={fields.sort_order || 0} onChange={(event) => updateField("sort_order", Number(event.target.value || 0))} /></label>
              </div>

              <label><span>Mô tả</span><textarea className="cpanel-input" style={{ minHeight: 82 }} value={fields.description || ""} onChange={(event) => updateField("description", event.target.value)} /></label>

              <div className="plan-metrics-grid">
                <label>
                  <span>Bot AI</span>
                  <input
                    className="cpanel-input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={fields.bots || ""}
                    onChange={(event) => updateField("bots", digitsOnly(event.target.value))}
                    placeholder="Ví dụ: 5"
                  />
                </label>
                <label>
                  <span>Kênh</span>
                  <input
                    className="cpanel-input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={fields.channels || ""}
                    onChange={(event) => updateField("channels", digitsOnly(event.target.value))}
                    placeholder="Ví dụ: 8"
                  />
                </label>
                <label>
                  <span>Cuộc hội thoại AI/ngày</span>
                  <input
                    className="cpanel-input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={fields.messages || ""}
                    onChange={(event) => updateField("messages", digitsOnly(event.target.value))}
                    placeholder="Ví dụ: 500"
                  />
                </label>
              </div>
              <p className="plan-metrics-hint">Chỉ nhập số. Không cần điền thêm chữ như “bot AI” hoặc “Zalo/Facebook”.</p>

              <div>
                <div className="cpanel-card-header" style={{ padding: 0, marginBottom: 10 }}>
                  <h2>Model AI được dùng</h2>
                  <span className="cpanel-status-pill blue">{(fields.ai_model_ids || []).length} model</span>
                </div>
                {aiModels.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                    {aiModels.map((model) => {
                      const modelId = Number(model.id || 0);
                      const checked = (fields.ai_model_ids || []).map(Number).includes(modelId);
                      const source = aiModelSource(model);
                      return (
                        <label
                          key={model.puterId || model.id}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            border: "1px solid #e4e4e7",
                            borderRadius: 8,
                            padding: 12,
                            background: checked ? "#ecfdf5" : "#fff",
                            color: checked ? "#047857" : "#3f3f46",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAiModel(modelId)}
                            style={{ marginTop: 3 }}
                          />
                          <span>
                            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className={`cpanel-status-pill ${aiModelSourceTone(source)}`} style={{ padding: "3px 8px", fontSize: 11 }}>{source}</span>
                              <strong style={{ display: "block", color: checked ? "#047857" : "#18181b" }}>{model.name}</strong>
                            </span>
                            <span style={{ display: "block", marginTop: 5, color: "#71717a", fontSize: 12 }}>{model.provider || "-"} · {model.puterId}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ border: "1px dashed #d4d4d8", borderRadius: 8, padding: 14, color: "#71717a", fontWeight: 700 }}>
                    Chưa có model AI đang bật. Vào Quản lý AI để lấy và lưu model trước.
                  </div>
                )}
              </div>

              <div className="grid-2">
                <label><span>Lượt chạy chiến dịch</span><input className="cpanel-input" type="number" min={0} value={fields.campaign_usage_limit ?? 0} onChange={(event) => updateField("campaign_usage_limit", event.target.value === "" ? null : Number(event.target.value))} /></label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, paddingTop: 18 }}>
                  <input type="checkbox" checked={Boolean(fields.campaign_usage_unlimited)} onChange={(event) => updateField("campaign_usage_unlimited", event.target.checked)} />
                  Không giới hạn chạy chiến dịch
                </label>
                <label><span>Lượt dùng Auto Facebook/Threads</span><input className="cpanel-input" type="number" min={0} value={fields.automation_usage_limit ?? 0} onChange={(event) => updateField("automation_usage_limit", event.target.value === "" ? null : Number(event.target.value))} /></label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, paddingTop: 18 }}>
                  <input type="checkbox" checked={Boolean(fields.automation_usage_unlimited)} onChange={(event) => updateField("automation_usage_unlimited", event.target.checked)} />
                  Không giới hạn Auto Facebook/Threads
                </label>
                <label><span>Hỗ trợ</span><input className="cpanel-input" value={fields.support || ""} onChange={(event) => updateField("support", event.target.value)} /></label>
              </div>

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}><input type="checkbox" checked={Boolean(fields.popular)} onChange={(event) => updateField("popular", event.target.checked)} /> Phổ biến nhất</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}><input type="checkbox" checked={fields.is_active !== false} onChange={(event) => updateField("is_active", event.target.checked)} /> Hiển thị cho khách</label>
              </div>

              <div>
                <div className="cpanel-card-header" style={{ padding: 0, marginBottom: 10 }}>
                  <h2>Tính năng</h2>
                  <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={addFeature}><Icon name="add" size={14} /> Thêm dòng</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(fields.features || []).map((feature, index) => (
                    <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 110px 42px", gap: 8 }}>
                      <input className="cpanel-input" value={feature.text} onChange={(event) => updateFeature(index, "text", event.target.value)} />
                      <select className="cpanel-select" value={feature.included ? "1" : "0"} onChange={(event) => updateFeature(index, "included", event.target.value === "1")}>
                        <option value="1">Có</option>
                        <option value="0">Không</option>
                      </select>
                      <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={() => removeFeature(index)}><Icon name="delete" size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 18 }}>
              <div className="row">
                {selectedPlan ? (
                  <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={() => deletePlan(selectedPlan)}>
                    <Icon name="delete" size={15} /> Xoá gói
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="cpanel-btn cpanel-btn-secondary" type="button" onClick={closeModal}>Huỷ</button>
                <button className="cpanel-btn cpanel-btn-red" type="submit" disabled={saving}>
                  <Icon name="check" size={16} /> {saving ? "Đang lưu..." : "Lưu gói dịch vụ"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
