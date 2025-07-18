import { FixedWindow } from './fixed';
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

            default:
                throw new Error(`Unsupported algorithm: ${options.algorithm}`);
        }
    }

    // Delegate the check to the selected algo instance
    async checkLimit(identifier: string): Promise<Result> {
        return this.algorithm.checkLimit(identifier);
    }
}
