import { randomUUID } from "crypto";

import { readStateJson, writeStateJson } from "@/lib/server-state";
import type {
  BroadcastListRecord,
  CustomContact,
  DispatchJob,
  InstanceRecord,
} from "@/lib/types";
import { nowIso, normalizeDigits, safeSchemaName } from "@/lib/utils";

const INSTANCES_PATH = "registry/instances.json";

function sortByRecent<T extends { createdAt: string; updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const updatedDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function sortDispatchJobs(items: DispatchJob[]) {
  return [...items].sort((left, right) => {
    const createdDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return new Date(right.scheduledFor).getTime() - new Date(left.scheduledFor).getTime();
  });
}

function normalizeInstanceRecord(row: Partial<InstanceRecord> & Record<string, unknown>): InstanceRecord {
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : nowIso();
  const instanceName = String(row.instanceName ?? row.instance_name ?? "").trim();

  return {
    id: typeof row.id === "string" ? row.id : randomUUID(),
    instanceName,
    apiToken: String(row.apiToken ?? row.api_token ?? "").trim(),
    baseUrl: String(row.baseUrl ?? row.base_url ?? "").trim(),
    dbSchema: String(row.dbSchema ?? row.db_schema ?? safeSchemaName(instanceName || "instance")),
    profile:
      typeof row.profile === "object" && row.profile !== null
        ? (row.profile as Record<string, unknown>)
        : {},
    createdAt,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : createdAt,
  };
}

function normalizeCustomContactRecord(
  row: Partial<CustomContact> & Record<string, unknown>,
): CustomContact {
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : nowIso();

  return {
    id: typeof row.id === "string" ? row.id : randomUUID(),
    fullName: String(row.fullName ?? "").trim(),
    phoneNumber: normalizeDigits(String(row.phoneNumber ?? "")),
    email: typeof row.email === "string" ? row.email : null,
    organization: typeof row.organization === "string" ? row.organization : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : [],
    createdAt,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : createdAt,
  };
}

function normalizeBroadcastListRecord(
  row: Partial<BroadcastListRecord> & Record<string, unknown>,
): BroadcastListRecord {
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : nowIso();

  return {
    id: typeof row.id === "string" ? row.id : randomUUID(),
    name: String(row.name ?? "").trim(),
    description: typeof row.description === "string" ? row.description : null,
    recipients: Array.isArray(row.recipients)
      ? row.recipients.map(
          (recipient) => recipient as BroadcastListRecord["recipients"][number],
        )
      : [],
    createdAt,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : createdAt,
  };
}

function normalizeDispatchJobRecord(
  row: Partial<DispatchJob> & Record<string, unknown>,
): DispatchJob {
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : nowIso();
  const scheduledFor = typeof row.scheduledFor === "string" ? row.scheduledFor : createdAt;

  return {
    id: typeof row.id === "string" ? row.id : randomUUID(),
    name: String(row.name ?? "Novo disparo"),
    instanceId: String(row.instanceId ?? ""),
    instanceName: String(row.instanceName ?? ""),
    status: String(row.status ?? "queued") as DispatchJob["status"],
    throttleMs: Number(row.throttleMs ?? 10000),
    createdAt,
    scheduledFor,
    startedAt: typeof row.startedAt === "string" ? row.startedAt : null,
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    totalRecipients: Number(row.totalRecipients ?? 0),
    successfulRecipients: Number(row.successfulRecipients ?? 0),
    failedRecipients: Number(row.failedRecipients ?? 0),
    message: row.message as DispatchJob["message"],
    recipients: Array.isArray(row.recipients)
      ? row.recipients.map(
          (recipient) => recipient as DispatchJob["recipients"][number],
        )
      : [],
  };
}

function customContactsPath(instanceId: string) {
  return `instances/${instanceId}/custom-contacts.json`;
}

function broadcastListsPath(instanceId: string) {
  return `instances/${instanceId}/broadcast-lists.json`;
}

function dispatchJobsPath(instanceId: string) {
  return `instances/${instanceId}/dispatch-jobs.json`;
}

async function readInstancesFile() {
  const rows = await readStateJson<Array<Record<string, unknown>>>(INSTANCES_PATH, []);
  return sortByRecent(rows.map((row) => normalizeInstanceRecord(row)));
}

async function writeInstancesFile(instances: InstanceRecord[]) {
  await writeStateJson(INSTANCES_PATH, sortByRecent(instances));
}

export async function listInstances() {
  return readInstancesFile();
}

export async function getInstanceById(instanceId: string) {
  const instance = (await readInstancesFile()).find((item) => item.id === instanceId);

  if (!instance) {
    throw new Error("Instancia nao encontrada.");
  }

  return instance;
}

export async function getInstanceByName(instanceName: string) {
  const normalizedName = instanceName.trim();
  return (await readInstancesFile()).find((item) => item.instanceName === normalizedName) ?? null;
}

export async function createManagedInstance(input: {
  instanceName: string;
  apiToken: string;
  baseUrl: string;
  profile?: Record<string, unknown>;
}) {
  const instances = await readInstancesFile();
  const normalizedName = input.instanceName.trim();

  if (instances.some((instance) => instance.instanceName === normalizedName)) {
    throw new Error("Ja existe uma instancia com esse nome.");
  }

  const timestamp = nowIso();
  const instance: InstanceRecord = {
    id: randomUUID(),
    instanceName: normalizedName,
    apiToken: input.apiToken.trim(),
    baseUrl: input.baseUrl.trim(),
    dbSchema: safeSchemaName(normalizedName),
    profile: input.profile ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await writeInstancesFile([instance, ...instances]);
  return instance;
}

export async function updateManagedInstance(
  instanceId: string,
  input: {
    instanceName: string;
    apiToken: string;
    baseUrl: string;
    profile?: Record<string, unknown>;
  },
) {
  const instances = await readInstancesFile();
  const targetIndex = instances.findIndex((instance) => instance.id === instanceId);

  if (targetIndex === -1) {
    throw new Error("Instancia nao encontrada para atualizacao.");
  }

  const normalizedName = input.instanceName.trim();
  const duplicate = instances.find(
    (instance) => instance.id !== instanceId && instance.instanceName === normalizedName,
  );

  if (duplicate) {
    throw new Error("Ja existe uma instancia com esse nome.");
  }

  const current = instances[targetIndex];
  const updated: InstanceRecord = {
    ...current,
    instanceName: normalizedName,
    apiToken: input.apiToken.trim(),
    baseUrl: input.baseUrl.trim(),
    profile: input.profile ?? {},
    updatedAt: nowIso(),
  };

  instances[targetIndex] = updated;
  await writeInstancesFile(instances);
  return updated;
}

export async function ensureDefaultInstanceFromEnv() {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
  const apiToken = process.env.EVOLUTION_API_KEY;
  const baseUrl = process.env.EVOLUTION_BASE_URL;

  if (!instanceName || !apiToken || !baseUrl) {
    return null;
  }

  const existing = await getInstanceByName(instanceName);

  if (existing) {
    return existing;
  }

  return createManagedInstance({
    instanceName,
    apiToken,
    baseUrl,
    profile: {
      seededFromEnv: true,
      ownerEmail: process.env.APP_LOGIN_EMAIL ?? null,
    },
  });
}

export async function getCustomContacts(instanceId: string) {
  await getInstanceById(instanceId);
  const rows = await readStateJson<Array<Record<string, unknown>>>(customContactsPath(instanceId), []);
  return sortByRecent(rows.map((row) => normalizeCustomContactRecord(row)));
}

export async function saveCustomContact(
  instanceId: string,
  payload: Omit<CustomContact, "createdAt" | "updatedAt">,
) {
  await getInstanceById(instanceId);
  const contacts = await getCustomContacts(instanceId);
  const contactId = payload.id || randomUUID();
  const existing = contacts.find((contact) => contact.id === contactId);
  const nextContact = normalizeCustomContactRecord({
    ...existing,
    ...payload,
    id: contactId,
    fullName: payload.fullName.trim(),
    phoneNumber: payload.phoneNumber,
    updatedAt: nowIso(),
    createdAt: existing?.createdAt ?? nowIso(),
  });

  const nextContacts = sortByRecent([
    nextContact,
    ...contacts.filter((contact) => contact.id !== contactId),
  ]);

  await writeStateJson(customContactsPath(instanceId), nextContacts);
  return nextContact;
}

export async function deleteCustomContact(instanceId: string, contactId: string) {
  await getInstanceById(instanceId);
  const contacts = await getCustomContacts(instanceId);
  await writeStateJson(
    customContactsPath(instanceId),
    contacts.filter((contact) => contact.id !== contactId),
  );
}

export async function getBroadcastLists(instanceId: string) {
  await getInstanceById(instanceId);
  const rows = await readStateJson<Array<Record<string, unknown>>>(broadcastListsPath(instanceId), []);
  return sortByRecent(rows.map((row) => normalizeBroadcastListRecord(row)));
}

export async function saveBroadcastList(
  instanceId: string,
  payload: Omit<BroadcastListRecord, "createdAt" | "updatedAt">,
) {
  await getInstanceById(instanceId);
  const lists = await getBroadcastLists(instanceId);
  const listId = payload.id || randomUUID();
  const existing = lists.find((list) => list.id === listId);
  const nextList = normalizeBroadcastListRecord({
    ...existing,
    ...payload,
    id: listId,
    name: payload.name.trim(),
    updatedAt: nowIso(),
    createdAt: existing?.createdAt ?? nowIso(),
  });

  const nextLists = sortByRecent([
    nextList,
    ...lists.filter((list) => list.id !== listId),
  ]);

  await writeStateJson(broadcastListsPath(instanceId), nextLists);
  return nextList;
}

export async function deleteBroadcastList(instanceId: string, listId: string) {
  await getInstanceById(instanceId);
  const lists = await getBroadcastLists(instanceId);
  await writeStateJson(
    broadcastListsPath(instanceId),
    lists.filter((list) => list.id !== listId),
  );
}

export async function listDispatchJobs(instanceId: string) {
  await getInstanceById(instanceId);
  const rows = await readStateJson<Array<Record<string, unknown>>>(dispatchJobsPath(instanceId), []);
  return sortDispatchJobs(rows.map((row) => normalizeDispatchJobRecord(row)));
}

export async function upsertDispatchJob(instanceId: string, job: DispatchJob) {
  await getInstanceById(instanceId);
  const jobs = await listDispatchJobs(instanceId);
  const nextJob = normalizeDispatchJobRecord(job as DispatchJob & Record<string, unknown>);
  const nextJobs = sortDispatchJobs([
    nextJob,
    ...jobs.filter((item) => item.id !== nextJob.id),
  ]);

  await writeStateJson(dispatchJobsPath(instanceId), nextJobs);
}

