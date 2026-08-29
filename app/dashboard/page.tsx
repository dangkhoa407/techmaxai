"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppFrame, Icon, PageHeader, StatCard, VerifiedBadge } from "../components";
import { fetchDashboard, formatVnd, useAuthUser, type DashboardPayload } from "../lib/auth";

function formatDate(value?: string | null) {
  if (!value) return "Chưa kích hoạt";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function percent(used: number, limit: number | null, unlimited = false) {
  if (unlimited) return 100;
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function limitText(used: number, limit: number | null, unlimited = false) {
  return unlimited ? `${formatNumber(used)}/Không giới hạn` : `${formatNumber(used)}/${formatNumber(limit || 0)}`;
}

export default function DashboardPage() {
  const { user } = useAuthUser();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDashboardPopup, setShowDashboardPopup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboard()
      .then((payload) => {
        if (cancelled) return;
        setDashboard(payload);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentUser = dashboard?.user || user;
  const plan = dashboard?.plan;
  const summary = dashboard?.summary;
  const chart = dashboard?.message_chart || [];
  const recentZaloAccounts = dashboard?.recent_zalo_accounts || [];
  const dashboardPopup = dashboard?.dashboard_popup || null;
  const displayName = currentUser?.fullname || "hecker";
  const planName = plan?.name || currentUser?.plan_name || "Chưa có gói";
  const planActive = Boolean(plan?.active ?? currentUser?.plan_active);
  const planPrice = formatVnd(plan?.price ?? currentUser?.plan_price);
  const channelPercent = percent(summary?.active_channels || 0, plan?.channel_limit ?? 0, Boolean(plan?.channel_limit_unlimited));
  const conversationPercent = percent(summary?.customers_today || 0, plan?.message_limit ?? 0, Boolean(plan?.message_limit_unlimited));
  const campaignUsagePercent = percent(plan?.campaign_usage_used || 0, plan?.campaign_usage_limit ?? 0, Boolean(plan?.campaign_usage_unlimited));
  const automationUsagePercent = percent(plan?.automation_usage_used || 0, plan?.automation_usage_limit ?? 0, Boolean(plan?.automation_usage_unlimited));
  const maxChartMessages = useMemo(() => Math.max(1, ...chart.map((item) => item.messages)), [chart]);

  useEffect(() => {
    if (!dashboardPopup?.enabled || !dashboardPopup.html) {
      setShowDashboardPopup(false);
      return;
    }
    const dismissKey = `techmax_dashboard_popup_dismissed_until_${dashboardPopup.version || "default"}`;
    const dismissedUntil = Number(window.localStorage.getItem(dismissKey) || 0);
    setShowDashboardPopup(Date.now() > dismissedUntil);
  }, [dashboardPopup?.enabled, dashboardPopup?.html, dashboardPopup?.version]);

  function closeDashboardPopup() {
    setShowDashboardPopup(false);
  }

  function dismissDashboardPopupForTwoHours() {
    if (dashboardPopup) {
      const dismissKey = `techmax_dashboard_popup_dismissed_until_${dashboardPopup.version || "default"}`;
      const hours = Number(dashboardPopup.dismiss_hours || 2);
      window.localStorage.setItem(dismissKey, String(Date.now() + hours * 60 * 60 * 1000));
    }
    setShowDashboardPopup(false);
  }

  return (
    <AppFrame active="/dashboard" title="Dashboard">
      <PageHeader
        eyebrow="Trang tổng quan khách hàng"
        title={(
          <span className="name-with-badge">
            Xin chào, {displayName}
            {currentUser?.verified_badge ? <VerifiedBadge size={22} /> : null}
          </span>
        )}
      />

      {dashboardPopup?.enabled && showDashboardPopup ? (
        <div className="dashboard-popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-popup-title">
          <div className="dashboard-popup-modal">
            <div className="dashboard-popup-head">
              <h2 id="dashboard-popup-title">{dashboardPopup.title || "Thông báo"}</h2>
              <button className="icon-btn" type="button" onClick={closeDashboardPopup} aria-label="Đóng thông báo">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="dashboard-popup-content" dangerouslySetInnerHTML={{ __html: dashboardPopup.html }} />
            <div className="dashboard-popup-actions">
              <button className="btn btn-secondary" type="button" onClick={dismissDashboardPopupForTwoHours}>
                <Icon name="notifications" size={16} /> Tắt trong 2 tiếng
              </button>
              <button className="btn btn-primary" type="button" onClick={closeDashboardPopup}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="form-message error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <section className="card pad between dashboard-plan-summary" style={{ marginBottom: 16 }}>
        <div className="row dashboard-plan-main">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              color: planActive ? "#34d399" : "var(--danger)",
              background: planActive ? "rgba(16,185,129,.18)" : "rgba(147,0,10,.25)",
            }}
          >
            <Icon name={planActive ? "check_circle" : "warning"} size={30} />
          </div>
          <div className="dashboard-plan-details">
            <div className="muted dashboard-plan-title-line">
              <span className="dashboard-plan-name">Gói hiện tại: <strong style={{ color: "var(--primary)" }}>{planName}</strong> • {plan?.cycle || "hàng tháng"}</span>
              <span className={planActive ? "status green" : "status red"}>{planActive ? "Đang hoạt động" : "Hết hạn"}</span>
            </div>
            <div className="row dashboard-plan-expiry" style={{ marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>Hết hạn: {formatDate(plan?.expires_at ?? currentUser?.plan_expires_at)}</span>
            </div>
          </div>
        </div>
        <div className="row">
          <span className="chip"><Icon name="analytics" size={16} /> Phiên hoạt động: {formatNumber(summary?.active_sessions || currentUser?.session_count || 0)}</span>
          <button className="btn btn-secondary" disabled={loading} onClick={() => fetchDashboard().then(setDashboard).catch((err) => setError(err instanceof Error ? err.message : "Không thể tải dữ liệu dashboard."))} type="button">
            <Icon name="update" size={16} /> Làm mới
          </button>
          <Link className="btn btn-secondary" href="/plan-management">Quản lý gói</Link>
        </div>
      </section>

      <section className="grid-4 dashboard-metric-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Ví chính" value={formatVnd(currentUser?.money)} help="Sẵn sàng dùng cho hóa đơn mới" icon="account_balance_wallet" />
        <StatCard
          label="Zalo/Facebook"
          value={limitText(summary?.active_channels || 0, plan?.channel_limit ?? 0, Boolean(plan?.channel_limit_unlimited))}
          help="Kênh đang hoạt động"
          icon="hub"
        />
        <StatCard
          label="Chiến dịch"
          value={limitText(plan?.campaign_usage_used || 0, plan?.campaign_usage_limit ?? 0, Boolean(plan?.campaign_usage_unlimited))}
          help="Lượt chạy chiến dịch"
          icon="campaign"
        />
        <StatCard
          label="Auto Facebook/Threads"
          value={limitText(plan?.automation_usage_used || 0, plan?.automation_usage_limit ?? 0, Boolean(plan?.automation_usage_unlimited))}
          help="Lượt dùng Auto Facebook/Threads"
          icon="smart_toy"
        />
      </section>

      <section className="grid-3 dashboard-analytics-grid" style={{ marginBottom: 16 }}>
        <div className="card pad dashboard-chart-card" style={{ gridColumn: "span 2", minHeight: 400 }}>
          <div className="row">
            <Icon name="message_circle" />
            <h2 style={{ margin: 0, fontSize: 20 }}>Khách nhắn tin trong 12 tháng</h2>
          </div>
          <p className="subtitle">
            Tổng tin nhắn khách gửi: {formatNumber(summary?.customer_messages_month || 0)} tin trong tháng này từ {formatNumber(summary?.customers_month || 0)} khách.
          </p>
          <div className="dashboard-chart-scroll">
          <div className="dashboard-bars" style={{ height: 260, display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10, marginTop: 36 }}>
            {(chart.length ? chart : Array.from({ length: 12 }, (_, index) => ({ label: `Th${index + 1}`, month: "", messages: 0, customers: 0 }))).map((item) => {
              const height = item.messages ? Math.max(10, Math.round((item.messages / maxChartMessages) * 220)) : 4;
              return (
                <div key={`${item.month}-${item.label}`} style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: 10, minWidth: 34 }}>
                  <div
                    className="dashboard-bar"
                    title={`${item.label}: ${formatNumber(item.messages)} tin, ${formatNumber(item.customers)} khách`}
                    style={{
                      width: 30,
                      height,
                      borderRadius: "6px 6px 0 0",
                      background: item.messages ? "linear-gradient(180deg, #34d399, #15803d)" : "var(--card-3)",
                    }}
                  />
                  <strong style={{ color: "var(--primary)", fontSize: 11 }}>{formatNumber(item.messages)}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{item.label}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="card pad dashboard-usage-card" style={{ minHeight: 400 }}>
          <div className="row">
            <Icon name="monitoring" />
            <h2 style={{ margin: 0, fontSize: 20 }}>Mức sử dụng theo giới hạn</h2>
          </div>
          {[
            {
              label: "Kênh Zalo/Fanpage đang bật",
              value: limitText(summary?.active_channels || 0, plan?.channel_limit ?? 0, Boolean(plan?.channel_limit_unlimited)),
              help: `Đang sử dụng ${channelPercent}% giới hạn kênh.`,
              percent: channelPercent,
            },
            {
              label: "Cuộc hội thoại AI tiếp nhận hôm nay",
              value: limitText(summary?.customers_today || 0, plan?.message_limit ?? 0, Boolean(plan?.message_limit_unlimited)),
              help: `Hạn mức theo gói ${planName}. AI đã tiếp nhận ${formatNumber(summary?.customers_today || 0)} cuộc hội thoại hôm nay`,
              percent: conversationPercent,
            },
            {
              label: "Lượt chạy chiến dịch",
              value: limitText(plan?.campaign_usage_used || 0, plan?.campaign_usage_limit ?? 0, Boolean(plan?.campaign_usage_unlimited)),
              help: plan?.campaign_usage_unlimited
                ? "Gói này không giới hạn lượt chạy chiến dịch."
                : `Đã dùng ${formatNumber(plan?.campaign_usage_used || 0)} lượt chạy chiến dịch trong gói hiện tại.`,
              percent: campaignUsagePercent,
            },
            {
              label: "Lượt dùng Auto Facebook/Threads",
              value: limitText(plan?.automation_usage_used || 0, plan?.automation_usage_limit ?? 0, Boolean(plan?.automation_usage_unlimited)),
              help: plan?.automation_usage_unlimited
                ? "Gói này không giới hạn lượt dùng Auto Facebook/Threads."
                : `Đã dùng ${formatNumber(plan?.automation_usage_used || 0)} lượt Auto Facebook/Threads trong gói hiện tại.`,
              percent: automationUsagePercent,
            },
          ].map((item) => (
            <div key={item.label} style={{ marginTop: 28 }}>
              <div className="between">
                <strong>{item.label}</strong>
                <span className="muted">{item.value}</span>
              </div>
              <div style={{ height: 8, marginTop: 10, background: "var(--card-2)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${item.percent}%`, height: "100%", borderRadius: 999, background: item.percent >= 90 ? "var(--red)" : "#34d399" }} />
              </div>
              <p className="muted" style={{ fontSize: 12 }}>{item.help}</p>
            </div>
          ))}
          <div style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <div className="between muted"><span>Gói hiện tại</span><strong>{planName} • {plan?.cycle || "hàng tháng"}</strong></div>
            <div className="between muted"><span>Giá gói</span><strong>{planPrice}</strong></div>
            <div className="between muted"><span>Hội thoại cần trả lời</span><strong>{formatNumber(summary?.waiting_conversations || 0)}</strong></div>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="row" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <Icon name="history" />
            <h2 style={{ margin: 0, fontSize: 20 }}>5 tài khoản Zalo cập nhật gần nhất</h2>
          </div>
          {recentZaloAccounts.length ? (
            <div className="stack" style={{ padding: 16 }}>
              {recentZaloAccounts.map((account) => (
                <div className="between" key={account.id} style={{ gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong>{account.display_name || account.phone_number || account.own_id}</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Cập nhật: {formatDate(account.last_seen_at || account.connected_at)}</p>
                  </div>
                  <span className={account.status === "active" ? "status green" : "status red"}>{account.status === "active" ? "Đang bật" : "Đã tắt"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ minHeight: 210, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <Icon name="cloud_off" size={48} />
                <p className="muted">Chưa có tài khoản Zalo nào được kết nối.</p>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="row" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <Icon name="bolt" />
            <h2 style={{ margin: 0, fontSize: 20 }}>Lối tắt thao tác nhanh</h2>
          </div>
          <div className="stack" style={{ padding: 16 }}>
            <Link className="nav-link" href="/chat"><Icon name="message_circle" /> Xem khách đang nhắn</Link>
            <Link className="nav-link" href="/zalo-accounts"><Icon name="person_add" /> Quản lý tài khoản Zalo</Link>
            <Link className="nav-link" href="/deposit"><Icon name="receipt_long" /> Tạo hóa đơn nạp tiền</Link>
            <Link className="nav-link" href="/packages"><Icon name="update" /> Gia hạn hoặc đổi gói</Link>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
