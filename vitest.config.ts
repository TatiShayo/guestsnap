import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // scrypt (PIN hashing) and sharp (EXIF-strip re-encode) are intentionally
    // CPU-heavy; the default 5s budget flakes under load. Give real work room.
    testTimeout: 20_000,
  },
});
