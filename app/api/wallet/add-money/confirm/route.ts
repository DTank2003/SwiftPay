import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const schema = z.object({
    paymentIntentId: z.string(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { paymentIntentId } = parsed.data;

    // Verify with Stripe directly — never trust client-side confirmation alone
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
        return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // Idempotency — prevent double credit if called twice
    const alreadyProcessed = await redis.get(`stripe:processed:${paymentIntentId}`);
    if (alreadyProcessed) {
        return NextResponse.json({ error: "Already processed" }, { status: 409 });
    }

    const amount = intent.amount / 100; // convert paise back to rupees


    // Use callback form — Prisma resolves relations correctly here
    const wallet = await prisma.$transaction(async (tx) => {
        const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: amount } },
            select: { balance: true },
        });

        await tx.transaction.create({
            data: {
                toUser: { connect: { id: userId } },
                fromUserId: undefined,
                amount,
                status: "COMPLETED",
                type: "TOP_UP",
                note: `Stripe · ${paymentIntentId}`,
            },
        });

        return updatedWallet;
    });

    // Mark as processed in Redis — 24hr TTL
    await redis.set(`stripe:processed:${paymentIntentId}`, "1", "EX", 86400);

    // Invalidate balance cache
    await redis.del(`wallet:balance:${userId}`);

    return NextResponse.json({ success: true, newBalance: wallet.balance });
}