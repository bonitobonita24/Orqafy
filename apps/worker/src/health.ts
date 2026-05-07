import { createServer, type Server } from 'node:http';

let server: Server | null = null;

export function startHealthServer(port: number): void {
  server = createServer((req, res) => {
    if (req.url === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'orqafy-worker', ts: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`[worker] Health endpoint: http://localhost:${port}/api/health`);
  });

  server.on('error', (err: Error) => {
    console.error('[worker] Health server error:', err.message);
  });
}

export function stopHealthServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
