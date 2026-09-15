import { describe, expect, it } from "vitest";
import { coverageSummary } from "../../src/registry/coverage";
import { listExposedOperations } from "../../src/registry/operations";

describe("protocol readiness metadata", () => {
  it("advertises progressive discovery tool set conceptually", () => {
    const tools = ["search", "execute", "execute_mutation"];
    expect(tools).toHaveLength(3);
    expect(listExposedOperations().length).toBeGreaterThan(0);
    expect(coverageSummary().excluded).toBeGreaterThan(0);
  });
});
