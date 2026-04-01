import { NextRequest } from "next/server";
import Redis from "ioredis";

export const runtime = "nodejs"; // SSE needs Node.js runtime, not edge

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Each SSE connection needs its own Redis subscriber instance
    // You cannot reuse the main redis client for pub/sub —
    // a subscribed client can only receive, not send commands
    const subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

    const channel = `notifications:${userId}`;

    const stream = new ReadableStream({
        start(controller) {
            // Send an initial ping so the browser knows the connection is alive
            controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

            subscriber.subscribe(channel, (err) => {
                if (err) {
                    console.error("[SSE] Subscribe error:", err);
                    controller.close();
                }
            });

            subscriber.on("message", (_channel, message) => {
                try {
                    // SSE format: "data: <json>\n\n"
                    controller.enqueue(`data: ${message}\n\n`);
                } catch {
                    // Controller already closed — client disconnected
                }
            });

            // Clean up when client disconnects
            req.signal.addEventListener("abort", () => {
                subscriber.unsubscribe(channel);
                subscriber.quit();
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // disable nginx buffering
        },
    });
}