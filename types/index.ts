export interface PaymentEvent {
    transactionId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    note: string;
    initiatedAt: string;
}

export interface JWTPayload {
    userId: string;
    email: string;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
}