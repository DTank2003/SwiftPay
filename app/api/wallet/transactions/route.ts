import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 5;

export async function GET(req: NextRequest) {
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
                fromUser: { select: { id: true, name: true, email: true } },
                toUser: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
        }),
        prisma.transaction.count({ where }),
    ]);

    const annotated = transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        note: tx.note,
        createdAt: tx.createdAt,
        type: tx.fromUserId === userId
            ? (tx.status === "COMPLETED" ? "debit" : "failed")
            : "credit",
        counterparty:
            tx.fromUserId === userId
                ? { name: tx.toUser.name, email: tx.toUser.email }
                : { name: tx.fromUser.name, email: tx.fromUser.email },
    }));

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
}