import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProducer } from "@/lib/kafka";
import { redis } from "@/lib/redis";
import { z } from "zod";
import { redisPublisher } from "@/lib/redisPublisher";

const actionSchema = z.object({
    action: z.enum(["accept", "reject"]),
});

export const POST = (async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { action } = parsed.data;

    const request = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.toUserId !== userId) {
        return NextResponse.json({ error: "Not your request" }, { status: 403 });
    }
    if (request.status !== "PENDING") {
        return NextResponse.json({ error: `Request already ${request.status.toLowerCase()}` }, { status: 400 });
    }

    if (action === "reject") {
        await prisma.paymentRequest.update({
            where: { id },
            data: { status: "REJECTED" },
        });

        // Notify requester
        await redisPublisher.publish(
            `notifications:${request.fromUserId}`,
            JSON.stringify({
                type: "request_rejected",
                amount: request.amount,
                requestId: id,
                timestamp: new Date().toISOString(),
            })
        );

        // Create persistent notification
        await prisma.notification.create({
            data: {
                userId: request.fromUserId,
                type: "request_rejected",
                text: `Your payment request of ₹${request.amount} was rejected`,
            },
        });

        return NextResponse.json({ status: "REJECTED" });
    }

    // Accept — check balance first
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        select: { balance: true },
    });
    if (!wallet || wallet.balance < request.amount) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Create a PENDING transaction and push to Kafka — same flow as regular send
    const transaction = await prisma.transaction.create({
        data: {
            toUser: { connect: { id: request.fromUserId } },
            fromUser: { connect: { id: userId } },
            amount: request.amount,
            status: "PENDING",
            type: "P2P",
            note: request.note ?? `Payment request #${id.slice(0, 8)}`,
        },
    });

    const producer = await getProducer();
    await producer.send({
        topic: "payment.initiated",
        messages: [{
            key: userId,
            value: JSON.stringify({
                transactionId: transaction.id,
                fromUserId: userId,
                toUserId: request.fromUserId,
                amount: request.amount,
                note: request.note ?? "",
                initiatedAt: new Date().toISOString(),
            }),
        }],
    });

    // Mark request as PAID
    await prisma.paymentRequest.update({
        where: { id },
        data: { status: "PAID" },
    });

    return NextResponse.json({ status: "PAID", transactionId: transaction.id });
});