import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

function createRedisClient() {
    const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: 3,
    });

    client.on("error", (err) => console.error("[REDIS ERROR]", err));
    client.on("connect", () => console.log("[REDIS] Connected"));

    return client;
}

export const redis =
    globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;