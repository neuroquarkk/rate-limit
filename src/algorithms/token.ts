import { Base } from './base';

/*
TOKEN BUCKET RATE LIMITING ALGORITHM

Imagine a bucket that holds a set number of tokens ('limit')
A token is added a fixed rate over time.
Each request consumes 1 token
If tokens available -> allow the request
If empty -> reject the request
*/
export class TokenBucket extends Base {
    async checkLimit(identifier: string): Promise<Result> {
        const key = this.generateKey(identifier);
        const now = Date.now();

        // Lua script for atomic bucket operations
        /*
         1. Read the user's current token count and last refill time
         2. Calculate how many new tokens should be added based on elapsed time
         3. Add the new tokens (shouldn't exceed the max capacity)
         3. Check if a token is available to consume
         5. Save the new token count and current time
         */
        const luaScript = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')

        -- If bucket exists use its stored value
        -- Otherwise start with a full bucket
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now

        -- Calculate tokens to add based on last refill
        local time_elapsed = (now - last_refill) / 1000
        local tokens_to_add = math.floor(time_elapsed * refill_rate)

        -- Number of tokens can't exceed the bucket's capacity
        tokens = math.min(capacity, tokens + tokens_to_add)

        -- Check if at least 1 token is available
        local allowed = tokens > 0
        if allowed then
            tokens = tokens - 1
        end

        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600) -- 1 hr TTL

        return {allowed and 1 or 0, tokens}
        `;

        const refillRate = this.options.limit / this.options.window; // tokens/sec

        const raw = await this.options.client.eval(luaScript, {
            keys: [key],
            arguments: [
                this.options.limit.toString(),
                refillRate.toString(),
                now.toString(),
            ],
        });

        if (!Array.isArray(raw) || raw.length < 2) {
            throw new Error('Invalid response from bucket lua script');
        }

        const [allowedRaw, remaining] = raw as [number, number];
        const allowed = allowedRaw === 1;

        return {
            allowed,
            remaining,
            resetTime:
                now + ((this.options.limit - remaining) / refillRate) * 1000,
            usedTokens: this.options.limit - remaining,
        };
    }
}
