import { QueueItemState } from "@/types/messaging";

export interface QueueRunOptions<TItem> {
  items: TItem[];
  delayMs: number;
  onUpdate: (items: QueueItemState[]) => void;
  worker: (item: TItem, index: number) => Promise<{ success: boolean; error?: string }>;
  getLabel: (item: TItem, index: number) => string;
  signal?: { cancelled: boolean };
}

export async function runQueue<TItem>(options: QueueRunOptions<TItem>): Promise<QueueItemState[]> {
  const states: QueueItemState[] = options.items.map((item, index) => ({
    id: String(index),
    label: options.getLabel(item, index),
    status: "pending",
  }));

  options.onUpdate([...states]);

  for (let index = 0; index < options.items.length; index++) {
    if (options.signal?.cancelled) {
      for (let i = index; i < states.length; i++) {
        if (states[i].status === "pending") states[i].status = "cancelled";
      }
      options.onUpdate([...states]);
      return states;
    }

    states[index].status = "sending";
    options.onUpdate([...states]);

    const result = await options.worker(options.items[index], index);
    states[index].status = result.success ? "sent" : "error";
    states[index].error = result.error;
    options.onUpdate([...states]);

    if (index < options.items.length - 1 && !options.signal?.cancelled) {
      await delay(options.delayMs);
    }
  }

  return states;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
