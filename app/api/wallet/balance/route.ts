import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedBalance, setCachedBalance } from "@/lib/walletCache";

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Try Redis first — microseconds
    const cached = await getCachedBalance(userId);
    if (cached !== null) {
        return NextResponse.json({ balance: cached, source: "cache" });
    }

    // 2. Cache miss — hit the DB
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        select: { balance: true },
    });

    if (!wallet) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // 3. Populate cache for next 30s
    await setCachedBalance(userId, wallet.balance);

    return NextResponse.json({ balance: wallet.balance, source: "db" });
}