import { Kafka, logLevel, Producer } from "kafkajs";

const kafka = new Kafka({
    clientId: "swift-pay-web",
    brokers: [process.env.KAFKA_BROKER ?? "localhost:9092"],
    logLevel: logLevel.ERROR, // silence INFO spam in dev
});

// Producer is expensive to create — reuse it
let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
    if (!producer) {
        producer = kafka.producer();
        await producer.connect();
    }
    return producer;
}

export { kafka };