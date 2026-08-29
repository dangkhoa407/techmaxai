"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authRedirectPath, clearSession, fetchProfile, saveSession } from "../../../lib/auth";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập...");

  useEffect(() => {
    const token = searchParams.get("token") || "";
    const provider = searchParams.get("provider") || "";
    const oauthError = searchParams.get("oauth_error") || searchParams.get("error") || "";

    if (oauthError) {
      router.replace(`/login?oauth_error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!token) {
      setMessage("Thiếu token đăng nhập.");
      router.replace(`/login?oauth_error=${encodeURIComponent("Đăng nhập thất bại.")}`);
      return;
    }

    let mounted = true;

    async function completeLogin() {
      try {
        localStorage.setItem("techmax_auth_token", token);
        const profile = await fetchProfile();
        if (!profile) throw new Error("Không thể tải thông tin tài khoản.");
        if (!mounted) return;
        saveSession(token, profile);
        setMessage(provider ? `Đăng nhập ${provider} thành công.` : "Đăng nhập thành công.");
        router.replace(authRedirectPath(profile));
      } catch (error) {
        clearSession();
        if (!mounted) return;
        const errorMessage = error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập.";
        setMessage(errorMessage);
        router.replace(`/login?oauth_error=${encodeURIComponent(errorMessage)}`);
      }
    }

    completeLogin();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <main className="auth-page">
      <section>
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h1 className="title" style={{ fontSize: 28, marginBottom: 12 }}>Đăng nhập OAuth</h1>
          <p className="subtitle">{message}</p>
        </div>
      </section>
    </main>
  );
}
