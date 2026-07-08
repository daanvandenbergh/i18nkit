import { defineConfig } from "vitest/config";

/**
 * Vitest config. Node environment by default (the core is pure functions, and the React
 * components render via `react-dom/server` where a DOM is not needed); the interactive
 * component tests opt into jsdom per-file with a `// @vitest-environment jsdom` pragma. JSX
 * uses React's automatic runtime. The type-safety tests (`*.test-d.ts`) are intentionally not
 * matched by `include` - they are validated by `tsc` (`npm run typecheck`), not run here.
 */
export default defineConfig({
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    test: {
        environment: "node",
        include: ["src/**/tests/**/*.test.{ts,tsx}"],
    },
});
