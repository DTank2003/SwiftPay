import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const GET = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get distinct recent recipients
    const recent = await prisma.transaction.findMany({
        where: {
            fromUserId: userId,
            status: "COMPLETED",
            type: "P2P",
        },
        include: { toUser: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
    });

    // Deduplicate by toUserId — keep most recent appearance
    const seen = new Set<string>();
    const deduped = recent
        .filter((tx) => {
            if (seen.has(tx.toUserId)) return false;
            seen.add(tx.toUserId);
            return true;
        })
        .slice(0, 5)
        .map((tx) => tx.toUser);

    return NextResponse.json({ recent: deduped });
});