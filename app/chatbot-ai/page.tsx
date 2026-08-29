"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  createAiBot,
  deleteAiBot,
  fetchAiBots,
  fetchAiBotUsageStats,
  updateAiBot,
  updateAiBotStatus,
  useAuthUser,
  type AiBot,
  type AiBotUsageStats,
  type PuterAiModel,
} from "../lib/auth";
import { showConfirm, showToast, showError } from "../lib/swal";

const emptyBotForm = {
  full_name: "",
  gender: "male",
  model_id: "",
  personality_description: "",
  extra_description: "",
};

const pageSize = 10;
const usagePageSize = 5;

function modelLabel(model: PuterAiModel) {
  return [model.provider, model.name].filter(Boolean).join(" - ");
}

function modelServerLabel(model: PuterAiModel) {
  const puterId = String(model.puterId || model.model_id || model.id || "").toLowerCase();
  return puterId.startsWith("gemini:") ? "Server 2" : "Server 1";
}

function canUseModel(model: PuterAiModel) {
  const allowed = model.is_plan_allowed as unknown;
  return allowed === true || allowed === 1 || allowed === "1" || allowed === "true";
}

function modelSelectLabel(model: PuterAiModel) {
  const label = `${model.name} (${modelServerLabel(model)})`;
  if (canUseModel(model)) return label;
  return `${label} (Nâng gói ${model.upgrade_plan_name || "phù hợp"})`;
}

function genderLabel(gender: string) {
  return {
    male: "Nam",
    female: "Nữ",
    other: "Khác",
  }[gender] || gender;
}

function formatNumber(value?: number | null) {
  if (!value) return "-";
  return Number(value).toLocaleString("vi-VN");
}

