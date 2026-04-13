import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const DELETE = (async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await prisma.contact.deleteMany({
        where: { id, userId }, // userId check prevents deleting others' contacts
    });

    return NextResponse.json({ success: true });
});