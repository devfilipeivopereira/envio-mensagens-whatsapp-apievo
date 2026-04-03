import { randomUUID } from "crypto";

import {
  fetchChats,
  fetchContacts,
  fetchGroupParticipants,
  sendDispatchMessage,
} from "@/lib/evolution";
import {
  getBroadcastLists,
  getCustomContacts,
  getInstanceById,
  listDispatchJobs,
  listInstances,
  upsertDispatchJob,
} from "@/lib/instance-store";
import { readStateJson, removeStateFile, writeStateJson } from "@/lib/server-state";
import type {
  CampaignAudienceRequest,
  DispatchJob,
  DispatchJobRecipient,
  DispatchMessagePayload,
  DispatchRecipient,
} from "@/lib/types";
import { dedupeRecipients, makeRecipient, nowIso, sleep } from "@/lib/utils";

const DISPATCH_STATE_PATH = "runtime/dispatch-state.json";
const DISPATCH_LOCK_PATH = "runtime/dispatch-lock.json";

interface DispatchRuntimeState {
  lastSentAt: string | null;
}

interface DispatchLockState {
  ownerId: string;
  expiresAt: string;
}

export async function buildCampaignRecipients(
  instanceId: string,
  audience: CampaignAudienceRequest,
) {
  const instance = await getInstanceById(instanceId);
  const recipients: DispatchRecipient[] = [];

  if (audience.includeAllContacts) {
    const contacts = await fetchContacts(instance);

    for (const contact of contacts) {
      if (contact.isGroup) {
        continue;
      }

      recipients.push(
        makeRecipient(
          contact.pushName ?? contact.remoteJid,
          contact.remoteJid,
          "contact",
          "todos-os-contatos",
        ),
      );
    }
  }

  if (audience.includeAllGroups || audience.includeAllGroupMembers) {
    const chats = await fetchChats(instance);
    const groups = chats.filter((chat) => chat.isGroup);

    if (audience.includeAllGroups) {
      for (const group of groups) {
        recipients.push(
          makeRecipient(
            group.pushName ?? group.remoteJid,
            group.remoteJid,
            "group",
            "todos-os-grupos",
          ),
        );
      }
    }

    if (audience.includeAllGroupMembers) {
      for (const group of groups) {
        const participants = await fetchGroupParticipants(instance, group.remoteJid);

        for (const participant of participants) {
          const target = participant.phoneNumber ?? participant.id;

          if (!target) {
            continue;
          }

          recipients.push(
            makeRecipient(
              participant.name ?? target,
              target,
              "group-member",
              `membro:${group.pushName ?? group.remoteJid}`,
            ),
          );
        }
      }
    }
  }

  if (audience.includeAllCustomContacts) {
    const customContacts = await getCustomContacts(instanceId);

    for (const contact of customContacts) {
      recipients.push(
        makeRecipient(
          contact.fullName,
          contact.phoneNumber,
          "custom-contact",
          "contatos-locais",
        ),
      );
    }
  }

  if (audience.selectedBroadcastListIds.length > 0) {
    const lists = await getBroadcastLists(instanceId);

    for (const list of lists) {
      if (!audience.selectedBroadcastListIds.includes(list.id)) {
        continue;
      }

      for (const recipient of list.recipients) {
        recipients.push({
          ...recipient,
          id: randomUUID(),
          source: `lista:${list.name}`,
        });
      }
    }
  }

  for (const number of audience.manualNumbers) {
    recipients.push(makeRecipient(number, number, "manual", "entrada-manual"));
  }

  for (const number of audience.csvNumbers) {
    recipients.push(makeRecipient(number, number, "csv", "csv"));
  }

  return dedupeRecipients(recipients);
}

function buildJobRecipients(recipients: DispatchRecipient[]) {
  return recipients.map(
    (recipient): DispatchJobRecipient => ({
      ...recipient,
      status: "pending",
      sentAt: null,
      error: null,
    }),
  );
}

export async function enqueueDispatchJob(input: {
  instanceId: string;
  name: string;
  recipients: DispatchRecipient[];
  message: DispatchMessagePayload;
  scheduledFor?: string | null;
}) {
  const instance = await getInstanceById(input.instanceId);
  const throttleMs = Math.max(
    Number(process.env.DISPATCH_MIN_INTERVAL_MS ?? "10000"),
    10_000,
  );

  const job: DispatchJob = {
    id: randomUUID(),
    name: input.name.trim() || "Novo disparo",
    instanceId: instance.id,
    instanceName: instance.instanceName,
    status: "queued",
    throttleMs,
    createdAt: nowIso(),
    scheduledFor: input.scheduledFor ?? nowIso(),
    startedAt: null,
    completedAt: null,
    totalRecipients: input.recipients.length,
    successfulRecipients: 0,
    failedRecipients: 0,
    message: input.message,
    recipients: buildJobRecipients(input.recipients),
  };

  await upsertDispatchJob(instance.id, job);

  return job;
}

