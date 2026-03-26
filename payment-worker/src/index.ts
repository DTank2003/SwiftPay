import "dotenv/config";
import { startConsumer } from "./kafkaConsumer";
import { processPayment } from "./paymentProcessor";

async function main() {
    console.log("[WORKER] Starting payment worker...");
    console.log("[WORKER] KAFKA_BROKER:", process.env.KAFKA_BROKER);
    console.log("[WORKER] REDIS_URL:", process.env.REDIS_URL);
    console.log("[WORKER] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "MISSING");

    await startConsumer(
        "payment.initiated",
        "payment-worker-group",
        processPayment
    );
}

main().catch((err) => {
    console.error("[WORKER] Fatal error:", err);
    process.exit(1);
});