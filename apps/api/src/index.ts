import { serve } from '@hono/node-server';
import app, { injectWebSocket } from './app.js';

const port = Number(process.env.PORT ?? 4000);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Voxa API listening on http://localhost:${port}`);
});

injectWebSocket(server);
