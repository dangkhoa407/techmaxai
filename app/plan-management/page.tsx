"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import { fetchServicePlans, formatVnd, purchasePackage, type ServicePlan, useAuthUser } from "../lib/auth";
import { showToast } from "../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "Chưa kích hoạt";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function daysLeft(value?: string | null) {
  if (!value) return 0;
  const end = new Date(value.replace(" ", "T")).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

function limitText(value: number | null | undefined, unlimited?: boolean) {
  if (unlimited) return "Không giới hạn";
  return `${Number(value || 0).toLocaleString("vi-VN")} lượt`;
}

function planCampaignUsage(plan: ServicePlan) {
  return `${limitText(plan.campaign_usage_limit, plan.campaign_usage_unlimited)} chạy chiến dịch`;
}

function planAutomationUsage(plan: ServicePlan) {
  return `${limitText(plan.automation_usage_limit, plan.automation_usage_unlimited)} dùng Auto Facebook/Threads`;
}

function planDescription(plan: ServicePlan) {
  return plan.description || "Gói dịch vụ được cấu hình trong admin.";
}

export default function PlanManagementPage() {
  const { user } = useAuthUser();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServicePlans()
      .then((items) => setPlans(items))
      .catch((error) => showToast(error instanceof Error ? error.message : "Không thể tải gói dịch vụ.", "error"));
  }, []);

  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active !== false), [plans]);
  const currentPlan = useMemo(() => activePlans.find((plan) => plan.code === user?.plan_code) || null, [activePlans, user?.plan_code]);
  const firstBuyablePlan = useMemo(() => activePlans.find((plan) => plan.code !== "trial") || activePlans[0] || null, [activePlans]);
  const activePlan = user?.plan_active ? currentPlan : null;
  const currentPlanName = user?.plan_name || currentPlan?.name || "Chưa có gói";
  const mainBalance = formatVnd(user?.money);
  const expiresAt = formatDate(user?.plan_expires_at);
  const remainingDays = daysLeft(user?.plan_expires_at);
  const balanceAfter = selectedPlan ? Number(user?.money ?? 0) - Number(selectedPlan.price || 0) : 0;
  const canPay = balanceAfter >= 0;

  const benefits = currentPlan
    ? [
        ["smart_toy", currentPlan.bots || "-", "Số lượng bot AI có thể vận hành đồng thời."],
        ["hub", currentPlan.channels || "-", "Số kênh Zalo/Facebook được kết nối với hệ thống."],
        ["mail", currentPlan.messages || "-", "Giới hạn xử lý hội thoại trong một ngày."],
        ["history", planCampaignUsage(currentPlan), "Lượt chạy chiến dịch còn khả dụng."],
        ["history", planAutomationUsage(currentPlan), "Lượt dùng Auto Facebook/Threads còn khả dụng."],
        ["support_agent", currentPlan.support || "-", "Mức hỗ trợ và quyền lợi đi kèm gói."],
      ]
    : [
        ["smart_toy", "Chưa có bot AI", "Mua gói để bắt đầu kích hoạt bot AI."],
        ["hub", "Chưa kết nối kênh", "Gói dịch vụ sẽ mở giới hạn Zalo/Facebook."],
        ["mail", "Chưa có hạn mức hội thoại", "Hạn mức sẽ được cấp sau khi mua gói."],
        ["history", "Chưa có lượt chạy", "Gói sẽ cấp lượt chạy chiến dịch và Auto Facebook/Threads."],
        ["support_agent", "Chưa có hỗ trợ gói", "Chọn gói phù hợp để nhận hỗ trợ vận hành."],
      ];

  const suggestedPlans = activePlans.filter((plan) => plan.code !== user?.plan_code && plan.code !== "trial");

  function actionLabel(plan: ServicePlan) {
    if (user?.plan_code === plan.code) return "Gia hạn gói";
    if (user?.plan_code && user.plan_active) return "Nâng cấp gói";
    return "Mua gói";
  }

  async function handleConfirmPlan() {
    if (!selectedPlan) return;

    setSaving(true);
    try {
      const payload = await purchasePackage(selectedPlan.code);
      showToast(payload.message || "Cập nhật gói dịch vụ thành công.");
      setSelectedPlan(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể cập nhật gói dịch vụ.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFrame active="/plan-management" title="Quản lý gói">
      <PageHeader
        title="Quản lý gói"
        desc="Theo dõi gói hiện tại, gia hạn dịch vụ hoặc nâng cấp lên gói cao hơn khi cần mở rộng vận hành."
        action={<Link className="btn btn-red" href="/deposit"><Icon name="payments" /> Nạp tiền</Link>}
      />

      <section className="plan-hero card pad">
        <div className="between">
          <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
            <div className="plan-icon">
              <Icon name="shopping_bag" size={30} />
            </div>
            <div>
              <span className={user?.plan_active ? "status green" : "status red"}>{user?.plan_active ? "Đang hoạt động" : "Chưa hoạt động"}</span>
              <h2>{currentPlanName}</h2>
              <p className="subtitle">
                {user?.plan_active
                  ? `Gói đang hoạt động, còn khoảng ${remainingDays} ngày và hết hạn vào ${expiresAt}.`
                  : "Tài khoản chưa có gói đang hoạt động. Bạn có thể mua gói mới để kích hoạt dịch vụ."}
              </p>
            </div>
          </div>
          <div className="plan-actions">
            {currentPlan ? (
              <button className="btn btn-red" onClick={() => setSelectedPlan(currentPlan)} type="button">Gia hạn gói</button>
            ) : (
              <button className="btn btn-red" disabled={!firstBuyablePlan} onClick={() => firstBuyablePlan && setSelectedPlan(firstBuyablePlan)} type="button">Mua gói</button>
            )}
            <Link className="btn btn-secondary" href="/packages">Xem bảng gói</Link>
          </div>
        </div>
      </section>

      <section className="grid-4" style={{ marginTop: 18 }}>
        <StatCard label="Số dư hiện tại" value={mainBalance} help="Dùng để thanh toán gói" icon="wallet" />
        <StatCard label="Giá gói hiện tại" value={formatVnd(user?.plan_price)} help={currentPlan ? `${currentPlan.days || 30} ngày` : "Chưa có gói"} icon="payments" />
        <StatCard label="Ngày còn lại" value={`${remainingDays} ngày`} help={`Hết hạn: ${expiresAt}`} icon="timer" />
        <StatCard label="Trạng thái" value={user?.plan_active ? "Đang chạy" : "Hết hạn"} help={activePlan ? activePlan.name : "Cần mua/gia hạn"} icon="security" />
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="row">
            <Icon name="verified_user" />
            <h2 style={{ margin: 0 }}>Quyền lợi hiện tại</h2>
          </div>
          <div className="stack" style={{ marginTop: 18 }}>
            {benefits.map(([icon, title, desc]) => (
              <div className="plan-benefit" key={title}>
                <Icon name={icon} size={20} />
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card pad">
          <div className="row">
            <Icon name="rocket_launch" />
            <h2 style={{ margin: 0 }}>Gia hạn và nâng cấp</h2>
          </div>
          <div className="stack" style={{ marginTop: 18 }}>
            {currentPlan ? (
              <div className="upgrade-option">
                <div>
                  <strong>Gia hạn {currentPlan.name}</strong>
                  <p>Cộng thêm {currentPlan.days || 30} ngày sử dụng vào hạn hiện tại nếu gói còn hoạt động.</p>
                </div>
                <div className="upgrade-price">{formatVnd(currentPlan.price)}<span>/{currentPlan.days || 30} ngày</span></div>
                <button className="btn btn-red" onClick={() => setSelectedPlan(currentPlan)} type="button">Gia hạn</button>
              </div>
            ) : null}

            {suggestedPlans.map((plan) => (
              <div className="upgrade-option" key={plan.id || plan.code}>
                <div>
                  <strong>{plan.name}</strong>
                  <p>{planDescription(plan)}</p>
                  <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{planAutomationUsage(plan)}</p>
                </div>
                <div className="upgrade-price">{formatVnd(plan.price)}<span>/{plan.days || 30} ngày</span></div>
                <button className={plan.popular ? "btn btn-red" : "btn btn-secondary"} onClick={() => setSelectedPlan(plan)} type="button">
                  {actionLabel(plan)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, overflow: "hidden" }}>
        <div style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
          <div className="row">
            <Icon name="history" />
            <h2 style={{ margin: 0 }}>Lịch sử gói</h2>
          </div>
          <p className="subtitle">Tóm tắt trạng thái gói dịch vụ hiện tại của tài khoản.</p>
        </div>
        <div className="stack" style={{ padding: 18 }}>
          {user?.plan_code ? (
            <>
              <div className="plan-timeline-item">
                <span className="notification-dot green" />
                <div>
                  <div className="between">
                    <strong>Kích hoạt {currentPlanName}</strong>
                    <span className="muted">{formatDate(user?.plan_started_at)}</span>
                  </div>
                  <p>Thanh toán {formatVnd(user?.plan_price)} từ số dư tài khoản.</p>
                </div>
              </div>
              <div className="plan-timeline-item">
                <span className={user?.plan_active ? "notification-dot blue" : "notification-dot red"} />
                <div>
                  <div className="between">
                    <strong>{user?.plan_active ? "Gói đang hoạt động" : "Gói đã hết hạn"}</strong>
                    <span className="muted">{expiresAt}</span>
                  </div>
                  <p>{user?.plan_active ? "Bạn có thể gia hạn trước để cộng thêm thời gian sử dụng." : "Gia hạn để tiếp tục sử dụng dịch vụ."}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="plan-timeline-item">
              <span className="notification-dot gray" />
              <div>
                <div className="between">
                  <strong>Chưa có lịch sử gói</strong>
                  <span className="muted">Hiện tại</span>
                </div>
                <p>Tài khoản chưa mua gói dịch vụ nào.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedPlan ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setSelectedPlan(null)}>
          <div className="confirm-modal confirm-modal-dark" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <span className="eyebrow">{actionLabel(selectedPlan)}</span>
                <h2 id="plan-modal-title">{selectedPlan.name}</h2>
              </div>
              <button className="btn btn-secondary icon-top-button" disabled={saving} onClick={() => setSelectedPlan(null)} type="button" aria-label="Đóng">
                <Icon name="x" />
              </button>
            </div>
            <p className="subtitle">{planDescription(selectedPlan)}</p>
            <div className="confirm-lines">
              <div className="between"><span>Giá gói</span><strong>{formatVnd(selectedPlan.price)}</strong></div>
              <div className="between"><span>Chu kỳ</span><strong>{selectedPlan.days || 30} ngày</strong></div>
              <div className="between"><span>Số dư hiện tại</span><strong>{mainBalance}</strong></div>
              <div className="between"><span>Số dư sau thanh toán</span><strong className={canPay ? "" : "danger-text"}>{formatVnd(balanceAfter)}</strong></div>
            </div>
            {!canPay ? <div className="form-message error">Số dư không đủ để thanh toán gói này.</div> : null}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-secondary" disabled={saving} onClick={() => setSelectedPlan(null)} type="button">Hủy</button>
              {canPay ? (
                <button className="btn btn-red" disabled={saving} onClick={handleConfirmPlan} type="button">
                  {saving ? "Đang xử lý..." : actionLabel(selectedPlan)}
                </button>
              ) : (
                <Link className="btn btn-red" href="/deposit">Nạp tiền</Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}
