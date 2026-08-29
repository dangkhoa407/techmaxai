"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthPublicRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (window.localStorage.getItem("techmax_auth_token")) {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}
