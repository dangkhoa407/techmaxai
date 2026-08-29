import { NextResponse } from "next/server";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../facebook-auto/lib/request-auth";
import { getThreadsAutoStatus, subscribeThreadsAutoStatus } from "../../../threads-auto/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
    await getThreadsAutoStatus(ownerId);
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | undefined;

    const stream = new ReadableStream({
      start(controller) {
        const send = (status: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ok: true, status })}\n\n`));
          } catch {
            unsubscribe?.();
          }
        };

        unsubscribe = subscribeThreadsAutoStatus(send, ownerId);

        request.signal.addEventListener("abort", () => {
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            // Browser closed the stream first.
          }
        });
      },
      cancel() {
        unsubscribe?.();
      }
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream"
      }
    });
  } catch (error) {
    if (error instanceof FacebookAutoAuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Không thể mở luồng trạng thái Auto Threads." },
      { status: 400 }
    );
  }
}
