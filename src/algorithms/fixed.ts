import { Base } from './base';

/*
FIXED WINDOW RATE LIMITING ALGORITHM

This algorithm divides time into fixed length chunks (window)
During each window, a counter tracks the number of requests made by a user
Requests are allowed as long as the counter remains below the limit
Once the limit is reached, any additional requests are rejected until next window begins
*/
export class FixedWindow extends Base {
    async checkLimit(identifier: string): Promise<Result> {
        const key = this.generateKey(identifier);
        const now = Date.now();

        // Find the start timestamp of the current time window
        const windowStart =
            Math.floor(now / (this.options.window * 1000)) *
            this.options.window;
        const windowKey = `${key}:${windowStart}`;

        // Create a Redis pipeline to execute both commands atomically
        const pipeline = this.options.client.multi();
        pipeline.incr(windowKey); // Increment the count for this window
        pipeline.expire(windowKey, this.options.window); // Set key to expire after window ends

        const [currentCount, _expireResult] = await pipeline.exec();
        if (typeof currentCount !== 'number') {
            throw new Error('Expected numeric results from INCR');
        }

        // Counter exceeds the limit, request denied
        const allowed = currentCount < this.options.limit;
        const remaining = Math.max(0, this.options.limit - currentCount);
        const resetTime = (windowStart + this.options.window) * 1000;

        return {
            allowed,
            remaining,
            resetTime,
            usedTokens: currentCount, // Tracks total requests made in this window
        };
    }
}
