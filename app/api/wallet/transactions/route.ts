import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 5;

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const skip = (page - 1) * PAGE_SIZE;

        // The WHERE logic by role:
        // Sender — sees all statuses (PENDING, COMPLETED, FAILED)
        //          because they initiated it and need to know what happened
        // Receiver — sees ONLY COMPLETED
        //            if money never arrived, it's not their transaction
        const where = {
            OR: [
                {
                    fromUserId: userId, // sender sees everything
                },
                {
                    toUserId: userId,
                    status: "COMPLETED" as const, // receiver only sees completed
                },
            ],
        };

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: {
                    fromUser: { select: { id: true, name: true, phone: true } },
                    toUser: { select: { id: true, name: true, phone: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: PAGE_SIZE,
            }),
            prisma.transaction.count({ where }),
        ]);

        const annotated = transactions.map((tx) => {
            // TOP_UP — always a credit, no counterparty
            if (tx.type === "TOP_UP") {
                return {
                    id: tx.id,
                    amount: tx.amount,
                    status: tx.status,
                    type: "topup" as const,
                    note: tx.note,
                    createdAt: tx.createdAt,
                    counterparty: { name: "Wallet top-up", email: "" },
                };
            }

            // P2P
            return {
                id: tx.id,
                amount: tx.amount,
                status: tx.status,
                type: tx.fromUserId === userId
                    ? (tx.status === "COMPLETED" ? "debit" : "failed")
                    : "credit",
                note: tx.note,
                createdAt: tx.createdAt,
                counterparty:
                    tx.fromUserId === userId
                        ? { name: tx.toUser.name, phone: tx.toUser.phone }
                        : { name: tx.fromUser!.name, phone: tx.fromUser!.phone },
            };
        });

        return NextResponse.json({
            transactions: annotated,
            pagination: {
                page,
                pageSize: PAGE_SIZE,
                total,
                totalPages: Math.ceil(total / PAGE_SIZE),
                hasNext: page * PAGE_SIZE < total,
                hasPrev: page > 1,
            },
        });
    } catch (err) {
        console.error("[GET_TRANSACTIONS_ERROR]", err);
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}