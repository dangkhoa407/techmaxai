"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authRedirectPath, getOAuthStartUrl, getOAuthStatus, loginUser, useAuthUser } from "../lib/auth";
import { showError } from "../lib/swal";

const MOBILE_WIDTH_QUERY = "(max-width: 768px)";

export default function LoginPage({ mobileOnly = false }: { mobileOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuthUser();
  const [canRender, setCanRender] = useState(!mobileOnly);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mobileOnly) return;
    const mediaQuery = window.matchMedia(MOBILE_WIDTH_QUERY);
    const syncMobileState = () => setCanRender(mediaQuery.matches);
    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, [mobileOnly]);

  useEffect(() => {
    if (canRender && !authLoading && user) router.replace(authRedirectPath(user));
  }, [authLoading, canRender, router, user]);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (!oauthError || !canRender || authLoading || user) return;
    showError(oauthError);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("oauth_error");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/login?${nextQuery}` : "/login");
  }, [authLoading, canRender, router, searchParams, user]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const loggedInUser = await loginUser({ email, password, two_factor_code: twoFactorCode });
      router.push(authRedirectPath(loggedInUser));
    } catch (error) {
      if (error instanceof Error && (error as Error & { twoFactorRequired?: boolean }).twoFactorRequired) {
        setTwoFactorRequired(true);
      }
      const errorMessage = error instanceof Error ? error.message : "Không thể đăng nhập.";
      setMessage(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function startOAuth(provider: "google" | "facebook") {
    try {
      const status = await getOAuthStatus();
      if (!status[provider]) {
        showError("Chức năng đang được phát triển");
        return;
      }
      window.location.assign(getOAuthStartUrl(provider, "login"));
    } catch {
      showError("Chức năng đang được phát triển");
    }
  }

  if (!canRender || authLoading || user) {
    return <main className="auth-page" suppressHydrationWarning />;
  }

  return (
    <main className="auth-page">
      <section>
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/favicon.png" alt="TechMax" width={28} height={28} />
          </div>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 className="title" style={{ fontSize: 28 }}>Chào mừng trở lại</h1>
            <p className="subtitle">Đăng nhập để tiếp tục sử dụng TechMax</p>
          </div>
          <form className="stack" onSubmit={onSubmit}>
            <label>
              <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Địa chỉ email</span>
              <input
                className="input"
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="between" style={{ marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: 12 }}>Mật khẩu</span>
                <Link className="muted" style={{ fontSize: 12 }} href="/forgot-password">Quên mật khẩu?</Link>
              </span>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  style={{ paddingRight: "44px" }}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "4px",
                    cursor: "pointer",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outline: "none"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {twoFactorRequired ? (
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Mã xác thực hai lớp</span>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </label>
            ) : null}
            {message ? <div className="form-message error">{message}</div> : null}
            <button className="btn btn-primary" disabled={loading} style={{ width: "100%" }} type="submit">
              {loading ? "Đang đăng nhập..." : "Tiếp tục"}
            </button>
          </form>
          <div className="row" style={{ margin: "24px 0" }}>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
            <span className="muted" style={{ fontSize: 11, letterSpacing: ".18em" }}>HOẶC</span>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          </div>
          <div className="stack">
            <button className="btn btn-secondary" style={{ width: "100%" }} type="button" onClick={() => startOAuth("google")}>
              Tiếp tục với Google
            </button>
            <button className="btn btn-secondary" style={{ width: "100%" }} type="button" onClick={() => startOAuth("facebook")}>
              Tiếp tục với Facebook
            </button>
          </div>
          <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 24 }}>
            Chưa có tài khoản? <Link href="/register" style={{ color: "var(--primary)", fontWeight: 700 }}>Đăng ký</Link>
          </p>
        </div>
        <footer className="auth-footer">
          <span>© 2026 TechMax Systems</span>
          <span>Điều khoản</span>
          <span>Bảo mật</span>
        </footer>
      </section>
    </main>
  );
}
