import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "orqafy-web" },
});

export function createScopedLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
