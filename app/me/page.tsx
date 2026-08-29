"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "../lib/auth";

export default function MePage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/profile" : "/login");
  }, [loading, router, user]);

  return <main className="auth-page" suppressHydrationWarning />;
}
