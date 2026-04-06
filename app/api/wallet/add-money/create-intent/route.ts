import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const schema = z.object({
    amount: z.number().positive().max(100000),
});

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { amount } = parsed.data;

        // Stripe amounts are in smallest currency unit — paise for INR
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: "inr",
            metadata: { userId, amount: String(amount) },
            // Disable Stripe Link and save card prompts
            payment_method_options: {
                card: {
                    request_three_d_secure: "automatic",
                },
            },
            setup_future_usage: undefined,

        });

        return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error("[CREATE_INTENT_ERROR]", err);
        return NextResponse.json(
            { error: "Failed to initialize payment. Please try again." },
            { status: 500 }
        );
    }
}