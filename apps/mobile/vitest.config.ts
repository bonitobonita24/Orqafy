import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config for PURE logic in the mobile package (no React Native
 * runtime). Only files that import nothing from react-native / watermelondb can
 * be tested here — currently the sync reconcile planner, whose correctness
 * matters because a wrong plan can permanently destroy local rows.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/sync/**/__tests__/**/*.test.ts"],
  },
});
