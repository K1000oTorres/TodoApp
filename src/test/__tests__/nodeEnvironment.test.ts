// @vitest-environment node

describe("per-file node environment override", () => {
  it("has no window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("has no document", () => {
    expect(typeof document).toBe("undefined");
  });
});
