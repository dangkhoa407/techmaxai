import { NextResponse } from "next/server";
import { exportThreadsAutoAccounts } from "../../../../threads-auto/lib/accounts";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ownerId = await requireFacebookAutoUserId(request);
    const result = await exportThreadsAutoAccounts(ownerId, body.ids);

    if (result.count === 0) {
      return NextResponse.json({ ok: false, message: "Chua chon tai khoan de xuat." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Khong the xuat du lieu tai khoan Threads." },
      { status: 400 }
    );
  }
}
