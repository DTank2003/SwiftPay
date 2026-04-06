import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const schema = z.object({
    email: z.string().email(),
});

export async function POST(req: NextRequest) {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
    });

    if (!user) {
        return NextResponse.json(
            { error: "No account found with this email" },
            { status: 404 }
        );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    await redis.set(
        `password_reset:${token}`,
        JSON.stringify({ userId: user.id, email }),
        "EX",
        900
    );

    await sendPasswordResetEmail(email, user.name, resetUrl);

    return NextResponse.json({
        message: "If that email exists, a reset link has been sent",
    });
}