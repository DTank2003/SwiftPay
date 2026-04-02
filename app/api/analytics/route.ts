import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [
        totalSentResult,
        totalReceivedResult,
        txCountThisMonth,
        dailyRaw,
        recentTx,
    ] = await Promise.all([

        // Total sent this month
        prisma.transaction.aggregate({
            where: {
                fromUserId: userId,
                status: "COMPLETED",
                createdAt: { gte: monthStart },
            },
            _sum: { amount: true },
        }),

        // Total received this month
        prisma.transaction.aggregate({
            where: {
                toUserId: userId,
                status: "COMPLETED",
                createdAt: { gte: monthStart },
            },
            _sum: { amount: true },
        }),

        // Transaction count this month
        prisma.transaction.count({
            where: {
                OR: [{ fromUserId: userId }, { toUserId: userId }],
                status: "COMPLETED",
                createdAt: { gte: monthStart },
            },
        }),

        // Daily volume — last 7 days
        prisma.transaction.findMany({
            where: {
                OR: [{ fromUserId: userId }, { toUserId: userId }],
                status: "COMPLETED",
                createdAt: { gte: weekAgo },
            },
            select: {
                amount: true,
                fromUserId: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        }),

        // 5 most recent transactions
        prisma.transaction.findMany({
            where: {
                OR: [
                    { fromUserId: userId, status: "COMPLETED" },
                    { toUserId: userId, status: "COMPLETED" },
                ],
            },
            include: {
                fromUser: { select: { name: true } },
                toUser: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
    ]);

    // Build daily chart data — one entry per day for last 7 days
    const dailyMap = new Map<string, { sent: number; received: number }>();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10); // "2025-03-20"
        dailyMap.set(key, { sent: 0, received: 0 });
    }

    for (const tx of dailyRaw) {
        const key = tx.createdAt.toISOString().slice(0, 10);
        if (!dailyMap.has(key)) continue;
        const entry = dailyMap.get(key)!;
        if (tx.fromUserId === userId) {
            entry.sent += tx.amount;
        } else {
            entry.received += tx.amount;
        }
    }

    const daily = Array.from(dailyMap.entries()).map(([date, vals]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-IN", {
            weekday: "short",
        }),
        sent: Math.round(vals.sent),
        received: Math.round(vals.received),
    }));

    return NextResponse.json({
        summary: {
            totalSent: Math.round(totalSentResult._sum.amount ?? 0),
            totalReceived: Math.round(totalReceivedResult._sum.amount ?? 0),
            txCount: txCountThisMonth,
            netFlow: Math.round(
                (totalReceivedResult._sum.amount ?? 0) -
                (totalSentResult._sum.amount ?? 0)
            ),
        },
        daily,
        recent: recentTx.map((tx) => ({
            id: tx.id,
            amount: tx.amount,
            status: tx.status,
            type: tx.fromUserId === userId ? "debit" : "credit",
            counterparty: tx.fromUserId === userId ? tx.toUser.name : tx.fromUser.name,
            createdAt: tx.createdAt,
            note: tx.note ?? "",
        })),
    });
}