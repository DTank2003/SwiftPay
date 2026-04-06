import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const schema = z.object({
    token: z.string().min(1),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number"),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { token, password } = parsed.data;

        const raw = await redis.get(`password_reset:${token}`);
        if (!raw) {
            return NextResponse.json(
                { error: "Reset link is invalid or has expired" },
                { status: 400 }
            );
        }

        const { userId } = JSON.parse(raw) as { userId: string; email: string };

        const hashed = await hashPassword(password);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashed },
        });

        // Delete token — one use only
        await redis.del(`password_reset:${token}`);

        return NextResponse.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("[RESET_PASSWORD_ERROR]", err);
        return NextResponse.json(
            { error: "Failed to reset password. Please try again." },
            { status: 500 }
        );
    }
}