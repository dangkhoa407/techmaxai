import { NextResponse } from "next/server";
import {
  getFacebookAutoHeadlessChrome,
  getFacebookAutoLowResourceMode,
  getFacebookAutoMaxWorkers,
  setFacebookAutoHeadlessChrome,
  setFacebookAutoLowResourceMode,
  setFacebookAutoMaxWorkers
} from "../../../facebook-auto/lib/database";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireFacebookAutoUserId(request);
    return NextResponse.json({
      ok: true,
      settings: {
        max_workers: await getFacebookAutoMaxWorkers(),
        headless_chrome: await getFacebookAutoHeadlessChrome(),
        low_resource_mode: await getFacebookAutoLowResourceMode(),
      },
    });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể tải cấu hình hệ thống." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireFacebookAutoUserId(request);
    const body = await request.json().catch(() => ({}));
    const maxWorkers = Number(body?.max_workers ?? body?.maxWorkers);
    const headlessChrome = body?.headless_chrome ?? body?.headlessChrome;
    const lowResourceMode = body?.low_resource_mode ?? body?.lowResourceMode;

    const nextMaxWorkers = Number.isFinite(maxWorkers)
      ? await setFacebookAutoMaxWorkers(maxWorkers)
      : await getFacebookAutoMaxWorkers();
    const nextHeadlessChrome = typeof headlessChrome === "boolean"
      ? await setFacebookAutoHeadlessChrome(headlessChrome)
      : await getFacebookAutoHeadlessChrome();
    const nextLowResourceMode = typeof lowResourceMode === "boolean"
      ? await setFacebookAutoLowResourceMode(lowResourceMode)
      : await getFacebookAutoLowResourceMode();

    return NextResponse.json({
      ok: true,
      settings: {
        max_workers: nextMaxWorkers,
        headless_chrome: nextHeadlessChrome,
        low_resource_mode: nextLowResourceMode,
      },
    });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể lưu cấu hình hệ thống." },
      { status: 400 }
    );
  }
}
