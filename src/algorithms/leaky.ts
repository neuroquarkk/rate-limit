import { Base } from './base';

/*
LEAKY BUCKET RATE LIMITING ALGORITHM

The bucket holds requests like water, with a fixed leak rate over time
Each incoming requests fills the bucket slightly (adds volume)
The bucket continuosly leaks at a steady rate (based on time elapsed)
If the bucket overflows (volume exceeds capacity), the request is rejected
Otherwise, the request is allowed and volume is updated
*/

export class LeakyBucket extends Base {
    async checkLimit(identifier: string): Promise<Result> {
        const key = this.generateKey(identifier);
        const now = Date.now();

        // Lua script for atomic bucket operations
        /*
         1. Fetch the current bucket state (volume and last leak timestamp)
         2. Calculate how much volume should have leaked since last timestamp
         3. Updated volume by subtracting leaked amount
         4. If there's space, allow the request and increase volume
         5. Save updated state and set expiry
        */
        const luaScript = `
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local leak_rate = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])

            -- Read current volumen and last leak time
            local bucket = redis.call('HMGET', key, 'volume', 'last_leak')
            local volume = tonumber(bucket[1]) or 0
            local last_leak = tonumber(bucket[2]) or now

            -- Calculate volume to leak based on time elapsed
            local time_elapsed = (now - last_leak) / 1000
            local volume_to_leak = time_elapsed * leak_rate
            volume = math.max(0, volume - volume_to_leak)

            local allowed = volume < capacity
            if allowed then
                volume = volume + 1
            end

            -- Update bucket state
            redis.call('HMSET', key, 'volume', volume, 'last_leak', now)
            redis.call('EXPIRE', key, 3600)

            return { allowed and 1 or 0, capacity - volume }
        `;

        const leakRate = this.options.limit / this.options.window;
        const raw = await this.options.client.eval(luaScript, {
            keys: [key],
            arguments: [
                this.options.limit.toString(),
                leakRate.toString(),
                now.toString(),
            ],
        });

        if (!Array.isArray(raw) || raw.length < 2) {
            throw new Error('Invalid response from leaky lua script');
        }

        const [allowedRaw, remainingRaw] = raw as [number, number];

        const allowed = allowedRaw === 1;
        const remaining = Math.floor(remainingRaw);

        return {
            allowed,
            remaining,
            resetTime: now + this.options.window * 1000,
            usedTokens: this.options.limit - remaining,
        };
    }
}
