import { NextResponse } from "next/server";
import { startBot, validateConfig } from "../../../../facebook-auto/lib/bot";
import { getFacebookAutoHeadlessChrome } from "../../../../facebook-auto/lib/database";
import { getFacebookAutoAccountRuntimeInputs } from "../../../../facebook-auto/lib/accounts";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ownerId = await requireFacebookAutoUserId(request);
    const accountInputs = await getFacebookAutoAccountRuntimeInputs(ownerId, body.accountIds);
    if (!Array.isArray(body.accountIds) || body.accountIds.length === 0) {
      return NextResponse.json({ ok: false, message: "Hãy chọn ít nhất một tài khoản Facebook đã lưu trước khi chạy bot." }, { status: 400 });
    }
    if (accountInputs.length > 0) {
      body.cookie = accountInputs.map((account) => account.cookie).join("\n");
      body.accountProxies = accountInputs.map((account) => account.proxy || "");
    }
    if (!body.cookie || typeof body.cookie !== "string" || !body.cookie.trim()) {
      return NextResponse.json({ ok: false, message: "Chỉ có thể chạy bot với tài khoản trạng thái hoạt động." }, { status: 400 });
    }
    const config = validateConfig(body);
    config.headlessChrome = config.headlessChrome && (await getFacebookAutoHeadlessChrome());
    return NextResponse.json({ ok: true, status: await startBot(ownerId, config) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể khởi động bot." },
      { status: 400 }
    );
  }
}
