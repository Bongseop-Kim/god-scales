import { describe, expect, it } from "vitest";
import { voiceKey } from "../ui/shared/sfx";

describe("TTS", () => {
  it("uses the same UTF-8 FNV-1a filename as the generator", () => {
    expect(voiceKey("zeus", "하하! 가게. 하늘은 열어 뒀네.")).toBe("dd293946");
  });
});
