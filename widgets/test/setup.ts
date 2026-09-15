import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when vitest globals are enabled; they are not.
afterEach(() => {
  cleanup();
});
