"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser, getToken, logoutUser } from "../lib/auth";
import { Icon, NavIcon, RouteTransitionOverlay } from "../components";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!getToken()) {
      router.replace("/login");
    }
  }, [mounted, loading, router]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (!mounted || loading) {
    return <div style={{ background: "#f6f7fb", minHeight: "100vh" }} suppressHydrationWarning />;
  }

  if (!getToken()) {
    return <div style={{ background: "#f6f7fb", minHeight: "100vh" }} />;
  }

  // Permission Check
  if (!user || user.level !== "admin") {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#f6f7fb",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 999,
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px"
          }}>
            <Icon name="warning" size={32} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#09090b", margin: "0 0 8px" }}>Không thể truy cập</h1>
          <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.5, margin: "0 0 24px" }}>
            Tài khoản <strong>{user?.fullname || "Khách"}</strong> không được cấp quyền quản trị. Vui lòng liên hệ với quản trị viên hệ thống để nâng cấp tài khoản.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/dashboard" className="cpanel-btn cpanel-btn-secondary" style={{ textDecoration: "none" }}>
              Quay lại Trang chủ
            </Link>
            <button
              onClick={async () => {
                await logoutUser();
                router.push("/login");
              }}
              className="cpanel-btn cpanel-btn-red"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    {
      label: "Tổng quan",
      items: [
        ["dashboard", "Admin Dashboard", "/admin"],
      ],
    },
    {
      label: "Quản trị hệ thống",
      items: [
        ["smart_toy", "Quản lý AI", "/admin/ai-management"],
        ["menu_book", "Quản lý hợp đồng", "/admin/contracts"],
        ["account_balance", "Cấu hình Bank", "/admin/bank-settings"],
        ["notifications", "Quản lý thông báo", "/admin/notifications"],
        ["message_circle", "Quản lý hội thoại", "/admin/chat"],
        ["groups", "Quản lý Thành viên", "/admin/users"],
        ["receipt_long", "Quản lý Hóa đơn", "/admin/invoices"],
        ["support_agent", "Quản lý Tickets", "/admin/tickets"],
        ["history", "Nhật ký hệ thống", "/admin/logs"],
      ],
    },
    {
      label: "Cấu hình",
      items: [
        ["shopping_bag", "Gói dịch vụ", "/admin/service-plans"],
        ["language", "Landing Page", "/admin/landing-settings"],
        ["notifications", "Thông báo Dashboard", "/admin/dashboard-popup"],
        ["mail", "Cấu hình Email", "/admin/mail-settings"],
        ["settings", "Cấu hình Website", "/admin/website-settings"],
        ["campaign", "Quảng cáo", "/admin/ads"],
      ],
    },
    {
      label: "Auto",
      items: [
        ["auto_facebook", "Auto Facebook/Threads", "/admin/facebook-auto"],
        ["settings", "Cấu hình Auto", "/admin/facebook-auto-settings"],
        ["group_work", "Fanpage Facebook", "/admin/facebook-pages"],
        ["zalo", "Tài khoản Zalo", "/admin/zalo-accounts"],
      ],
    },
  ];

  return (
    <div className="cpanel-shell">
      {/* Sidebar */}
      <aside className={`cpanel-sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="cpanel-sidebar-brand">
          <Link href="/admin">
            TechMax <span className="red-accent">Admin</span>
          </Link>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              background: "transparent",
              border: 0,
              color: "#ffffff",
              cursor: "pointer",
              padding: 4,
              display: "none"
            }}
            className="mobile-close-btn"
          >
            <Icon name="x" size={24} />
          </button>
        </div>
        <div className="cpanel-sidebar-nav">
          {sidebarLinks.map((group) => (
            <div key={group.label}>
              <div className="cpanel-nav-group-title">{group.label}</div>
              {group.items.map(([icon, label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className={`cpanel-nav-link ${pathname === href ? "active" : ""}`}
                >
                  <NavIcon name={icon} size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="cpanel-main-container">
        {/* Header */}
        <header className="cpanel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              style={{
                background: "transparent",
                border: 0,
                color: "#09090b",
                cursor: "pointer",
                padding: 4,
              }}
              className="cpanel-toggle-btn"
            >
              <Icon name="menu_open" />
            </button>
            <div className="cpanel-header-title">
              <p>Control panel</p>
              <p className="cpanel-title-text">Hệ thống tự động hóa TechMax</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="cpanel-designer-tag" style={{ fontSize: 13, color: "#71717a", fontWeight: 700 }}>
              Design By <strong style={{ color: "#ef4444" }}>Đăng Khoa</strong>
            </span>
            <Link href="/dashboard" className="cpanel-btn cpanel-btn-secondary" style={{ height: 36, textDecoration: "none" }}>
              <Icon name="logout" size={14} /> <span className="cpanel-btn-text">Về Dashboard chính</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="cpanel-content">
          {children}
        </main>
      </div>
      <RouteTransitionOverlay />

      <style jsx global>{`
        @media (max-width: 1024px) {
          .mobile-close-btn {
            display: block !important;
          }
          .cpanel-toggle-btn {
            display: block !important;
          }
          .cpanel-main-container {
            margin-left: 0 !important;
          }
        }
        @media (min-width: 1025px) {
          .cpanel-toggle-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
