import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProducer } from "@/lib/kafka";
import { checkRateLimit } from "@/lib/rateLimit";

const sendSchema = z.object({
    toPhone: z
        .string()
        .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    amount: z.number().positive().max(100000),
    note: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
    try {
        // userId injected by middleware from JWT
        const fromUserId = req.headers.get("x-user-id");
        if (!fromUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Rate limit check — 5 payments per minute
        const rateLimit = await checkRateLimit(fromUserId, "payment", 5, 60);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: "Too many payments. Slow down.",
                    resetInSeconds: rateLimit.resetInSeconds,
                },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": rateLimit.resetInSeconds.toString(),
                    },
                }
            );
        }

        // 2. Validate body
        const body = await req.json();
        const parsed = sendSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { toPhone, amount, note } = parsed.data;

        // 3. Load sender wallet + receiver in one query
        const [sender, receiver] = await Promise.all([
            prisma.user.findUnique({
                where: { id: fromUserId },
                include: { wallet: true },
            }),
            prisma.user.findUnique({
                where: { phone: toPhone },
                select: { id: true, name: true, phone: true },
            }),
        ]);

        if (!sender?.wallet) {
            return NextResponse.json({ error: "Sender wallet not found" }, { status: 404 });
        }
        if (!receiver) {
            return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }
        if (sender.id === receiver.id) {
            return NextResponse.json({ error: "Cannot send money to yourself" }, { status: 400 });
        }
        if (sender.wallet.balance < amount) {
            return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
        }

        // 4. Create PENDING transaction — this is our source of truth
        const transaction = await prisma.transaction.create({
            data: {
                fromUserId: sender.id,
                toUserId: receiver.id,
                amount,
                status: "PENDING",
                note: note ?? "",
            },
        });

        // 5. Publish to Kafka — worker will do the actual debit/credit
        // If Kafka is down, the transaction stays PENDING and can be retried
        try {
            const producer = await getProducer();
            await producer.send({
                topic: "payment.initiated",
                messages: [
                    {
                        // key = fromUserId ensures all payments from same user
                        // go to the same Kafka partition — preserving order
                        key: fromUserId,
                        value: JSON.stringify({
                            transactionId: transaction.id,
                            fromUserId: sender.id,
                            toUserId: receiver.id,
                            amount,
                            note: note ?? "",
                            initiatedAt: new Date().toISOString(),
                        }),
                    },
                ],
            });
        } catch (kafkaError) {
            // Kafka publish failed — mark transaction as failed
            // Don't return 500 to user — the PENDING record exists for retry
            console.error("[KAFKA PUBLISH ERROR]", kafkaError);
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: "FAILED" },
            });
            return NextResponse.json(
                { error: "Payment queuing failed. Please try again." },
                { status: 503 }
            );
        }

        // 6. Respond immediately — don't wait for worker
        return NextResponse.json({
            transactionId: transaction.id,
            status: "PENDING",
            message: "Payment initiated",
            recipient: receiver.name,
            amount,
        });
    } catch (err) {
        console.error("[SEND_MONEY_ERROR]", err);
        return NextResponse.json(
            { error: "Internal server error. Please try again later." },
            { status: 500 }
        );
    }
}