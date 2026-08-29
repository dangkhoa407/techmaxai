import { NextResponse } from "next/server";
import { getBotStatus } from "../../../../facebook-auto/lib/bot";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    return NextResponse.json({ ok: true, status: await getBotStatus(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể tải trạng thái bot." },
      { status: 400 }
    );
  }
}
