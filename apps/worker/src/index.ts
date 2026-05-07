import Redis from 'ioredis';
import { createTenantProvisioningWorker } from '@orqafy/jobs';
import { processTenantProvisioning } from './processors/tenant-provisioning.js';
import { startHealthServer, stopHealthServer } from './health.js';

const REDIS_URL = process.env['REDIS_URL'];
if (REDIS_URL == null || REDIS_URL === '') {
  console.error('[worker] REDIS_URL is required');
  process.exit(1);
}

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err: Error) => {
  console.error('[worker] Redis connection error:', err.message);
});

const tenantProvisioningWorker = createTenantProvisioningWorker(
  processTenantProvisioning,
  connection,
);

// DLQ logger — log failed jobs for manual inspection
tenantProvisioningWorker.on('failed', (job, err) => {
  console.error(
    `[tenant-provisioning] FAILED job=${job?.id ?? 'unknown'} attempts=${job?.attemptsMade ?? 0} err=${err.message}`,
  );
});

tenantProvisioningWorker.on('error', (err) => {
  console.error('[tenant-provisioning] worker error:', err.message);
});

tenantProvisioningWorker.on('completed', (job) => {
  console.log(`[tenant-provisioning] COMPLETED job=${job.id}`);
});

const PORT = Number(process.env['WORKER_PORT'] ?? 42952);
startHealthServer(PORT);

console.log('[worker] Orqafy worker started. Listening for jobs…');

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal} — graceful shutdown started`);
  stopHealthServer();
  await tenantProvisioningWorker.close();
  await connection.quit();
  console.log('[worker] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
