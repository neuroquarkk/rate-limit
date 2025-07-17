export abstract class Base {
    protected options: Options;

    constructor(options: Options) {
        this.options = options;
    }

    // Generate a Redis key based on identifier and algorithm
    protected generateKey(identifier: string): string {
        return `rate_limit:${this.options.algorithm}:${identifier}`;
    }

    // Every algo must implement this check method
    abstract checkLimit(identifier: string): Promise<Result>;
}
