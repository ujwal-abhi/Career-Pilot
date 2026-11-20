import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only unmounts rendered components by itself when test functions are global.
// They are not here (every test imports what it uses), so do it explicitly after each test.
afterEach(() => {
  cleanup();
});