import { Base } from './base';

/*
SLIDING WINDOW LOG RATE LIMITING ALGORITHM

Each request is logged with a timestamp inside a sliding time window
Old request timestamps outside the widnow are removed regularly
The number of active requests is counted
If the number is within the limit, the request is allowed and logged
If the limit is reached the request is rejected
*/
export class SlidingWindowLog extends Base {
    async checkLimit(identifier: string): Promise<Result> {
        const key = this.generateKey(identifier);
        const now = Date.now();

        const windowStart = now - this.options.window * 1000;

        // Pipeline to cleanup old entries and count current
        const pipeline = this.options.client.multi();
        pipeline.zRemRangeByScore(key, 0, windowStart); // remove old entries
        pipeline.zCard(key); // count current entries
        const results = await pipeline.exec();

        if (!results || results.length < 2 || typeof results[1] !== 'number') {
            throw new Error('Unexpected pipeline result format');
        }

        const currentCount = results[1];

        const allowed = currentCount < this.options.limit;

        if (allowed) {
            // If allowed record this request timestamp
            const addPipeline = this.options.client.multi();
            addPipeline.zAdd(key, {
                score: now,
                value: `${now}-${identifier}-${Math.random()}`,
            }); // add current request
            addPipeline.expire(key, this.options.window);
            await addPipeline.exec();
        }

        return {
            allowed,
            remaining: Math.max(
                0,
                this.options.limit - (allowed ? currentCount + 1 : currentCount)
            ),
            resetTime: now + this.options.window * 1000,
            usedTokens: allowed ? currentCount + 1 : currentCount,
        };
    }
}
