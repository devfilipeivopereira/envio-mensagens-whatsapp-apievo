import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchBlocksToTarget } from "@/lib/block-dispatch";
import { EvolutionConfig } from "@/lib/evolution-api";
import { MessageBlock } from "@/types/messaging";

const config: EvolutionConfig = { baseUrl: "https://evolution.example.com", apiToken: "token" };

describe("dispatchBlocksToTarget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches blocks sequentially using Evolution endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 201, text: async () => "{}" } as Response);

    const blocks: MessageBlock[] = [
      { id: "1", type: "text", text: "hello" },
      {
        id: "2",
        type: "media",
        sourceMode: "url",
        mediaUrl: "https://cdn.example.com/a.png",
        mediatype: "image",
        mimetype: "image/png",
        fileName: "a.png",
        caption: "img",
      },
    ];

    const result = await dispatchBlocksToTarget(config, "instance-1", "5511999999999", blocks);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0]?.[0]?.toString();
    const secondCall = fetchMock.mock.calls[1]?.[0]?.toString();

    expect(firstCall).toContain("/message/sendText/instance-1");
    expect(secondCall).toContain("/message/sendMedia/instance-1");
  });

  it("stops and returns error when one block fails", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" } as Response)
      .mockResolvedValue({ ok: true, status: 201, text: async () => "{}" } as Response);

    const blocks: MessageBlock[] = [{ id: "1", type: "text", text: "hello" }];
    const result = await dispatchBlocksToTarget(config, "instance-1", "5511999999999", blocks);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Error 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
