import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { z } from "zod";

const createSchema = z.object({
    toPhone: z
        .string()
        .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    amount: z.number().positive().max(100000),
    note: z.string().max(100).optional(),
});

export const POST = (async (req: NextRequest) => {
    const fromUserId = req.headers.get("x-user-id");
    if (!fromUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { toPhone, amount, note } = parsed.data;

    const toUser = await prisma.user.findUnique({
        where: { phone: toPhone },
        select: { id: true, name: true },
    });
    if (!toUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (toUser.id === fromUserId) {
        return NextResponse.json({ error: "Cannot request from yourself" }, { status: 400 });
    }

    const fromUser = await prisma.user.findUnique({
        where: { id: fromUserId },
        select: { name: true },
    });

    const request = await prisma.paymentRequest.create({
        data: {
            fromUserId,
            toUserId: toUser.id,
            amount,
            note: note ?? null,
        },
    });

    // Notify the person being requested via SSE
    await redis.publish(
        `notifications:${toUser.id}`,
        JSON.stringify({
            type: "payment_request",
            amount,
            fromName: fromUser?.name ?? "Someone",
            requestId: request.id,
            note: note ?? null,
            timestamp: new Date().toISOString(),
        })
    );

    return NextResponse.json({ request });
});

export const GET = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "incoming"; // incoming | outgoing

    // Auto-expire PENDING requests older than 24hrs on fetch
    await prisma.paymentRequest.updateMany({
        where: {
            status: "PENDING",
            createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        data: { status: "EXPIRED" },
    });

    const requests = await prisma.paymentRequest.findMany({
        where:
            tab === "incoming"
                ? { toUserId: userId }
                : { fromUserId: userId },
        include: {
            fromUser: { select: { id: true, name: true, email: true } },
            toUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
});