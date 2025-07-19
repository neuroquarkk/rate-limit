import { Base } from './base';

/*
SLIDING WINDOW COUNTER RATE LIMITING ALGORITHM

This algorithm limits requests by estimating usage over a moving time window
It combines counts from the current and previous fixed windows, weighted by how far we are into the current window
If the estimated total exceeds the allowed limit, the request is rejected
Otherwise, the request is allowed and the current window’s count is updated accordingly
*/
export class SlidingWindowCounter extends Base {
    async checkLimit(identifier: string): Promise<Result> {
        const key = this.generateKey(identifier);
        const now = Date.now();
        const windowMs = this.options.window * 1000;

        // Determine current and previous window buckets
        const currentWindow = Math.floor(now / windowMs);
        const previousWindow = currentWindow - 1;

        const currentKey = `${key}:${currentWindow}`;
        const previousKey = `${key}:${previousWindow}`;

        // Pipeline to fetch both window counter
        const pipeline = this.options.client.multi();
        pipeline.get(currentKey);
        pipeline.get(previousKey);

        const results = await pipeline.exec();
        if (!results || results.length !== 2) {
            throw new Error('Pipeline execution failed');
        }

        const currentCount = this.extractCount(results[0]);
        const previousCount = this.extractCount(results[1]);

        // How far into current window (0-1)
        const timeIntoWindow = (now % windowMs) / windowMs;

        const estimatedUsage = Math.floor(
            previousCount * (1 - timeIntoWindow) + currentCount
        );

        const allowed = estimatedUsage < this.options.limit;

        if (allowed) {
            const incrPipeline = this.options.client.multi();
            incrPipeline.incr(currentKey);
            incrPipeline.expire(currentKey, this.options.window * 2);
            await incrPipeline.exec();
        }

        // current usage + new one if allowed
        const usedTokens = estimatedUsage + (allowed ? 1 : 0);

        return {
            allowed,
            remaining: Math.max(0, this.options.limit - usedTokens),
            resetTime: (currentWindow + 1) * windowMs,
            usedTokens,
        };
    }

    private extractCount(result: any): number {
        if (Array.isArray(result) && result.length === 2) {
            const [err, val] = result;
            if (err) {
                throw err;
            }
            return val ? parseInt(val) : 0;
        }
        return result ? parseInt(result) : 0;
    }
}
