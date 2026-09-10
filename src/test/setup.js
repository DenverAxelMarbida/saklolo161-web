import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react only auto-cleans up when it detects a global
// `afterEach` (vitest globals). This project runs vitest without globals,
// so register cleanup explicitly to avoid state leaking between tests.
afterEach(() => {
  cleanup();
});