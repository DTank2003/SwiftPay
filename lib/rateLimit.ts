import { redis } from "./redis";

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
}

export async function checkRateLimit(
    userId: string,
    action: string = "payment",
    limit: number = 5,
    windowSeconds: number = 60
): Promise<RateLimitResult> {
    const key = `ratelimit:${action}:${userId}`;

    // INCR is atomic — no race condition possible
    const count = await redis.incr(key);

    if (count === 1) {
        // First request in this window — set the expiry
        await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);

    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetInSeconds: ttl,
    };
}