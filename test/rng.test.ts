import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";

describe("createRng", () => {
  it("replays a seed", () => {
    const first = createRng(20250804);
    const second = createRng(20250804);

    expect(Array.from({ length: 1_000 }, first)).toEqual(
      Array.from({ length: 1_000 }, second),
    );
  });
});
