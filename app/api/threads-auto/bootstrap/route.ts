import { NextRequest, NextResponse } from "next/server";
import { bootstrapThreadsAutoResume } from "../../../threads-auto/lib/runtime";

const DEFAULT_BOOTSTRAP_SECRET = "techmax-auto-bootstrap-internal-secret-2026";

function isLocalRequest(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const host = request.headers.get("host") || "";
  const hostname = request.nextUrl?.hostname || "";
  const candidates = [forwardedFor.split(",")[0], realIp, host.split(":")[0], hostname]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return candidates.some((value) => value === "localhost" || value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1");
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.FACEBOOK_AUTO_BOOTSTRAP_SECRET || DEFAULT_BOOTSTRAP_SECRET;
  const headerSecret = request.headers.get("x-facebook-auto-bootstrap-secret");
  if (headerSecret && headerSecret === secret) return true;
  return isLocalRequest(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await bootstrapThreadsAutoResume();
  return NextResponse.json({ ok: true, message: "Threads Auto resumed" });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await bootstrapThreadsAutoResume();
  return NextResponse.json({ ok: true, message: "Threads Auto resumed" });
}