import { NextResponse } from "next/server";
import {
  deleteThreadsAutoAccount,
  listThreadsAutoAccounts,
  refreshThreadsAutoAccount,
  saveThreadsAutoAccounts,
  updateThreadsAutoAccountCookie,
  updateThreadsAutoAccountProxy
} from "../../../threads-auto/lib/accounts";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refreshAccountLocks = new Map<string, Promise<unknown>>();

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    return NextResponse.json({ ok: true, accounts: await listThreadsAutoAccounts(ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể tải tài khoản Threads." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { cookies?: unknown; cookie?: unknown };
    const deviceKey = request.headers.get("x-facebook-auto-device-id")?.trim() || "";
    const ownerId = await requireFacebookAutoUserId(request);
    const result = await saveThreadsAutoAccounts({ ...body, deviceKey }, ownerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể lưu tài khoản Threads." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ ok: false, message: "Thiếu ID tài khoản." }, { status: 400 });
    }
    const ownerId = await requireFacebookAutoUserId(request);
    const lockKey = `${ownerId}:${body.id}`;
    const existingRun = refreshAccountLocks.get(lockKey);
    if (existingRun) {
      await existingRun;
      return NextResponse.json({ ok: true, accounts: await listThreadsAutoAccounts(ownerId) });
    }

    const run = refreshThreadsAutoAccount(body.id, ownerId);
    refreshAccountLocks.set(lockKey, run);
    try {
      const accounts = await run;
      return NextResponse.json({ ok: true, accounts });
    } finally {
      refreshAccountLocks.delete(lockKey);
    }
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể check tài khoản Threads." },
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
      return NextResponse.json({ ok: true, accounts: await updateThreadsAutoAccountProxy(body.id, body.proxy, ownerId) });
    }
    return NextResponse.json({ ok: true, accounts: await updateThreadsAutoAccountCookie(body.id, body.cookie, ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể cập nhật cookie tài khoản Threads." },
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
    return NextResponse.json({ ok: true, accounts: await deleteThreadsAutoAccount(body.id, ownerId) });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể xóa tài khoản Threads." },
      { status: 400 }
    );
  }
}
