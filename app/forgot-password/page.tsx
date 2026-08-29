"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authRedirectPath, requestPasswordReset, resetPassword, useAuthUser } from "../lib/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace(authRedirectPath(user));
  }, [authLoading, router, user]);

  async function onRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload = await requestPasswordReset(email);
      setMessage(payload.message || "Mã đặt lại mật khẩu đã được gửi tới email của bạn.");
      setMessageType("success");
      setStep("reset");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi mã đặt lại mật khẩu.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function onResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp.");
      setMessageType("error");
      return;
    }
    setLoading(true);
    try {
      const payload = await resetPassword({ email, code, password });
      setMessage(payload.message || "Đã đặt lại mật khẩu.");
      setMessageType("success");
      setTimeout(() => router.push("/login"), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đặt lại mật khẩu.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
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
            <h1 className="title" style={{ fontSize: 28 }}>{step === "email" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}</h1>
            <p className="subtitle">
              {step === "email"
                ? "Nhập email tài khoản để nhận mã đặt lại mật khẩu."
                : `Nhập mã 6 số đã gửi tới ${email}.`}
            </p>
          </div>

          {step === "email" ? (
            <form className="stack" onSubmit={onRequestCode}>
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
              {message ? <div className={`form-message ${messageType}`}>{message}</div> : null}
              <button className="btn btn-primary" disabled={loading} style={{ width: "100%" }} type="submit">
                {loading ? "Đang gửi mã..." : "Gửi mã đặt lại"}
              </button>
            </form>
          ) : (
            <form className="stack" onSubmit={onResetPassword}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Mã xác thực</span>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  style={{ textAlign: "center", letterSpacing: 8, fontSize: 28, fontWeight: 900 }}
                />
              </label>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Mật khẩu mới</span>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    style={{ paddingRight: "44px" }}
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
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
                      outline: "none",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Nhập lại mật khẩu</span>
                <input
                  className="input"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>
              {message ? <div className={`form-message ${messageType}`}>{message}</div> : null}
              <button className="btn btn-primary" disabled={loading || code.length !== 6} style={{ width: "100%" }} type="submit">
                {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={loading}
                style={{ width: "100%" }}
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setMessage("");
                }}
              >
                Đổi email
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 24 }}>
            Nhớ mật khẩu rồi? <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>Đăng nhập</Link>
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
