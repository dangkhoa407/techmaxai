"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader } from "../components";
import {
  fetchServicePlanComparisonRows,
  fetchServicePlans,
  formatVnd,
  purchasePackage,
  useAuthUser,
  type ServicePlan,
  type ServicePlanComparisonRow,
} from "../lib/auth";
import { showToast } from "../lib/swal";

const fallbackRows: ServicePlanComparisonRow[] = [
  { feature: "Số bot AI", starter: "1", professional: "5", enterprise: "100" },
  { feature: "Kênh Zalo/Facebook", starter: "1", professional: "8", enterprise: "Unlimited" },
  { feature: "Cuộc hội thoại AI mỗi ngày", starter: "500", professional: "5.000", enterprise: "100.000" },
  { feature: "Lượt chạy chiến dịch", starter: "100", professional: "500", enterprise: "Không giới hạn" },
  { feature: "Lượt dùng Auto Facebook/Threads", starter: "100", professional: "500", enterprise: "Không giới hạn" },
  { feature: "Đào tạo AI", starter: "Không bao gồm", professional: "Bao gồm", enterprise: "Bao gồm" },
  { feature: "Gửi tin nhắn hàng loạt", starter: "Không bao gồm", professional: "Bao gồm", enterprise: "Bao gồm" },
  { feature: "API & Webhook CRM", starter: "Không bao gồm", professional: "Không bao gồm", enterprise: "Bao gồm" },
  { feature: "Hỗ trợ", starter: "Tiêu chuẩn", professional: "Ưu tiên", enterprise: "Chuyên gia 24/7" },
];

