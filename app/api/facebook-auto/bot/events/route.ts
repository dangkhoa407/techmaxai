import { NextResponse } from "next/server";
import { subscribeBotStatus } from "../../../../facebook-auto/lib/bot";
import { FacebookAutoAuthError, requireFacebookAutoUserId } from "../../../../facebook-auto/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await requireFacebookAutoUserId(request);
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

        unsubscribe = subscribeBotStatus(send, ownerId);

        request.signal.addEventListener("abort", () => {
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            // The connection may already be closed by the browser.
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
      { ok: false, message: error instanceof Error ? error.message : "Không thể mở luồng trạng thái bot." },
      { status: 400 }
    );
  }
}
