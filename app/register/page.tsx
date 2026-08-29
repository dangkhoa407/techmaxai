"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authRedirectPath, getOAuthStartUrl, getOAuthStatus, registerUser, resendRegisterEmailCode, useAuthUser, verifyRegisterEmail } from "../lib/auth";
import { showError } from "../lib/swal";

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "" };
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length < 6) score = Math.min(score, 1);

  const labels = ["", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"];
  return { score, label: labels[score] };
}

const getStrengthColor = (score: number) => {
  switch (score) {
    case 1: return "#ef4444";
    case 2: return "#f59e0b";
    case 3: return "#60a5fa";
    case 4: return "#34d399";
    default: return "var(--border)";
  }
};

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuthUser();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { score, label } = getPasswordStrength(password);

  useEffect(() => {
    if (!authLoading && user) router.replace(authRedirectPath(user));
  }, [authLoading, router, user]);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (!oauthError || authLoading || user) return;
    showError(oauthError);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("oauth_error");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/register?${nextQuery}` : "/register");
  }, [authLoading, router, searchParams, user]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await registerUser({ fullname, email, password });
      if (result.requires_verification) {
        setStep("verify");
        setMessage(result.message || "Mã xác thực đã được gửi tới email của bạn.");
        setMessageType("success");
        return;
      }
      router.push(authRedirectPath(result.user));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đăng ký.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const verifiedUser = await verifyRegisterEmail({ email, code: verifyCode });
      router.push(authRedirectPath(verifiedUser));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác thực email.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setResending(true);
    setMessage("");

    try {
      const payload = await resendRegisterEmailCode(email);
      setMessage(payload.message || "Mã xác thực mới đã được gửi.");
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi lại mã.");
      setMessageType("error");
    } finally {
      setResending(false);
    }
  }

  async function startOAuth(provider: "google" | "facebook") {
    try {
      const status = await getOAuthStatus();
      if (!status[provider]) {
        showError("Chức năng đang được phát triển");
        return;
      }
      window.location.assign(getOAuthStartUrl(provider, "register"));
    } catch {
      showError("Chức năng đang được phát triển");
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
            <h1 className="title" style={{ fontSize: 28 }}>{step === "verify" ? "Xác thực email" : "Tạo tài khoản"}</h1>
            <p className="subtitle">
              {step === "verify"
                ? `Nhập mã 6 số đã gửi tới ${email}.`
                : "Bắt đầu sử dụng TechMax với tài khoản của bạn."}
            </p>
          </div>

          {step === "form" ? (
            <>
            <form className="stack" onSubmit={onSubmit}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Họ và tên</span>
                <input
                  className="input"
                  placeholder="Nguyễn Văn A"
                  value={fullname}
                  onChange={(event) => setFullname(event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Email</span>
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
                  <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>Mật khẩu</span>
                  <span style={{ fontSize: 12, color: getStrengthColor(score), fontWeight: 700, transition: "color 0.2s ease" }}>{label}</span>
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
                <div className="row" style={{ marginTop: 8 }}>
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 999,
                        background: item <= score ? getStrengthColor(score) : "var(--border)",
                        transition: "background 0.2s ease",
                      }}
                    />
                  ))}
                </div>
              </label>
              {message ? <div className={`form-message ${messageType}`}>{message}</div> : null}
              <button className="btn btn-primary" disabled={loading} style={{ width: "100%" }} type="submit">
                {loading ? "Đang gửi mã..." : "Tạo tài khoản"}
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
            </>
          ) : (
            <form className="stack" onSubmit={onVerify}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Mã xác thực</span>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, ""))}
                  required
                  style={{ textAlign: "center", letterSpacing: 8, fontSize: 28, fontWeight: 900 }}
                />
              </label>
              {message ? <div className={`form-message ${messageType}`}>{message}</div> : null}
              <button className="btn btn-primary" disabled={loading || verifyCode.length < 6} style={{ width: "100%" }} type="submit">
                {loading ? "Đang xác thực..." : "Xác thực và đăng nhập"}
              </button>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="btn btn-secondary" disabled={resending} onClick={onResend} type="button">
                  {resending ? "Đang gửi..." : "Gửi lại mã"}
                </button>
                <button className="btn btn-secondary" onClick={() => setStep("form")} type="button">
                  Đổi email
                </button>
              </div>
            </form>
          )}

          <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 24 }}>
            Đã có tài khoản? <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>Đăng nhập</Link>
          </p>
        </div>
        <footer className="auth-footer">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Security</span>
        </footer>
      </section>
    </main>
  );
}
