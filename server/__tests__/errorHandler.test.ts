/**
 * The global error handler.
 *
 * These drive a real server over a real socket rather than calling the handler with
 * a fake response, because the defect being guarded against was not in what the
 * handler wrote -- that part was already correct -- but in what it did to the
 * connection afterwards.
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createErrorHandler } from '../errorHandler';

type Reply = { status?: number; body: string; error?: string };

/** A server with one failing route, and a keep-alive agent so the socket is reused. */
async function withServer(
  configure: (app: express.Express) => void,
  run: (get: (path: string) => Promise<Reply>) => Promise<void>,
) {
  const app = express();
  configure(app);
  app.use(createErrorHandler(() => {}));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

  const get = (path: string) =>
    new Promise<Reply>((resolve) => {
      const req = http.get({ port, host: '127.0.0.1', path, agent }, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', (e: NodeJS.ErrnoException) => resolve({ body: '', error: e.code ?? e.message }));
    });

  try {
    await run(get);
  } finally {
    agent.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const failing = (err: unknown) => (app: express.Express) => {
  app.get('/boom', (_req, _res, next) => next(err));
  app.get('/fine', (_req, res) => { res.json({ ok: true }); });
};

describe('global error handler', () => {
  it('leaves the connection usable for the next request on the same socket', async () => {
    // The regression: the handler rethrew after responding, Express handed that to
    // finalhandler, and finalhandler -- headers already sent -- destroyed the socket.
    // The failure then surfaced on whatever request reused that pooled connection.
    await withServer(failing(new Error('boom')), async (get) => {
      const first = await get('/boom');
      expect(first.status).toBe(500);

      const second = await get('/fine');
      expect(second.error).toBeUndefined();
      expect(second.status).toBe(200);
      expect(JSON.parse(second.body)).toEqual({ ok: true });
    });
  });

  it('does not disclose the internal message of a 500', async () => {
    const leaky = new Error('connect ECONNREFUSED 10.0.0.4:5432 password=hunter2');

    await withServer(failing(leaky), async (get) => {
      const res = await get('/boom');
      expect(res.status).toBe(500);
      expect(res.body).not.toContain('hunter2');
      expect(res.body).not.toContain('5432');
      expect(JSON.parse(res.body)).toEqual({ error: 'Internal Server Error' });
    });
  });

  it('keeps the wording of an error raised deliberately with a 4xx status', async () => {
    const refused: any = new Error('Child is not in your daycare');
    refused.status = 403;

    await withServer(failing(refused), async (get) => {
      const res = await get('/boom');
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Child is not in your daycare' });
    });
  });

  it('reports errors under the same "error" key as the rest of the API', async () => {
    const refused: any = new Error('Invalid input');
    refused.statusCode = 400;

    await withServer(failing(refused), async (get) => {
      const res = await get('/boom');
      expect(JSON.parse(res.body)).toHaveProperty('error');
      expect(JSON.parse(res.body)).not.toHaveProperty('message');
    });
  });

  it('does not append to a response a route had already begun', async () => {
    await withServer(
      (app) => {
        app.get('/boom', (_req, res, next) => {
          res.status(200).json({ partial: true });
          next(new Error('too late'));
        });
      },
      async (get) => {
        const res = await get('/boom');
        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ partial: true });
      },
    );
  });

  it('logs the failure rather than swallowing it', async () => {
    const lines: string[] = [];
    const app = express();
    app.get('/boom', (_req, _res, next) => next(new Error('kaboom')));
    app.use(createErrorHandler((m) => lines.push(m)));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    await new Promise<void>((resolve) => {
      http.get({ port, host: '127.0.0.1', path: '/boom' }, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('GET /boom failed with 500');
    expect(lines[0]).toContain('kaboom');
  });
});
