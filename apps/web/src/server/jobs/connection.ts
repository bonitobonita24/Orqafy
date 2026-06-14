/**
 * BullMQ connection options for the web app's queue producers.
 *
 * IMPORTANT: prefer REDIS_URL — it is the in-network connection string the rest
 * of the app and the worker use (`redis://:<pw>@orqafy_dev_valkey:6379`). The
 * older `REDIS_HOST`/`REDIS_PORT` env pair carries the HOST-mapped values
 * (e.g. `localhost:42943`) which are NOT reachable from inside the app
 * container — using them made `queues.tenantProvisioning.add()` hang on
 * ECONNREFUSED, so `/register` stalled on "Creating workspace…". The worker
 * already connects via `new Redis(REDIS_URL)`; this mirrors that exactly.
 */
import IORedis from "ioredis";

// `createQueues` accepts BullMQ's ConnectionOptions; we derive the exact param
// type from it so the web package never needs a direct `bullmq` dependency.
type JobConnection = Parameters<typeof import("@orqafy/jobs")["createQueues"]>[0];

export function jobConnection(): JobConnection {
  const url = process.env["REDIS_URL"];
  if (url != null && url !== "") {
    // BullMQ requires maxRetriesPerRequest: null on the shared connection.
    return new IORedis(url, { maxRetriesPerRequest: null }) as unknown as JobConnection;
  }
  // Fallback (local non-Docker runs): assemble from discrete vars.
  return {
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
    password: process.env["REDIS_PASSWORD"],
  } as unknown as JobConnection;
}
