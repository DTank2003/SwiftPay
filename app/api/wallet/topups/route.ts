import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const GET = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const topups = await prisma.transaction.findMany({
        where: { toUserId: userId, type: "TOP_UP", status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, note: true, createdAt: true },
    });

    return NextResponse.json({ topups });
});