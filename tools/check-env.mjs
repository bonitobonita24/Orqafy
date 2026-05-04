#!/usr/bin/env node
// Checks that all required environment variables are set in .env files

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const REQUIRED_VARS = [
  "COMPOSE_PROJECT_NAME",
  "APP_ENV",
  "APP_PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DATABASE_URL",
  "PGBOUNCER_PORT",
  "PGBOUNCER_AUTH_PASSWORD",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "REDIS_URL",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "PGADMIN_PORT",
  "PGADMIN_EMAIL",
  "PGADMIN_PASSWORD",
];

const envFile = process.argv[2] ?? ".env.dev";
const envPath = resolve(ROOT, envFile);

if (!existsSync(envPath)) {
  console.error(`❌ ${envFile} not found`);
  process.exit(1);
}

const content = readFileSync(envPath, "utf-8");
const lines = content.split("\n");

const definedVars = new Set();
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex > 0) {
    definedVars.add(trimmed.slice(0, eqIndex));
  }
}

const missing = [];
for (const v of REQUIRED_VARS) {
  if (!definedVars.has(v)) {
    missing.push(v);
  }
}

if (missing.length > 0) {
  console.error(`❌ ${envFile} missing required variables:`);
  for (const m of missing) {
    console.error(`   - ${m}`);
  }
  process.exit(1);
}

console.log(`✅ ${envFile} has all ${REQUIRED_VARS.length} required variables`);
