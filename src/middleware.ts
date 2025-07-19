import type { NextFunction, Request, Response } from 'express';
import { RateLimiter } from './algorithms';

export function rateLimitMiddleware(options: Options) {
    const rateLimiter = new RateLimiter(options);
    const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip);

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const identifier = keyGenerator(req);
            const result = await rateLimiter.checkLimit(identifier!);

            if (!result.allowed) {
                return res.status(429).json({
                    messages: 'Too many requests',
                    retryAfter: Math.ceil(
                        (result.resetTime - Date.now()) / 1000
                    ),
                });
            }

            next();
        } catch (error) {
            console.error('Rate limiting error:', error);
            next();
        }
    };
}
