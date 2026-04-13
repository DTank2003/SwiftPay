import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

export const GET = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const type = searchParams.get("type") ?? "all";   // all | sent | received
    const status = searchParams.get("status") ?? "all";   // all | PENDING | COMPLETED | FAILED
    const skip = (page - 1) * PAGE_SIZE;

    // Build where clause based on filters
    type WhereClause = {
        OR?: Array<{ fromUserId?: string; toUserId?: string; status?: string }>;
        fromUserId?: string;
        toUserId?: string;
        status?: string;
        type?: string;
    };

    let baseWhere: WhereClause;

    if (type === "sent") {
        baseWhere = { fromUserId: userId, type: "P2P" };
    } else if (type === "received") {
        baseWhere = { toUserId: userId, status: "COMPLETED", type: "P2P" };
    } else {
        // all — sender sees everything, receiver sees only completed
        baseWhere = {
            OR: [
                { fromUserId: userId },
                { toUserId: userId, status: "COMPLETED" },
            ],
        };
    }

    // Apply status filter on top
    const where = status !== "all"
        ? { ...baseWhere, status }
        : baseWhere;

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

    const annotated = transactions.map((tx) => {
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
                    ? { name: tx.toUser.name, email: tx.toUser.email }
                    : { name: tx.fromUser!.name, email: tx.fromUser!.email },
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
});