import Redis from "ioredis";

// A dedicated client just for publishing
// Never use the same client for both pub/sub and regular commands
const globalForPublisher = globalThis as unknown as {
    redisPublisher: Redis | undefined;
};

function createPublisher() {
    const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: 3,
    });
    client.on("error", (err) => console.error("[REDIS PUBLISHER ERROR]", err));
    return client;
}

export const redisPublisher =
    globalForPublisher.redisPublisher ?? createPublisher();

if (process.env.NODE_ENV !== "production") {
    globalForPublisher.redisPublisher = redisPublisher;
}