import Link from "next/link";

const quickLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/tickets", label: "Gửi ticket" }
];

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <div className="not-found-grid" aria-hidden="true" />
      <section className="not-found-panel" aria-labelledby="not-found-title">
        <div className="not-found-copy">
          <Link className="not-found-brand" href="/" aria-label="Về trang chủ TechMax">
            <img src="/favicon.png" alt="" />
            <span>TechMax</span>
          </Link>

          <p className="not-found-kicker">404 • Không tìm thấy trang</p>
          <h1 id="not-found-title">Trang này không còn tồn tại.</h1>
          <p className="not-found-description">
            Đường dẫn bạn vừa mở có thể đã bị đổi, bị xoá hoặc chưa được kích hoạt trên hệ thống.
          </p>

          <div className="not-found-actions" aria-label="Điều hướng nhanh">
            <Link className="not-found-primary" href="/">
              Về trang chủ
            </Link>
            <Link className="not-found-secondary" href="/dashboard">
              Mở dashboard
            </Link>
          </div>
        </div>

        <div className="not-found-visual" aria-hidden="true">
          <div className="not-found-code">404</div>
          <div className="not-found-console">
            <div>
              <span>route</span>
              <strong>not_found</strong>
            </div>
            <div>
              <span>status</span>
              <strong>HTTP 404</strong>
            </div>
            <div>
              <span>fallback</span>
              <strong>ready</strong>
            </div>
          </div>
        </div>

        <nav className="not-found-links" aria-label="Liên kết nhanh">
          {quickLinks.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
