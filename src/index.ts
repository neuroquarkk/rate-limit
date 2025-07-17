import express from 'express';
import { createClient } from 'redis';
import { rateLimitMiddleware } from './middleware';

const app = express();

const client = await createClient()
    .on('error', (err) => {
        console.error('Redis Client Error:', err);
        process.exit(1);
    })
    .connect();

app.get(
    '/token-bucket',
    rateLimitMiddleware({
        algorithm: 'token-bucket',
        limit: 10,
        window: 30,
        client,
    }),
    (_req, res) => {
        res.send('Hello from the token bucket');
    }
);

app.get('/', (_req, res) => {
    res.send('Hello from the server');
});

app.listen(8080, () => {
    console.log('Server started on PORT 8080');
});
