import { prisma } from "@/lib/prisma";
import { EachMessagePayload } from "kafkajs";

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
    const { transactionId, fromUserId, toUserId, amount } = event;

    console.log(`[WORKER] Processing transaction: ${transactionId}`);

    // Check if already processed — idempotency guard
    // If worker crashes after DB write but before Kafka commit,
    // Kafka will redeliver. This check prevents double-processing.
    const existing = await prisma.transaction.findUnique({
        where: { id: transactionId },
    });

    if (!existing || existing.status !== "PENDING") {
        console.log(`[WORKER] Skipping ${transactionId} — status: ${existing?.status}`);
        return;
    }

    try {
        // Atomic: all three operations succeed or all roll back
        await prisma.$transaction(async (tx) => {
            // Re-check balance inside transaction to prevent race conditions
            // Two simultaneous payments could both pass the API-level check
            const senderWallet = await tx.wallet.findUnique({
                where: { userId: fromUserId },
            });

            if (!senderWallet || senderWallet.balance < amount) {
                // Mark as FAILED — don't throw, just update status
                await tx.transaction.update({
                    where: { id: transactionId },
                    data: { status: "FAILED" },
                });
                return;
            }

            // Debit sender
            await tx.wallet.update({
                where: { userId: fromUserId },
                data: { balance: { decrement: amount } },
            });

            // Credit receiver
            await tx.wallet.update({
                where: { userId: toUserId },
                data: { balance: { increment: amount } },
            });

            // Mark completed
            await tx.transaction.update({
                where: { id: transactionId },
                data: { status: "COMPLETED" },
            });
        });

        console.log(`[WORKER] Completed: ${transactionId}`);

    } catch (error) {
        console.error(`[WORKER] Failed: ${transactionId}`, error);
        // Mark as FAILED so UI can show the user
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: "FAILED" },
        }).catch(console.error);
    }
}