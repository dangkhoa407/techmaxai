import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { togglePauseThreadsAutoRun } from "../../../threads-auto/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const status = await togglePauseThreadsAutoRun(ownerId);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể tạm dừng Auto Threads." },
      { status: 400 }
    );
  }
}