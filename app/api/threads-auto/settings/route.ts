import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { getThreadsAutoSettings, saveThreadsAutoSettings } from "../../../threads-auto/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const data = await getThreadsAutoSettings(ownerId);
    return NextResponse.json({ ok: true, success: true, settings: data.settings, updated_at: data.updatedAt });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, success: false, message: error instanceof Error ? error.message : "Không thể tải cấu hình Auto Threads." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const body = (await request.json().catch(() => ({}))) as { settings?: unknown };
    const settings = body.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return NextResponse.json({ ok: false, success: false, message: "Cấu hình Auto Threads không hợp lệ." }, { status: 400 });
    }
    await saveThreadsAutoSettings(ownerId, settings);
    return NextResponse.json({ ok: true, success: true, settings });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, success: false, message: error instanceof Error ? error.message : "Không thể lưu cấu hình Auto Threads." },
      { status: 400 }
    );
  }
}