function formatDate(value?: string | null) {
  if (!value) return "Chưa kích hoạt";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function formatPlanPrice(plan: ServicePlan) {
  return formatVnd(plan.price);
}

function fallbackFeatureText(plan: ServicePlan) {
  const campaignUsage = plan.campaign_usage_unlimited
    ? "Không giới hạn lượt chạy chiến dịch"
    : `${Number(plan.campaign_usage_limit || 0).toLocaleString("vi-VN")} lượt chạy chiến dịch`;
  const autoUsage = plan.automation_usage_unlimited
    ? "Không giới hạn lượt dùng Auto Facebook/Threads"
    : `${Number(plan.automation_usage_limit || 0).toLocaleString("vi-VN")} lượt dùng Auto Facebook/Threads`;

  return [
    plan.bots ? `${plan.bots} bot AI` : "",
    plan.channels ? `${plan.channels} Zalo/Facebook` : "",
    plan.messages ? `${Number(plan.messages || 0).toLocaleString("vi-VN")} cuộc hội thoại AI/ngày` : "",
    campaignUsage,
    autoUsage,
    plan.support || "",
  ].filter(Boolean);
}

function planFeatures(plan: ServicePlan) {
  if (plan.features?.length) return plan.features;
  return fallbackFeatureText(plan).map((text) => ({ text, included: true }));
}

function limitText(value: number | null | undefined, unlimited?: boolean) {
  if (unlimited) return "Không giới hạn";
  return Number(value || 0).toLocaleString("vi-VN");
}

function comparisonValue(row: ServicePlanComparisonRow, rowIndex: number, plan: ServicePlan) {
  const configuredValue = (row as unknown as Record<string, string>)[plan.code];
  if (configuredValue) return configuredValue;
  if (rowIndex === 0) return plan.bots || "-";
  if (rowIndex === 1) return plan.channels || "-";
  if (rowIndex === 2) return plan.messages || "-";
  if (rowIndex === 3) return limitText(plan.campaign_usage_limit, plan.campaign_usage_unlimited);
  if (rowIndex === 4) return limitText(plan.automation_usage_limit, plan.automation_usage_unlimited);
  if (rowIndex === 8) return plan.support || "-";
  const feature = planFeatures(plan)[rowIndex];
  if (!feature?.text) return "-";
  return feature.included ? feature.text : "Không bao gồm";
}

export default function PackagesPage() {
  const { user } = useAuthUser();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [comparisonRows, setComparisonRows] = useState<ServicePlanComparisonRow[]>(fallbackRows);

  useEffect(() => {
    fetchServicePlans()
      .then((items) => setPlans(items))
      .catch((error) => showToast(error instanceof Error ? error.message : "Không thể tải gói dịch vụ.", "error"));

    fetchServicePlanComparisonRows()
      .then((rows) => {
        if (rows.length) setComparisonRows(rows);
      })
      .catch(() => null);
  }, []);

  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active !== false), [plans]);
  const mainBalance = formatVnd(user?.money);
  const activePlanName = user?.plan_name || "Chưa có gói";
  const isPlanActive = Boolean(user?.plan_active);
  const currentPlan = useMemo(
    () => activePlans.find((plan) => plan.code === user?.plan_code) || null,
    [activePlans, user?.plan_code]
  );

  const actionLabel = (plan: ServicePlan) => {
    if (user?.plan_code === plan.code) return "Gia hạn gói";
    if (user?.plan_code && isPlanActive) return "Nâng cấp gói";
    return "Mua gói";
  };

  const confirmLabel = selectedPlan ? actionLabel(selectedPlan) : "Xác nhận";
  const balanceAfter = selectedPlan ? Number(user?.money ?? 0) - Number(selectedPlan.price || 0) : 0;
  const canPay = balanceAfter >= 0;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;

    const scrollCenter = container.scrollLeft + containerWidth / 2;
    const children = Array.from(container.children) as HTMLElement[];
    let closestIndex = 0;
    let minDistance = Infinity;

    children.forEach((child, index) => {
      if (child.tagName !== "ARTICLE") return;
      const distance = Math.abs(scrollCenter - (child.offsetLeft + child.offsetWidth / 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== activeSlide) setActiveSlide(closestIndex);
  };

  async function handleConfirmPackage() {
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
    <AppFrame active="/packages" title="Gói dịch vụ">
      <PageHeader
        title="Gói dịch vụ"
        desc="Chọn gói AI phù hợp để tự động trả lời khách hàng, chăm sóc hội thoại và kết nối Zalo/Facebook."
        action={<Link className="btn btn-red" href="/deposit"><Icon name="payments" /> Nạp tiền</Link>}
      />

      <section className="card pad between" style={{ marginBottom: 20 }}>
        <div className="row">
          <div style={{ width: 52, height: 52, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(224,36,36,.12)", color: "var(--red)" }}>
            <Icon name="smart_toy" size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: "var(--primary)" }}>Gói hiện tại: {activePlanName}</h2>
            <p className="subtitle">
              {isPlanActive
                ? `Đang hoạt động đến ${formatDate(user?.plan_expires_at)}.`
                : "Chưa có gói đang hoạt động. Mua hoặc gia hạn để vận hành AI bán hàng."}
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <span className={isPlanActive ? "status green" : "status red"}>{isPlanActive ? "Đang hoạt động" : "Hết hạn"}</span>
              <span className="muted" style={{ fontSize: 13 }}>Chu kỳ: hàng tháng</span>
            </div>
          </div>
        </div>
        <div className="row">
          <span className="chip"><Icon name="wallet" size={16} /> Số dư: {mainBalance}</span>
          <Link className="btn btn-secondary" href="/invoices">Xem hóa đơn</Link>
        </div>
      </section>

      <section className="grid-3 package-grid" onScroll={handleScroll} style={{ marginBottom: 20 }}>
        {activePlans.map((plan) => {
          const isCurrent = currentPlan?.code === plan.code;
          const popular = Boolean(plan.popular);

          return (
            <article className={`card pad package-card ${popular ? "package-popular" : ""}`} key={plan.id || plan.code}>
              {popular ? <div className="package-badge">Phổ biến nhất</div> : null}
              <div className="between">
                <h2 style={{ margin: 0 }}>{plan.name}</h2>
                {isCurrent ? <span className={isPlanActive ? "status green" : "status red"}>{isPlanActive ? "Hiện tại" : "Đã hết hạn"}</span> : null}
              </div>
              <p className="muted" style={{ minHeight: 58 }}>{plan.description}</p>
              <div className="package-price">
                {formatPlanPrice(plan)}
                <span>/{plan.cycle || "tháng"}</span>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {planFeatures(plan).map((feature, index) => (
                  <div className={feature.included ? "row package-feature" : "row package-feature is-disabled"} key={`${feature.text}-${index}`}>
                    <Icon name={feature.included ? "check_circle" : "remove_circle"} size={18} />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
              <button
                className={`btn ${popular ? "btn-red" : "btn-secondary"}`}
                onClick={() => setSelectedPlan(plan)}
                style={{ width: "100%", marginTop: 20 }}
                type="button"
              >
                {actionLabel(plan)}
              </button>
            </article>
          );
        })}
      </section>

      <div className="package-dots">
        {activePlans.map((plan, index) => (
          <button
            key={plan.id || plan.code}
            className={`package-dot ${activeSlide === index ? "active" : ""}`}
            onClick={() => {
              const container = document.querySelector(".package-grid");
              const child = container?.children[index] as HTMLElement | undefined;
              if (!container || !child) return;
              container.scrollTo({
                left: child.offsetLeft - (container.clientWidth - child.offsetWidth) / 2,
                behavior: "smooth",
              });
            }}
            aria-label={`Slide ${index + 1}`}
            type="button"
          />
        ))}
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
          <div className="row">
            <Icon name="list_alt" />
            <h2 style={{ margin: 0 }}>So sánh quyền lợi</h2>
          </div>
          <p className="subtitle">Thông tin gói được đồng bộ với bảng giá trên landing page và cấu hình trong admin.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tính năng</th>
                {activePlans.map((plan) => (
                  <th key={plan.id || plan.code}>Gói {plan.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, index) => (
                <tr key={`${row.feature}-${index}`}>
                  <td><strong>{row.feature}</strong></td>
                  {activePlans.map((plan) => (
                    <td key={`${row.feature}-${plan.id || plan.code}`}>{comparisonValue(row, index, plan)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid-2">
        <div className="card pad">
          <div className="row">
            <Icon name="verified_user" />
            <h2 style={{ margin: 0 }}>Lưu ý khi đổi gói</h2>
          </div>
          <p className="muted">Khi nâng cấp, giới hạn bot AI, kênh Zalo/Facebook, cuộc hội thoại AI và lượt Auto Facebook/Threads sẽ được cập nhật theo gói mới. Dữ liệu hội thoại và cấu hình hiện có vẫn được giữ nguyên.</p>
        </div>
        <div className="card pad hero-card">
          <div>
            <Icon name="rocket_launch" size={42} />
            <h2>Sẵn sàng kích hoạt AI?</h2>
            <p className="subtitle">Nạp tiền và chọn gói để tiếp tục vận hành AI bán hàng tự động.</p>
            <Link className="btn btn-red" href="/deposit" style={{ marginTop: 16 }}>Nạp tiền ngay</Link>
          </div>
        </div>
      </section>

      {selectedPlan ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setSelectedPlan(null)}>
          <div className="confirm-modal confirm-modal-dark" role="dialog" aria-modal="true" aria-labelledby="package-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <span className="eyebrow">{confirmLabel}</span>
                <h2 id="package-modal-title">{selectedPlan.name}</h2>
              </div>
              <button className="btn btn-secondary icon-top-button" disabled={saving} onClick={() => setSelectedPlan(null)} type="button" aria-label="Đóng">
                <Icon name="x" />
              </button>
            </div>
            <p className="subtitle">{selectedPlan.description}</p>
            <div className="confirm-lines">
              <div className="between"><span>Giá gói</span><strong>{formatPlanPrice(selectedPlan)}</strong></div>
              <div className="between"><span>Chu kỳ</span><strong>{selectedPlan.days || 30} ngày</strong></div>
              <div className="between"><span>Số dư hiện tại</span><strong>{mainBalance}</strong></div>
              <div className="between"><span>Số dư sau thanh toán</span><strong className={canPay ? "" : "danger-text"}>{formatVnd(balanceAfter)}</strong></div>
            </div>
            {!canPay ? <div className="form-message error">Số dư không đủ để thanh toán gói này.</div> : null}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-secondary" disabled={saving} onClick={() => setSelectedPlan(null)} type="button">Hủy</button>
              {canPay ? (
                <button className="btn btn-red" disabled={saving} onClick={handleConfirmPackage} type="button">
                  {saving ? "Đang xử lý..." : confirmLabel}
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
