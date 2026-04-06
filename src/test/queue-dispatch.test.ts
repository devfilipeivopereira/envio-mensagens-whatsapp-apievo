import { describe, expect, it, vi } from "vitest";
import { runQueue } from "@/lib/queue/dispatch";

describe("runQueue", () => {
  it("respects delay and updates states", async () => {
    vi.useFakeTimers();

    const updates: string[][] = [];
    const promise = runQueue({
      items: ["a", "b"],
      delayMs: 10000,
      getLabel: (item) => item,
      onUpdate: (state) => updates.push(state.map((item) => item.status)),
      worker: async () => ({ success: true }),
    });

    await vi.runAllTimersAsync();
    const finalStates = await promise;

    expect(finalStates.map((item) => item.status)).toEqual(["sent", "sent"]);
    expect(updates.length).toBeGreaterThan(2);

    vi.useRealTimers();
  });
});
