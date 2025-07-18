# rate-limit

Simple, pluggable rate limting middleware powered by Redis

## Algorithms

- Token Bucket
- Leaky Bucket
- Fixed Window
- Sliding Window Log
- Sliding Window Counter

## Usage

```ts
app.use(
    rateLimitMiddleware({
        algorithm: 'token', // algorithm to use
        limit: 5, // max 5 requests
        window: 60, // per 60 seconds
        client: redisClient, // Redis connection
    })
);
```

Attach per route or globally.
Requests exceeding the limit are blocked with a `429 Too Many Requests`

## TODO

- [x] Token Bucket
- [ ] Leaky Bucket
- [x] Fixed Window
- [ ] Sliding Window Log
- [ ] Sliding Window Counter