function formatMetric(value?: number | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function usageStatusLabel(status: string) {
  if (status === "success") return "Đã trả lời";
  if (status === "empty") return "Không cần trả lời";
  return "Lỗi";
}

function usageCustomerLabel(item: AiBotUsageStats["logs"][number]) {
  const id = item.customer_id || item.external_thread_id || "";
  const name = item.customer_name && item.customer_name !== id ? item.customer_name : "";
  return { name: name || id || "-", id: name ? id : "" };
}

const publicAiSystemErrorMessage = "Lỗi hệ thống AI, vui lòng gửi ticket để xử lý";

function isAiSystemInfrastructureError(message: unknown) {
  const text = String(message || "");
  return (
    text.includes("Tất cả API key AI đều lỗi") ||
    text.includes("Tất cả API key Gemini đều lỗi") ||
    text.includes("insufficient_funds") ||
    text.includes("No usage left for request") ||
    text.includes("HTTP 402")
  );
}

function usageErrorDetail(item: AiBotUsageStats["logs"][number] | null, canViewPrivateDetail = false) {
  const rawError = item?.raw && typeof item.raw === "object" && "error" in item.raw ? item.raw.error : null;
  const errorObject = rawError && typeof rawError === "object" && !Array.isArray(rawError) ? rawError as Record<string, unknown> : {};
  const privateMessage = String(errorObject.message || item?.error_message || "Không rõ lỗi");
  const publicMessage = String(errorObject.publicMessage || item?.error_message || publicAiSystemErrorMessage);
  const message = canViewPrivateDetail
    ? privateMessage
    : isAiSystemInfrastructureError(privateMessage)
      ? publicAiSystemErrorMessage
      : publicMessage;
  const name = String(errorObject.name || "Error");
  const stack = canViewPrivateDetail ? String(errorObject.stack || "") : "";
  return { message, name, stack };
}

export default function ChatbotAiPage() {
  const { user } = useAuthUser();
  const [bots, setBots] = useState<AiBot[]>([]);
  const [models, setModels] = useState<PuterAiModel[]>([]);
  const [usageStats, setUsageStats] = useState<AiBotUsageStats | null>(null);
  const [botForm, setBotForm] = useState(emptyBotForm);
  const [editingBotId, setEditingBotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBot, setSavingBot] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPage, setModelPage] = useState(1);
  const [botSearch, setBotSearch] = useState("");
  const [botPage, setBotPage] = useState(1);
  const [usageBotPage, setUsageBotPage] = useState(1);
  const [usageLogPage, setUsageLogPage] = useState(1);
  const [selectedPayloadLog, setSelectedPayloadLog] = useState<AiBotUsageStats["logs"][number] | null>(null);
  const [selectedErrorLog, setSelectedErrorLog] = useState<AiBotUsageStats["logs"][number] | null>(null);
  const [openActionBotId, setOpenActionBotId] = useState<number | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number; openUp: boolean } | null>(null);
  const isAdmin = user?.level === "admin";

  const activeBots = useMemo(() => bots.filter((bot) => bot.status === "active").length, [bots]);
  const modelCount = models.length;
  const trainingCount = bots.reduce((sum, bot) => sum + Number(bot.training_count || 0), 0);
  const planLimitLabel = usageStats?.plan.message_limit_unlimited
    ? "Không giới hạn"
    : formatMetric(usageStats?.plan.message_limit || 0);
  const filteredModels = useMemo(() => {
    const keyword = modelSearch.trim().toLowerCase();
    if (!keyword) return models;
    return models.filter((model) => [
      model.name,
      model.provider,
      model.model_id,
      model.puterId,
      String(model.context || ""),
      String(model.max_tokens || ""),
    ].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [models, modelSearch]);
  const usableModels = useMemo(() => models.filter(canUseModel), [models]);
  const filteredBots = useMemo(() => {
    const keyword = botSearch.trim().toLowerCase();
    if (!keyword) return bots;
    return bots.filter((bot) => [
      bot.full_name,
      genderLabel(bot.gender),
      bot.model ? `${bot.model.provider || "AI"} ${bot.model.name} ${bot.model.model_id || ""}` : "",
      bot.personality_description,
      bot.status === "active" ? "đang bật active" : "tạm dừng inactive",
      bot.created_at,
      `${bot.training_count || 0} nội dung`,
    ].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [bots, botSearch]);
  const modelPageCount = Math.max(1, Math.ceil(filteredModels.length / pageSize));
  const botPageCount = Math.max(1, Math.ceil(filteredBots.length / pageSize));
  const safeModelPage = Math.min(modelPage, modelPageCount);
  const safeBotPage = Math.min(botPage, botPageCount);
  const pagedModels = filteredModels.slice((safeModelPage - 1) * pageSize, safeModelPage * pageSize);
  const pagedBots = filteredBots.slice((safeBotPage - 1) * pageSize, safeBotPage * pageSize);
  const usageBots = usageStats?.bots || [];
  const usageLogs = usageStats?.logs || [];
  const usageBotPageCount = Math.max(1, Math.ceil(usageBots.length / usagePageSize));
  const usageLogPageCount = Math.max(1, Math.ceil(usageLogs.length / usagePageSize));
  const safeUsageBotPage = Math.min(usageBotPage, usageBotPageCount);
  const safeUsageLogPage = Math.min(usageLogPage, usageLogPageCount);
  const pagedUsageBots = usageBots.slice((safeUsageBotPage - 1) * usagePageSize, safeUsageBotPage * usagePageSize);
  const pagedUsageLogs = usageLogs.slice((safeUsageLogPage - 1) * usagePageSize, safeUsageLogPage * usagePageSize);

  useEffect(() => {
    if (!isAdmin && selectedPayloadLog) setSelectedPayloadLog(null);
  }, [isAdmin, selectedPayloadLog]);

  async function refreshUsageStats() {
    try {
      setUsageStats(await fetchAiBotUsageStats());
    } catch (error) {
      console.error("Không thể tải thống kê Bot AI", error);
    }
  }

  useEffect(() => {
    Promise.all([fetchAiBots(), fetchAiBotUsageStats()])
      .then(([data, stats]) => {
        setBots(data.bots);
        setModels(data.models);
        setUsageStats(stats);
        const firstUsableModel = data.models.find(canUseModel);
        if (firstUsableModel) {
          setBotForm((current) => ({ ...current, model_id: String(firstUsableModel.id) }));
        }
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải danh sách bot AI.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setModelPage(1);
  }, [modelSearch]);

  useEffect(() => {
    setBotPage(1);
  }, [botSearch]);

  useEffect(() => {
    if (!usableModels.length) return;
    const selectedModel = models.find((model) => String(model.id) === String(botForm.model_id));
    if (!selectedModel || !canUseModel(selectedModel)) {
      setBotForm((current) => ({ ...current, model_id: String(usableModels[0].id) }));
    }
  }, [botForm.model_id, models, usableModels]);

  useEffect(() => {
    setUsageBotPage((current) => Math.min(current, usageBotPageCount));
    setUsageLogPage((current) => Math.min(current, usageLogPageCount));
  }, [usageBotPageCount, usageLogPageCount]);

  useEffect(() => {
    function closeActionMenu() {
      setOpenActionBotId(null);
      setActionMenuPosition(null);
    }

    window.addEventListener("click", closeActionMenu);
    window.addEventListener("scroll", closeActionMenu, true);
    window.addEventListener("resize", closeActionMenu);
    return () => {
      window.removeEventListener("click", closeActionMenu);
      window.removeEventListener("scroll", closeActionMenu, true);
      window.removeEventListener("resize", closeActionMenu);
    };
  }, []);

  function toggleActionMenu(botId: number, event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (openActionBotId === botId) {
      setOpenActionBotId(null);
      setActionMenuPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 238;
    const openUp = rect.bottom + menuHeight > window.innerHeight - 16;
    setActionMenuPosition({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
      openUp,
    });
    setOpenActionBotId(botId);
  }

  function setSuccess(text: string) {
    showToast(text);
  }

  function setError(error: unknown, fallback: string) {
    showToast(error instanceof Error ? error.message : fallback, "error");
  }

  function updateBotField<K extends keyof typeof emptyBotForm>(name: K, value: (typeof emptyBotForm)[K]) {
    setBotForm((current) => ({ ...current, [name]: value }));
  }

  function resetBotForm() {
    setEditingBotId(null);
    setBotForm({ ...emptyBotForm, model_id: usableModels[0]?.id ? String(usableModels[0].id) : "" });
  }

  function openCreateBotModal() {
    resetBotForm();
    setBotModalOpen(true);
  }

  async function onSaveBot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBot(true);
    try {
      const selectedModel = models.find((model) => String(model.id) === String(botForm.model_id));
      const safeModel = selectedModel && canUseModel(selectedModel) ? selectedModel : usableModels[0];
      if (!safeModel?.id) {
        showToast("Gói hiện tại chưa có model AI nào được mở.", "error");
        return;
      }
      const payload = {
        full_name: botForm.full_name,
        gender: botForm.gender,
        model_id: Number(safeModel.id),
        personality_description: botForm.personality_description,
        extra_description: botForm.extra_description,
      };
      const updatedBots = editingBotId ? await updateAiBot(editingBotId, payload) : await createAiBot(payload);
      setBots(updatedBots);
      refreshUsageStats();
      resetBotForm();
      setBotModalOpen(false);
      setSuccess(editingBotId ? "Đã cập nhật bot AI." : "Đã tạo bot AI mới.");
    } catch (error) {
      setError(error, editingBotId ? "Không thể cập nhật bot AI." : "Không thể tạo bot AI.");
    } finally {
      setSavingBot(false);
    }
  }

  function onEditBot(bot: AiBot) {
    setOpenActionBotId(null);
    setActionMenuPosition(null);
    setEditingBotId(bot.id);
    setBotForm({
      full_name: bot.full_name,
      gender: bot.gender,
      model_id: bot.model?.id ? String(bot.model.id) : "",
      personality_description: bot.personality_description,
      extra_description: bot.extra_description,
    });
    setBotModalOpen(true);
  }

  async function onToggleBot(bot: AiBot) {
    setOpenActionBotId(null);
    setActionMenuPosition(null);
    try {
      const nextStatus = bot.status === "active" ? "inactive" : "active";
      setBots(await updateAiBotStatus(bot.id, nextStatus));
      refreshUsageStats();
      setSuccess(nextStatus === "active" ? "Đã bật bot AI." : "Đã tạm dừng bot AI.");
    } catch (error) {
      setError(error, "Không thể cập nhật trạng thái bot AI.");
    }
  }

  async function onDeleteBot(bot: AiBot) {
    setOpenActionBotId(null);
    setActionMenuPosition(null);
    if (!(await showConfirm(`Xoá bot AI "${bot.full_name}" và toàn bộ nội dung đào tạo?`))) return;
    try {
      setBots(await deleteAiBot(bot.id));
      refreshUsageStats();
      setSuccess("Đã xoá bot AI.");
    } catch (error) {
      setError(error, "Không thể xoá bot AI.");
    }
  }

  return (
    <AppFrame active="/chatbot-ai" title="Quản lý Bot AI">
      <PageHeader
        eyebrow="Tự động phản hồi khách hàng"
        title="Quản lý Bot AI"
        desc="Tạo, quản lý, tạm dừng và mở phòng đào tạo riêng cho từng bot AI."
        action={
          <button className="btn btn-primary" onClick={openCreateBotModal} type="button">
            <Icon name="add" /> Tạo bot AI
          </button>
        }
      />

      <div className="stack">
      {/* Banners removed per toast request */}

        <section className="grid-4">
          <StatCard label="Tổng bot" value={String(bots.length)} help="Bot AI đã tạo" icon="smart_toy" />
          <StatCard label="Đang bật" value={String(activeBots)} help="Bot sẵn sàng sử dụng" icon="toggle_on" />
          <StatCard label="Model khả dụng" value={String(modelCount)} help="Model admin đã lưu" icon="settings" />
          <StatCard label="Nội dung đào tạo" value={String(trainingCount)} help="Tổng nội dung đã lưu" icon="menu_book" />
        </section>

        <section className="grid-4">
          <StatCard label="AI hôm nay" value={formatMetric(usageStats?.summary.usage_today)} help="Số lần bot được gọi" icon="bolt" />
          <StatCard label="Tin AI đã trả" value={formatMetric(usageStats?.summary.replies_today)} help="Tổng tin nhắn bot gửi" icon="forum" />
          <StatCard label="Khách hôm nay" value={`${formatMetric(usageStats?.summary.customers_today)}/${planLimitLabel}`} help={usageStats?.plan.name || "Gói hiện tại"} icon="groups" />
          <StatCard label="Lỗi AI" value={formatMetric(usageStats?.summary.errors_today)} help={`${formatMetric(usageStats?.summary.empty_today)} lần tự kết thúc`} icon="error" />
        </section>

        <section className="grid-2">
          <div className="card">
            <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 style={{ margin: 0 }}>Thống kê theo bot</h2>
                <p className="subtitle">Số liệu tự động trả lời trong hôm nay.</p>
              </div>
              <Icon name="monitoring" />
            </div>
            <div className="table-scroll">
              <table className="datatable">
                <thead>
                  <tr>
                    <th>Bot</th>
                    <th>Dùng AI</th>
                    <th>Đã trả</th>
                    <th>Khách</th>
                    <th>Lỗi</th>
                    <th>Lần cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsageBots.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.full_name}</strong><div className="muted" style={{ marginTop: 4 }}>{item.status === "active" ? "Đang bật" : "Tạm dừng"}</div></td>
                      <td>{formatMetric(item.usage_today)}</td>
                      <td>{formatMetric(item.replies_today)}</td>
                      <td>{formatMetric(item.customers_today)}</td>
                      <td>
                        <span className={`status ${item.errors_today ? "red" : "green"}`}>{formatMetric(item.errors_today)}</span>
                        {item.last_error?.message ? <div className="muted bot-stat-error">{item.last_error.message}</div> : null}
                      </td>
                      <td>{item.last_used_at || "-"}</td>
                    </tr>
                  ))}
                  {!usageBots.length ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="activity-empty">
                          <strong>Chưa có dữ liệu bot</strong>
                          <p>Khi Zalo bật AI và có khách nhắn, thống kê sẽ hiện ở đây.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {usageBots.length > usagePageSize ? (
              <div className="activity-pagination">
                <p>Tổng: {usageBots.length} bot • Trang {safeUsageBotPage}/{usageBotPageCount}</p>
                <div className="row">
                  <button className="btn btn-secondary" disabled={safeUsageBotPage <= 1} onClick={() => setUsageBotPage(safeUsageBotPage - 1)} type="button">‹</button>
                  <button className="btn btn-primary" type="button">{safeUsageBotPage}</button>
                  <button className="btn btn-secondary" disabled={safeUsageBotPage >= usageBotPageCount} onClick={() => setUsageBotPage(safeUsageBotPage + 1)} type="button">›</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 style={{ margin: 0 }}>Log AI gần nhất</h2>
                <p className="subtitle">Theo dõi lượt trả lời, lượt bỏ qua và lỗi.</p>
              </div>
              <Icon name="receipt_long" />
            </div>
            <div className="table-scroll">
              <table className="datatable">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Bot</th>
                    <th>Khách</th>
                    <th>Trạng thái</th>
                    <th>Log</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsageLogs.map((item) => {
                    const customer = usageCustomerLabel(item);
                    return (
                    <tr key={item.id}>
                      <td>{item.created_at || "-"}</td>
                      <td><strong>{item.bot_name || "-"}</strong><div className="muted" style={{ marginTop: 4 }}>{item.account_name || item.source}</div></td>
                      <td><strong>{customer.name}</strong>{customer.id ? <div className="muted" style={{ marginTop: 4 }}>{customer.id}</div> : null}</td>
                      <td><span className={`status ${item.status === "error" ? "red" : item.status === "empty" ? "orange" : "green"}`}>{usageStatusLabel(item.status)}</span></td>
                      <td>
                        {item.status === "error" ? (
                          <div className="bot-error-cell">
                            <span className="bot-stat-error">{usageErrorDetail(item, isAdmin).message}</span>
                            <button className="btn btn-secondary bot-payload-button" type="button" onClick={() => setSelectedErrorLog(item)}>
                              <Icon name="visibility" size={15} /> Xem lỗi
                            </button>
                          </div>
                        ) : (
                          <span>{formatMetric(item.reply_count)} tin trả lời</span>
                        )}
                        {isAdmin && item.payload ? (
                          <button className="btn btn-secondary bot-payload-button" type="button" onClick={() => setSelectedPayloadLog(item)}>
                            <Icon name="data_object" size={15} /> Payload
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })}
                  {!usageLogs.length ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="activity-empty">
                          <strong>Chưa có log AI</strong>
                          <p>Log sẽ xuất hiện sau khi bot tự xử lý tin nhắn Zalo.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {usageLogs.length > usagePageSize ? (
              <div className="activity-pagination">
                <p>Tổng: {usageLogs.length} log • Trang {safeUsageLogPage}/{usageLogPageCount}</p>
                <div className="row">
                  <button className="btn btn-secondary" disabled={safeUsageLogPage <= 1} onClick={() => setUsageLogPage(safeUsageLogPage - 1)} type="button">‹</button>
                  <button className="btn btn-primary" type="button">{safeUsageLogPage}</button>
                  <button className="btn btn-secondary" disabled={safeUsageLogPage >= usageLogPageCount} onClick={() => setUsageLogPage(safeUsageLogPage + 1)} type="button">›</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {botModalOpen ? (
          <div className="bot-form-modal-backdrop" role="presentation" onMouseDown={() => !savingBot && setBotModalOpen(false)}>
          <form className="card pad stack bot-form-modal" role="dialog" aria-modal="true" aria-labelledby="bot-form-modal-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSaveBot}>
            <div className="between">
              <div>
                <h2 id="bot-form-modal-title" style={{ margin: 0 }}>{editingBotId ? "Chỉnh sửa bot AI" : "Tạo bot AI"}</h2>
                <p className="subtitle">Nhập hồ sơ, model và tính cách để hệ thống lưu bot.</p>
              </div>
              <button className="btn btn-secondary" disabled={savingBot} onClick={() => setBotModalOpen(false)} type="button">
                <Icon name="x" size={16} /> Đóng
              </button>
            </div>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>Họ và tên</span>
              <input className="input" value={botForm.full_name} onChange={(event) => updateBotField("full_name", event.target.value)} placeholder="Ví dụ: Minh Anh" />
            </label>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 8 }}>Giới tính</span>
                <select className="input" value={botForm.gender} onChange={(event) => updateBotField("gender", event.target.value)}>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </label>

              <label>
                <span className="muted" style={{ display: "block", marginBottom: 8 }}>Mô hình sử dụng</span>
                <select className="input" value={botForm.model_id} onChange={(event) => updateBotField("model_id", event.target.value)} disabled={!usableModels.length}>
                  {models.length ? models.map((model) => (
                    <option key={model.id || model.puterId} value={model.id} disabled={!canUseModel(model)}>{modelSelectLabel(model)}</option>
                  )) : (
                    <option value="">Chưa có model được admin lưu</option>
                  )}
                </select>
              </label>
            </div>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>Mô tả tính cách</span>
              <textarea className="input" rows={5} value={botForm.personality_description} onChange={(event) => updateBotField("personality_description", event.target.value)} placeholder="Ví dụ: thân thiện, trả lời ngắn gọn, luôn hỏi thêm nhu cầu khách hàng." />
            </label>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>Mô tả khác</span>
              <textarea className="input" rows={4} value={botForm.extra_description} onChange={(event) => updateBotField("extra_description", event.target.value)} placeholder="Thông tin bổ sung, phạm vi tư vấn, lưu ý về thương hiệu..." />
            </label>

            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={savingBot || !usableModels.length}>
                <Icon name={editingBotId ? "check" : "add"} size={18} /> {savingBot ? "Đang lưu..." : editingBotId ? "Lưu chỉnh sửa" : "Tạo bot AI"}
              </button>
              {editingBotId ? <button className="btn btn-secondary" type="button" onClick={resetBotForm}>Huỷ sửa</button> : null}
            </div>
          </form>
          </div>
        ) : null}

        <section className="bot-model-section">
          <div className="card">
            <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 style={{ margin: 0 }}>Model từ admin</h2>
                <p className="subtitle">Danh sách model AI bạn có thể sử dụng.</p>
              </div>
              <Icon name="settings" />
            </div>
            {models.length ? (
              <>
                <div className="activity-search" style={{ borderRadius: 0, borderInline: 0 }}>
                  <div className="activity-search-input">
                    <Icon name="search" size={20} />
                    <input
                      className="input"
                      onChange={(event) => setModelSearch(event.target.value)}
                      placeholder="Tìm model, provider, model id..."
                      value={modelSearch}
                    />
                  </div>
                  <button className="btn btn-secondary" onClick={() => setModelPage(1)} type="button">
                    <Icon name="filter_list" size={18} />
                    Tìm kiếm
                  </button>
                </div>
                <div className="table-scroll">
                  <table className="datatable">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Provider</th>
                        <th>Model ID</th>
                        <th>Context</th>
                        <th>Max tokens</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedModels.map((model) => (
                        <tr key={model.id || model.puterId}>
                          <td><strong>{model.name}</strong><div className="muted" style={{ marginTop: 4 }}>{model.puterId}</div></td>
                          <td>{model.provider || "-"}</td>
                          <td>{model.model_id || model.id || "-"}</td>
                          <td>{formatNumber(model.context)}</td>
                          <td>{formatNumber(model.max_tokens)}</td>
                          <td>
                            <span className={`status ${canUseModel(model) ? "green" : "orange"}`}>
                              {canUseModel(model) ? "Dùng được" : `Nâng gói ${model.upgrade_plan_name || "phù hợp"}`}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!pagedModels.length ? (
                        <tr>
                          <td colSpan={6}>
                            <div className="activity-empty">
                              <strong>Không tìm thấy model</strong>
                              <p>Thử tìm bằng tên model, provider hoặc model id khác.</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="activity-pagination">
                  <p>Tổng: {filteredModels.length} model • Trang {safeModelPage}/{modelPageCount}</p>
                  <div className="row">
                    <button className="btn btn-secondary" disabled={safeModelPage <= 1} onClick={() => setModelPage(safeModelPage - 1)} type="button">‹</button>
                    <button className="btn btn-primary" type="button">{safeModelPage}</button>
                    <button className="btn btn-secondary" disabled={safeModelPage >= modelPageCount} onClick={() => setModelPage(safeModelPage + 1)} type="button">›</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Icon name="warning" size={38} />
                <h3>Chưa có model AI</h3>
                <p className="subtitle">Admin cần lưu ít nhất một model trong trang Quản lý AI.</p>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ margin: 0 }}>Danh sách Bot AI</h2>
              <p className="subtitle">Các bot AI đã tạo trong tài khoản của bạn.</p>
            </div>
            <button className="btn btn-secondary" onClick={openCreateBotModal} type="button"><Icon name="add" size={18} /> Tạo bot</button>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }} className="muted">Đang tải danh sách bot AI...</div>
          ) : bots.length ? (
            <>
              <div className="activity-search" style={{ borderRadius: 0, borderInline: 0 }}>
                <div className="activity-search-input">
                  <Icon name="search" size={20} />
                  <input
                    className="input"
                    onChange={(event) => setBotSearch(event.target.value)}
                    placeholder="Tìm bot, giới tính, model, trạng thái..."
                    value={botSearch}
                  />
                </div>
                <button className="btn btn-secondary" onClick={() => setBotPage(1)} type="button">
                  <Icon name="filter_list" size={18} />
                  Tìm kiếm
                </button>
              </div>
              <div className="table-scroll">
                <table className="datatable bot-list-table">
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>Giới tính</th>
                      <th>Model</th>
                      <th>Tính cách</th>
                      <th>Đào tạo</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBots.map((bot) => (
                      <tr key={bot.id}>
                        <td><strong>{bot.full_name}</strong></td>
                        <td>{genderLabel(bot.gender)}</td>
                        <td className="bot-list-model"><div className="bot-list-cell-text">{bot.model ? `${bot.model.provider || "AI"} - ${bot.model.name}` : "-"}</div></td>
                        <td className="bot-list-personality"><div className="bot-list-cell-text">{bot.personality_description}</div></td>
                        <td>{bot.training_count || 0} nội dung</td>
                        <td><span className={`status ${bot.status === "active" ? "green" : "orange"}`}>{bot.status === "active" ? "Đang bật" : "Tạm dừng"}</span></td>
                        <td>{bot.created_at || "-"}</td>
                        <td className="bot-list-actions">
                          <div className="bot-action-wrap" onClick={(event) => event.stopPropagation()}>
                            <button
                              aria-expanded={openActionBotId === bot.id}
                              aria-label={`Mở thao tác cho ${bot.full_name}`}
                              className="bot-action-trigger"
                              onClick={(event) => toggleActionMenu(bot.id, event)}
                              type="button"
                            >
                              <span />
                              <span />
                              <span />
                            </button>
                            {openActionBotId === bot.id && actionMenuPosition ? (
                              <div
                                className={actionMenuPosition.openUp ? "bot-action-menu open-up" : "bot-action-menu"}
                                style={{
                                  top: actionMenuPosition.top,
                                  right: actionMenuPosition.right,
                                }}
                              >
                                <button type="button" onClick={() => onEditBot(bot)}><Icon name="edit_note" size={16} /> Chỉnh sửa</button>
                                <button type="button" onClick={() => onToggleBot(bot)}><Icon name="toggle_on" size={16} /> {bot.status === "active" ? "Tạm dừng" : "Bật lại"}</button>
                                <Link href={`/chatbot-ai/${bot.id}/training`} onClick={() => setOpenActionBotId(null)}><Icon name="menu_book" size={16} /> Đào tạo</Link>
                                <Link href={`/chatbot-ai/${bot.id}/test`} onClick={() => setOpenActionBotId(null)}><Icon name="message_circle" size={16} /> Test</Link>
                                <button className="danger" type="button" onClick={() => onDeleteBot(bot)}><Icon name="x" size={16} /> Xoá</button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!pagedBots.length ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="activity-empty">
                            <strong>Không tìm thấy bot AI</strong>
                            <p>Thử tìm bằng tên bot, model, trạng thái hoặc nội dung tính cách khác.</p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="activity-pagination">
                <p>Tổng: {filteredBots.length} bot • Trang {safeBotPage}/{botPageCount}</p>
                <div className="row">
                  <button className="btn btn-secondary" disabled={safeBotPage <= 1} onClick={() => setBotPage(safeBotPage - 1)} type="button">‹</button>
                  <button className="btn btn-primary" type="button">{safeBotPage}</button>
                  <button className="btn btn-secondary" disabled={safeBotPage >= botPageCount} onClick={() => setBotPage(safeBotPage + 1)} type="button">›</button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 72, textAlign: "center" }}>
              <Icon name="smart_toy" size={56} />
              <h3>Chưa có Bot AI nào</h3>
              <p className="subtitle">Tạo bot AI đầu tiên để lưu hồ sơ, model và mô tả tính cách.</p>
              <button className="btn btn-secondary" onClick={openCreateBotModal} type="button">Tạo bot AI</button>
            </div>
          )}
        </section>
      </div>
      {selectedErrorLog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal bot-payload-modal">
            <div className="between" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Chi tiết lỗi AI</h2>
                <p className="subtitle">{selectedErrorLog.bot_name || "Bot AI"} • {selectedErrorLog.created_at || "-"}</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setSelectedErrorLog(null)}>
                <Icon name="x" size={16} /> Đóng
              </button>
            </div>
            <div className="stack">
              <div>
                <strong>{usageErrorDetail(selectedErrorLog, isAdmin).name}</strong>
                <pre className="bot-payload-pre">{usageErrorDetail(selectedErrorLog, isAdmin).message}</pre>
              </div>
              {usageErrorDetail(selectedErrorLog, isAdmin).stack ? (
                <div>
                  <strong>Stack trace</strong>
                  <pre className="bot-payload-pre">{usageErrorDetail(selectedErrorLog, isAdmin).stack}</pre>
                </div>
              ) : null}
              {isAdmin && selectedErrorLog.raw ? (
                <div>
                  <strong>Raw log</strong>
                  <pre className="bot-payload-pre">{JSON.stringify(selectedErrorLog.raw, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {isAdmin && selectedPayloadLog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal bot-payload-modal">
            <div className="between" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Payload AI</h2>
                <p className="subtitle">{selectedPayloadLog.bot_name || "Bot AI"} • {selectedPayloadLog.created_at || "-"}</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setSelectedPayloadLog(null)}>
                <Icon name="x" size={16} /> Đóng
              </button>
            </div>
            <div className="stack">
              <div>
                <strong>Request payload đã gửi</strong>
                <pre className="bot-payload-pre">{JSON.stringify(selectedPayloadLog.payload || {}, null, 2)}</pre>
              </div>
              <div>
                <strong>Kết quả AI trả về</strong>
                <pre className="bot-payload-pre">{JSON.stringify(selectedPayloadLog.raw || {}, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}
