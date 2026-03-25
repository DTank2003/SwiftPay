import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const skip = (page - 1) * PAGE_SIZE;

    // Fetch transactions + total count in parallel
    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: {
                OR: [{ fromUserId: userId }, { toUserId: userId }],
            },
            include: {
                fromUser: { select: { id: true, name: true, email: true } },
                toUser: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
        }),
        prisma.transaction.count({
            where: {
                OR: [{ fromUserId: userId }, { toUserId: userId }],
            },
        }),
    ]);

    // Annotate each transaction from the current user's perspective
    const annotated = transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        note: tx.note,
        createdAt: tx.createdAt,
        type: tx.fromUserId === userId ? "debit" : "credit",
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