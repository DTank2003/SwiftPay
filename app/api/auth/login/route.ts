import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.errors[0].message },
                { status: 400 }
            );
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, password: true },
        });

        // Always run comparePassword even if user not found
        // prevents timing attacks that reveal valid emails
        const passwordMatch = user
            ? await comparePassword(password, user.password)
            : await comparePassword(password, "$2a$12$invalidhashpadding000000000000000");

        if (!user || !passwordMatch) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        const token = signToken({ userId: user.id, email: user.email });

        const response = NextResponse.json({
            user: { id: user.id, name: user.name, email: user.email },
        });

        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("[LOGIN ERROR]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}