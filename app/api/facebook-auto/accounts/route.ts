import { NextResponse } from "next/server";
import { deleteFacebookAutoAccount, listFacebookAutoAccounts, refreshFacebookAutoAccount, saveFacebookAutoAccounts, updateFacebookAutoAccountCookie, updateFacebookAutoAccountProxy } from "../../../facebook-auto/lib/accounts";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { clearFacebookAutoLogs, snapshot } from "../../../facebook-auto/lib/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refreshAccountLocks = new Map<string, Promise<unknown>>();

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    return NextResponse.json({ ok: true, accounts: await listFacebookAutoAccounts(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể tải tài khoản Facebook." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { cookies?: unknown; cookie?: unknown };
    const deviceKey = request.headers.get("x-facebook-auto-device-id")?.trim() || "";
    const ownerId = await requireFacebookAutoUserId(request);
    const accounts = await saveFacebookAutoAccounts({ ...body, deviceKey }, ownerId);
    return NextResponse.json({ ok: true, accounts, status: snapshot(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể lưu tài khoản Facebook." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ ok: false, message: "Thiếu ID tài khoản." }, { status: 400 });
    }
    const ownerId = await requireFacebookAutoUserId(request);
    return NextResponse.json({ ok: true, accounts: await deleteFacebookAutoAccount(body.id, ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể xóa tài khoản Facebook." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; clearLogs?: unknown };
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ ok: false, message: "Thiếu ID tài khoản." }, { status: 400 });
    }
    const ownerId = await requireFacebookAutoUserId(request);
    const lockKey = `${ownerId}:${body.id}`;
    const existingRun = refreshAccountLocks.get(lockKey);
    if (existingRun) {
      await existingRun;
      return NextResponse.json({ ok: true, accounts: await listFacebookAutoAccounts(ownerId), status: snapshot(ownerId) });
    }

    if (body.clearLogs === true) {
      clearFacebookAutoLogs(ownerId);
    }
    const run = refreshFacebookAutoAccount(body.id, ownerId);
    refreshAccountLocks.set(lockKey, run);
    try {
      const accounts = await run;
      return NextResponse.json({ ok: true, accounts, status: snapshot(ownerId) });
    } finally {
      refreshAccountLocks.delete(lockKey);
    }
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể check tài khoản Facebook." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; cookie?: unknown; proxy?: unknown };
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ ok: false, message: "Thiếu ID tài khoản." }, { status: 400 });
    }
    const ownerId = await requireFacebookAutoUserId(request);
    if (body.proxy !== undefined && body.cookie === undefined) {
      const accounts = await updateFacebookAutoAccountProxy(body.id, body.proxy, ownerId);
      return NextResponse.json({ ok: true, accounts, status: snapshot(ownerId) });
    }
    const accounts = await updateFacebookAutoAccountCookie(body.id, body.cookie, ownerId);
    return NextResponse.json({ ok: true, accounts, status: snapshot(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể cập nhật cookie tài khoản Facebook." },
      { status: 400 }
    );
  }
}
