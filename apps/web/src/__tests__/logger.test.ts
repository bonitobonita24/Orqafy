import { describe, it, expect } from "vitest";
import { logger, createScopedLogger } from "@/lib/logger";

describe("logger", () => {
  it("exports a pino logger with expected log methods", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("createScopedLogger returns a child logger with expected log methods", () => {
    const child = createScopedLogger({ tenantId: "t1" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
    expect(typeof child.error).toBe("function");
    expect(typeof child.warn).toBe("function");
    expect(typeof child.debug).toBe("function");
  });

  it("calling logger.info does not throw", () => {
    expect(() => logger.info("smoke test")).not.toThrow();
  });
});
