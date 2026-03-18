import { Kafka } from "kafkajs";

export const kafka = new Kafka({
    clientId: "kafkapay",
    brokers: ["localhost:9092"],
});