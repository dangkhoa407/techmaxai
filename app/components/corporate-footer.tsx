"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const revealDelay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

type CorporateFooterProps = {
  animate?: boolean;
};

export default function CorporateFooter({ animate = true }: CorporateFooterProps) {
  const revealProps = animate ? { "data-reveal": true } : {};
  const revealStyle = (ms: number) => (animate ? revealDelay(ms) : undefined);

  return (
    <footer
      className={`corporate-footer${animate ? "" : " no-reveal"}`}
      style={{ borderTop: "1px solid var(--border)", background: "rgba(20, 19, 19, 0.4)", marginTop: 60 }}
    >
      <div className="footer-main">
        <div className="footer-company" {...revealProps}>
          <img src="/logo-text.png" alt="TECHMAX" width={5669} height={1512} loading="lazy" decoding="async" />
          <p>
            Nền tảng AI hỗ trợ doanh nghiệp tự động hóa quy trình bán hàng, chăm sóc khách hàng và tối ưu hiệu suất vận hành.
          </p>
          <div className="footer-status">
            <span />
            Hệ thống đang hoạt động ổn định
          </div>
        </div>

        <div className="footer-col" {...revealProps} style={revealStyle(90)}>
          <h3>Sản phẩm</h3>
          <Link href="/#features">Tính năng</Link>
          <Link href="/#pricing">Bảng giá</Link>
          <Link href="/packages">Gói dịch vụ</Link>
          <Link href="/zalo-accounts">Quản lý Zalo</Link>
        </div>

        <div className="footer-col" {...revealProps} style={revealStyle(160)}>
          <h3>Giải pháp</h3>
          <a href="#">Marketing</a>
          <a href="#">Tự động chăm sóc khách</a>
          <a href="#">Quản lý Fanpage</a>
          <a href="#">Chat Bot AI</a>
        </div>

        <div className="footer-col" {...revealProps} style={revealStyle(230)}>
          <h3>Tài nguyên</h3>
          <a href="#">Tài liệu hướng dẫn</a>
          <a href="#">Trung tâm hỗ trợ</a>
          <a href="#">Câu hỏi thường gặp</a>
          <a href="#">Trạng thái hệ thống</a>
        </div>

        <div className="footer-contact" {...revealProps} style={revealStyle(300)}>
          <h3>Liên hệ</h3>
          <a href="mailto:support@techmax.vn">support@techmax.vn</a>
          <a href="tel:+84123456789">+84 123 456 789</a>
          <p>Hỗ trợ kỹ thuật: 08:00 - 22:00 hằng ngày</p>
        </div>
      </div>

      <div className="footer-bottom" {...revealProps}>
        <p>© 2026 TECHMAX. Bảo lưu mọi quyền.</p>
        <div>
          <Link href="/policy?tab=terms">Điều khoản dịch vụ</Link>
          <Link href="/policy?tab=privacy">Chính sách bảo mật</Link>
          <Link href="/policy?tab=payment">Chính sách hoàn tiền</Link>
        </div>
      </div>
    </footer>
  );
}
