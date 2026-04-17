import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" },
        take: 20,
    });

    return Response.json({ notifications });
}