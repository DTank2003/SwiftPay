import { Kafka, Consumer, EachMessagePayload, logLevel } from "kafkajs";

const kafka = new Kafka({
    clientId: "payment-worker",
    brokers: [process.env.KAFKA_BROKER ?? "localhost:9092"],
    logLevel: logLevel.ERROR,
});

let consumer: Consumer;

export async function startConsumer(
    topic: string,
    groupId: string,
    handler: (payload: EachMessagePayload) => Promise<void>
) {
    consumer = kafka.consumer({ groupId });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
        // Process one message at a time per partition
        // Prevents partial failures from corrupting state
        eachMessage: async (payload) => {
            try {
                await handler(payload);
            } catch (error) {
                console.error(`[CONSUMER ERROR] topic=${topic}`, error);
                // Don't throw — throwing here crashes the consumer loop
                // In production you'd send to a dead-letter topic instead
            }
        },
    });

    console.log(`[WORKER] Listening on topic: ${topic}`);
}

export async function gracefulShutdown() {
    await consumer?.disconnect();
    process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);