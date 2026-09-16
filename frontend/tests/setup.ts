import "@testing-library/jest-dom/vitest";
import { beforeAll, afterAll } from "vitest";

// Mock ResizeObserver for Recharts ResponsiveContainer in jsdom test environment
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined") {
  window.ResizeObserver = MockResizeObserver;
}

// Filter known Recharts jsdom zero-dimension console warning in non-browser test runner
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("The width(0) and height(0) of chart should be greater than 0")
    ) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});
