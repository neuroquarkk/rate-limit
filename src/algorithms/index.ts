import { SlidingWindowCounter } from './counter';
import { FixedWindow } from './fixed';
import { LeakyBucket } from './leaky';
import { SlidingWindowLog } from './log';
import { TokenBucket } from './token';

export class RateLimiter {
    private algorithm: any;

    constructor(options: Options) {
        switch (options.algorithm) {
            case 'token-bucket':
                this.algorithm = new TokenBucket(options);
                break;

            case 'fixed-window':
                this.algorithm = new FixedWindow(options);
                break;

            case 'leaky-bucket':
                this.algorithm = new LeakyBucket(options);
                break;

            case 'sliding-log':
                this.algorithm = new SlidingWindowLog(options);
                break;

            case 'sliding-window':
                this.algorithm = new SlidingWindowCounter(options);
                break;

            default:
                throw new Error(`Unsupported algorithm: ${options.algorithm}`);
        }
    }

    // Delegate the check to the selected algo instance
    async checkLimit(identifier: string): Promise<Result> {
        return this.algorithm.checkLimit(identifier);
    }
}
