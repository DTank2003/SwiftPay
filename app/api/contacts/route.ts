import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const GET = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contacts = await prisma.contact.findMany({
        where: { userId },
        include: { contactUser: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
        contacts: contacts.map((c) => ({
            id: c.id,
            nickname: c.nickname,
            user: c.contactUser,
        })),
    });
});

const addSchema = z.object({
    contactUserId: z.string(),
    nickname: z.string().max(30).optional(),
});

export const POST = (async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { contactUserId, nickname } = parsed.data;

    if (contactUserId === userId) {
        return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    // Check user exists
    const contactUser = await prisma.user.findUnique({
        where: { id: contactUserId },
        select: { id: true, name: true, email: true },
    });
    if (!contactUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert — safe to call if contact already exists
    const contact = await prisma.contact.upsert({
        where: {
            userId_contactUserId: { userId, contactUserId },
        },
        update: { nickname: nickname ?? null },
        create: { userId, contactUserId, nickname: nickname ?? null },
    });

    return NextResponse.json({ contact, user: contactUser });
});