async function acquireDispatchLock() {
  const now = Date.now();
  const current = await readStateJson<DispatchLockState | null>(DISPATCH_LOCK_PATH, null);

  if (current && new Date(current.expiresAt).getTime() > now) {
    return null;
  }

  const ownerId = randomUUID();
  await writeStateJson(DISPATCH_LOCK_PATH, {
    ownerId,
    expiresAt: new Date(now + 120_000).toISOString(),
  } satisfies DispatchLockState);

  const confirmed = await readStateJson<DispatchLockState | null>(DISPATCH_LOCK_PATH, null);
  return confirmed?.ownerId === ownerId ? ownerId : null;
}

async function releaseDispatchLock(ownerId: string | null) {
  if (!ownerId) {
    return;
  }

  const current = await readStateJson<DispatchLockState | null>(DISPATCH_LOCK_PATH, null);

  if (current?.ownerId === ownerId) {
    await removeStateFile(DISPATCH_LOCK_PATH);
  }
}

async function getLastSentAt() {
  const state = await readStateJson<DispatchRuntimeState>(DISPATCH_STATE_PATH, {
    lastSentAt: null,
  });

  return state.lastSentAt ? new Date(state.lastSentAt).getTime() : 0;
}

async function setLastSentAt(value: string) {
  await writeStateJson(DISPATCH_STATE_PATH, {
    lastSentAt: value,
  } satisfies DispatchRuntimeState);
}

async function findDueJobs() {
  const instances = await listInstances();
  const allJobs: DispatchJob[] = [];

  for (const instance of instances) {
    const jobs = await listDispatchJobs(instance.id);
    allJobs.push(...jobs);
  }

  const now = Date.now();

  return allJobs
    .filter((job) => {
      const scheduledAt = new Date(job.scheduledFor).getTime();
      return (
        scheduledAt <= now &&
        (job.status === "queued" || job.status === "running")
      );
    })
    .sort((left, right) => {
      return new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();
    });
}

async function waitThrottle(throttleMs: number) {
  const lastSentAt = await getLastSentAt();

  if (!lastSentAt) {
    return;
  }

  const elapsed = Date.now() - lastSentAt;

  if (elapsed < throttleMs) {
    await sleep(throttleMs - elapsed);
  }
}

async function processSingleJob(job: DispatchJob, deadline: number) {
  const instance = await getInstanceById(job.instanceId);
  job.status = "running";
  job.startedAt = job.startedAt ?? nowIso();
  await upsertDispatchJob(job.instanceId, job);

  for (const recipient of job.recipients) {
    if (Date.now() >= deadline) {
      await upsertDispatchJob(job.instanceId, job);
      return;
    }

    if (recipient.status !== "pending") {
      continue;
    }

    try {
      await waitThrottle(job.throttleMs);
      await sendDispatchMessage(instance, recipient.target, job.message);
      recipient.status = "sent";
      recipient.sentAt = nowIso();
      recipient.error = null;
      job.successfulRecipients += 1;
      await setLastSentAt(recipient.sentAt);
    } catch (error) {
      recipient.status = "failed";
      recipient.sentAt = nowIso();
      recipient.error =
        error instanceof Error ? error.message : "Falha desconhecida";
      job.failedRecipients += 1;
      await setLastSentAt(recipient.sentAt);
    }

    await upsertDispatchJob(job.instanceId, job);
  }

  if (job.failedRecipients === 0) {
    job.status = "completed";
  } else if (job.successfulRecipients === 0) {
    job.status = "failed";
  } else {
    job.status = "partial";
  }

  job.completedAt = nowIso();
  await upsertDispatchJob(job.instanceId, job);
}

export async function processDueDispatchJobs(maxDurationMs = 50_000) {
  const lockOwner = await acquireDispatchLock();

  if (!lockOwner) {
    return {
      processed: 0,
      skipped: true,
      reason: "Outro worker ja esta processando a fila.",
    };
  }

  try {
    const deadline = Date.now() + maxDurationMs;
    const dueJobs = await findDueJobs();

    let processed = 0;

    for (const job of dueJobs) {
      if (Date.now() >= deadline) {
        break;
      }

      await processSingleJob(job, deadline);
      processed += 1;
    }

    return {
      processed,
      skipped: false,
    };
  } finally {
    await releaseDispatchLock(lockOwner);
  }
}
