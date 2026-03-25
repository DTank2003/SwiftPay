import { redis } from "./redis";

const CACHE_TTL = 30; // seconds
const key = (userId: string) => `wallet:balance:${userId}`;

export async function getCachedBalance(userId: string): Promise<number | null> {
    const cached = await redis.get(key(userId));
    if (cached === null) return null;
    return parseFloat(cached);
}

export async function setCachedBalance(
    userId: string,
    balance: number
): Promise<void> {
    await redis.set(key(userId), balance.toString(), "EX", CACHE_TTL);
}

export async function invalidateBalanceCache(userId: string): Promise<void> {
    await redis.del(key(userId));
}