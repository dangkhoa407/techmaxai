import { NextResponse } from "next/server";
import { togglePauseBot } from "../../../../facebook-auto/lib/bot";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    return NextResponse.json({ ok: true, status: await togglePauseBot(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể thay đổi trạng thái bot." },
      { status: 400 }
    );
  }
}
