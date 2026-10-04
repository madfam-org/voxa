/**
 * A minimal WebSocket client for tests (Node 20 has no global WebSocket and
 * the API takes no extra dependency for it). It performs the HTTP upgrade,
 * then decodes the server's unmasked text frames. It never sends data frames;
 * `close()` drops the TCP connection.
 */
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import type { Socket } from 'node:net';

export interface TestWsClient {
  /** Text messages received so far, parsed as JSON. */
  messages: unknown[];
  /** Resolves with the first message (received now or later) that matches. */
  waitFor(predicate: (message: unknown) => boolean, timeoutMs?: number): Promise<unknown>;
  close(): void;
}

export function connectTestWs(url: string, headers: Record<string, string> = {}): Promise<TestWsClient> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request({
      host: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...headers,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    });
    req.on('response', (res) => reject(new Error(`WebSocket upgrade refused: HTTP ${res.statusCode}`)));
    req.on('error', reject);
    req.on('upgrade', (_res, socket: Socket, head: Buffer) => {
      const messages: unknown[] = [];
      const waiters: { predicate: (m: unknown) => boolean; resolve: (m: unknown) => void }[] = [];
      let buffer = head;

      const deliver = (message: unknown) => {
        messages.push(message);
        for (const waiter of [...waiters]) {
          if (waiter.predicate(message)) {
            waiters.splice(waiters.indexOf(waiter), 1);
            waiter.resolve(message);
          }
        }
      };

      const drain = () => {
        for (;;) {
          if (buffer.length < 2) return;
          const opcode = buffer[0]! & 0x0f;
          let length = buffer[1]! & 0x7f;
          let offset = 2;
          if (length === 126) {
            if (buffer.length < 4) return;
            length = buffer.readUInt16BE(2);
            offset = 4;
          } else if (length === 127) {
            if (buffer.length < 10) return;
            length = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }
          if (buffer.length < offset + length) return;
          const payload = buffer.subarray(offset, offset + length);
          buffer = buffer.subarray(offset + length);
          if (opcode === 0x1) {
            const text = payload.toString('utf8');
            try {
              deliver(JSON.parse(text));
            } catch {
              deliver(text);
            }
          } else if (opcode === 0x8) {
            deliver({ type: '__close', code: payload.length >= 2 ? payload.readUInt16BE(0) : undefined });
          }
        }
      };

      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        drain();
      });
      socket.on('error', () => undefined);
      drain();

      resolve({
        messages,
        waitFor(predicate, timeoutMs = 5_000) {
          const seen = messages.find(predicate);
          if (seen !== undefined) return Promise.resolve(seen);
          return new Promise((resolveWait, rejectWait) => {
            const timer = setTimeout(() => {
              rejectWait(
                new Error(`No matching WebSocket message within ${timeoutMs} ms; got ${JSON.stringify(messages)}`),
              );
            }, timeoutMs);
            waiters.push({
              predicate,
              resolve: (m) => {
                clearTimeout(timer);
                resolveWait(m);
              },
            });
          });
        },
        close() {
          socket.destroy();
        },
      });
    });
    req.end();
  });
}
