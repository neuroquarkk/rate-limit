import type { RedisClientType } from 'redis';

export {};

declare global {
    type Algorithm = 'token-bucket' | 'fixed-window' | 'leaky-bucket';

    interface Options {
        algorithm: Algorithm;
        limit: number; // Max number of requests allowed within defined window
        window: number; // in seconds
        keyGenerator?: (req: any) => string; // optional way to customize user identity
        client: RedisClientType<any, any, any, 2 | 3>;
    }

    interface Result {
        allowed: boolean; // Whether the request is allowed
        remaining: number; // Remaining allowed tokens
        resetTime: number; // When the quota will reset
        usedTokens: number; // Tokens already consumed
    }
}
