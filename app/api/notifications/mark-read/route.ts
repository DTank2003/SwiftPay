import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
    const userId = req.headers.get("x-user-id");

    if (!userId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.notification.updateMany({
        where: {
            userId,
            read: false, // only unread
        },
        data: {
            read: true,
        },
    });

    return Response.json({ success: true });
}