import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// A separate file from vite.config.ts on purpose: the app's build config stays untouched, and
// tests get their own browser-like (jsdom) environment.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      // istanbul, not v8: v8 cannot read .tsx files that no test imports, and would silently
      // leave them out of the percentage.
      provider: "istanbul",
      // Only code that exists in the app: not the entry file or type-only files.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/types/**"],
      reporter: ["text-summary", "text", "html"],
    },
  },
});