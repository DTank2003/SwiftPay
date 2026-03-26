import "dotenv/config";
import { EachMessagePayload } from "kafkajs";
import { prisma } from "./db";
import Redis from "ioredis";

const publisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

interface PaymentEvent {
    transactionId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    note: string;
    initiatedAt: string;
}

export async function processPayment(payload: EachMessagePayload) {
    const { message } = payload;
    if (!message.value) return;

    const event: PaymentEvent = JSON.parse(message.value.toString());
    const { transactionId, fromUserId, toUserId, amount, note } = event;

    console.log(`[WORKER] Processing transaction: ${transactionId}`);

    const existing = await prisma.transaction.findUnique({
        where: { id: transactionId },
    });

    if (!existing || existing.status !== "PENDING") {
        console.log(`[WORKER] Skipping ${transactionId} — status: ${existing?.status}`);
        return;
    }

    try {
        let completed = false;

        await prisma.$transaction(async (tx) => {
            const senderWallet = await tx.wallet.findUnique({
                where: { userId: fromUserId },
            });

            if (!senderWallet || senderWallet.balance < amount) {
                await tx.transaction.update({
                    where: { id: transactionId },
                    data: { status: "FAILED" },
                });
                return;
            }

            await tx.wallet.update({
                where: { userId: fromUserId },
                data: { balance: { decrement: amount } },
            });

            await tx.wallet.update({
                where: { userId: toUserId },
                data: { balance: { increment: amount } },
            });

            await tx.transaction.update({
                where: { id: transactionId },
                data: { status: "COMPLETED" },
            });

            completed = true;
        });

        if (completed) {
            const sender = await prisma.user.findUnique({
                where: { id: fromUserId },
                select: { name: true },
            });

            await publisher.publish(
                `notifications:${toUserId}`,
                JSON.stringify({
                    type: "payment_received",
                    amount,
                    fromName: sender?.name ?? "Someone",
                    note: note || null,
                    transactionId,
                    timestamp: new Date().toISOString(),
                })
            );

            await publisher.publish(
                `notifications:${fromUserId}`,
                JSON.stringify({
                    type: "payment_sent",
                    amount,
                    transactionId,
                    timestamp: new Date().toISOString(),
                })
            );

            // Invalidate Redis balance cache for both users
            await Promise.all([
                publisher.del(`wallet:balance:${fromUserId}`),
                publisher.del(`wallet:balance:${toUserId}`),
            ]);

            console.log(`[WORKER] Completed + notified: ${transactionId}`);
        }
    } catch (error) {
        console.error(`[WORKER] Failed: ${transactionId}`, error);
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: "FAILED" },
        }).catch(console.error);
    }
}