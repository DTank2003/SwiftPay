import { startConsumer } from "./kafkaConsumer";
import { processPayment } from "./paymentProcessor";

async function main() {
    console.log("[WORKER] Starting payment worker...");

    await startConsumer(
        "payment.initiated",
        "payment-worker-group", // consumer group ID
        processPayment
    );
}

main().catch((err) => {
    console.error("[WORKER] Fatal error:", err);
    process.exit(1);
});