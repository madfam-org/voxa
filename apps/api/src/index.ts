import { serve } from '@hono/node-server';
import app, { injectWebSocket } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.LISTEN_HOST ?? '0.0.0.0';

const server = serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`Voxa API listening on http://${hostname}:${port}`);
});

injectWebSocket(server);
