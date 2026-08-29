import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { clearThreadsAutoResumeJob } from "../../../threads-auto/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const status = await clearThreadsAutoResumeJob(ownerId);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể xoá luồng resume Auto Threads." },
      { status: 400 }
    );
  }
}