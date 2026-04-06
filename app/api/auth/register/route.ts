import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate with zod
        const parsed = registerSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { name, email, phone, password } = parsed.data;

        // Check duplicate
        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
        });
        if (existing) {
            return NextResponse.json(
                { error: "Email or phone already registered" },
                { status: 409 }
            );
        }

        const hashedPassword = await hashPassword(password);

        // Atomic: user + wallet created together or not at all
        const [user] = await prisma.$transaction([
            prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    password: hashedPassword,
                    wallet: { create: { balance: 0 } },
                },
                select: { id: true, name: true, email: true },
            }),
        ]);

        const token = signToken({ userId: user.id, email: user.email });

        const response = NextResponse.json(
            { user, message: "Account created successfully" },
            { status: 201 }
        );

        // httpOnly so JS can't read it — XSS protection
        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("[REGISTER ERROR]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}