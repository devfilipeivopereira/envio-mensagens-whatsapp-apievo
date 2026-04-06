import { describe, expect, it } from "vitest";
import { createDefaultBlock, validateBlock } from "@/lib/message-blocks";

describe("message blocks", () => {
  it("creates default text block", () => {
    const block = createDefaultBlock("text");
    expect(block.type).toBe("text");
  });

  it("validates required fields", () => {
    const media = createDefaultBlock("media");
    const invalid = validateBlock({ ...media, mediaUrl: "" });
    expect(invalid).toBeTruthy();

    const valid = validateBlock({ ...media, mediaUrl: "https://example.com/file.png" });
    expect(valid).toBeNull();
  });
});
