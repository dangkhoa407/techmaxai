import { NextResponse } from "next/server";
import { reserveFacebookAutoAutomationUsage } from "../../../facebook-auto/lib/accounts";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { getThreadsAutoAccountsForRun } from "../../../threads-auto/lib/accounts";
import { startThreadsAutoRun, stopThreadsAutoRun } from "../../../threads-auto/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunBody = {
  accountIds?: unknown;
  enableGroupPost?: unknown;
  enableFeedComment?: unknown;
  enableSearchComment?: unknown;
  randomizeTasks?: unknown;
  groupPostCount?: unknown;
  feedCommentCount?: unknown;
  searchCommentCount?: unknown;
  groupPostDelaySeconds?: unknown;
  feedCommentDelaySeconds?: unknown;
  searchCommentDelaySeconds?: unknown;
  groupPostTopics?: unknown;
  groupPostContents?: unknown;
  feedComments?: unknown;
  feedCommentContents?: unknown;
  searchKeyword?: unknown;
  searchComments?: unknown;
  searchCommentContents?: unknown;
};

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const body = (await request.json().catch(() => ({}))) as RunBody;
    const accountIds = stringList(body.accountIds);
    const enableGroupPost = body.enableGroupPost !== false;
    const enableFeedComment = body.enableFeedComment === true;
    const enableSearchComment = body.enableSearchComment === true;
    const randomizeTasks = body.randomizeTasks === true;
    const contents = stringList(body.groupPostContents);
    const topics = stringList(body.groupPostTopics);
    const feedCommentContents = stringList(body.feedComments ?? body.feedCommentContents);
    const searchKeyword = String(body.searchKeyword || "").trim();
    const searchCommentContents = stringList(body.searchComments ?? body.searchCommentContents);
    const count = Math.max(1, Math.min(500, Math.floor(Number(body.groupPostCount) || 1)));
    const feedCommentCount = Math.max(1, Math.min(500, Math.floor(Number(body.feedCommentCount) || 1)));
    const searchCommentCount = Math.max(1, Math.min(500, Math.floor(Number(body.searchCommentCount) || 1)));
    const delaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(body.groupPostDelaySeconds) || 0)));
    const feedCommentDelaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(body.feedCommentDelaySeconds) || 0)));
    const searchCommentDelaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(body.searchCommentDelaySeconds) || 0)));

    if (!enableGroupPost && !enableFeedComment && !enableSearchComment) {
      return NextResponse.json({ ok: false, message: "B\u1eadt \u00edt nh\u1ea5t m\u1ed9t t\u00e1c v\u1ee5 Threads." }, { status: 400 });
    }
    if (!accountIds.length) {
      return NextResponse.json({ ok: false, message: "H\u00e3y ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t t\u00e0i kho\u1ea3n Threads." }, { status: 400 });
    }
    if (enableGroupPost && !contents.length) {
      return NextResponse.json({ ok: false, message: "\u0110\u0103ng Post c\u1ea7n \u00edt nh\u1ea5t m\u1ed9t n\u1ed9i dung b\u00e0i \u0111\u0103ng." }, { status: 400 });
    }
    if (enableFeedComment && !feedCommentContents.length) {
      return NextResponse.json({ ok: false, message: "Comment newfeed c\u1ea7n danh s\u00e1ch comment." }, { status: 400 });
    }
    if (enableSearchComment && searchKeyword.length < 2) {
      return NextResponse.json({ ok: false, message: "Comment search c\u1ea7n keyword \u00edt nh\u1ea5t 2 k\u00fd t\u1ef1." }, { status: 400 });
    }
    if (enableSearchComment && !searchCommentContents.length) {
      return NextResponse.json({ ok: false, message: "Comment search c\u1ea7n danh s\u00e1ch comment." }, { status: 400 });
    }

    const accounts = await getThreadsAutoAccountsForRun(accountIds, ownerId);
    const activeAccounts = accounts.filter((account) => account.status === "active" && !account.adminDisabled);
    if (!activeAccounts.length) {
      return NextResponse.json({ ok: false, message: "Kh\u00f4ng c\u00f3 t\u00e0i kho\u1ea3n Threads \u0111ang ho\u1ea1t \u0111\u1ed9ng \u0111\u1ec3 ch\u1ea1y." }, { status: 400 });
    }

    const actionsPerAccount =
      (enableGroupPost ? count : 0) +
      (enableFeedComment ? feedCommentCount : 0) +
      (enableSearchComment ? searchCommentCount : 0);
    await reserveFacebookAutoAutomationUsage(ownerId, activeAccounts.length * actionsPerAccount);

    const status = await startThreadsAutoRun(ownerId, activeAccounts, {
      enableGroupPost,
      enableFeedComment,
      enableSearchComment,
      randomizeTasks,
      topics,
      contents,
      count,
      delaySeconds,
      feedCommentContents,
      feedCommentCount,
      feedCommentDelaySeconds,
      searchKeyword,
      searchCommentContents,
      searchCommentCount,
      searchCommentDelaySeconds
    });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Kh\u00f4ng th\u1ec3 ch\u1ea1y Auto Threads." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    const status = stopThreadsAutoRun(ownerId);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể dừng Auto Threads." },
      { status: 400 }
    );
  }
}
