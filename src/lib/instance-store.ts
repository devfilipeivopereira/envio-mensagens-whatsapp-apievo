import { randomUUID } from "crypto";

import { ensureBaseTables, ensureInstanceSchema, generateSchemaForInstance, getPool } from "@/lib/db";
import type {
  BroadcastListRecord,
  CustomContact,
  DispatchJob,
  InstanceRecord,
} from "@/lib/types";
import { nowIso, normalizeDigits, requiredEnv } from "@/lib/utils";

function mapInstance(row: Record<string, unknown>): InstanceRecord {
  return {
    id: String(row.id),
    instanceName: String(row.instance_name),
    apiToken: String(row.api_token),
    baseUrl: String(row.base_url),
    dbSchema: String(row.db_schema),
    profile:
      typeof row.profile === "object" && row.profile !== null
        ? (row.profile as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function safeSchema(schemaName: string) {
  return schemaName.replace(/[^a-zA-Z0-9_]/g, "");
}

export async function listInstances() {
  await ensureBaseTables();
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from public.app_instances
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map((row) => mapInstance(row));
}

export async function getInstanceById(instanceId: string) {
  await ensureBaseTables();
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from public.app_instances
      where id = $1
      limit 1
    `,
    [instanceId],
  );

  if (!result.rows[0]) {
    throw new Error("Instancia nao encontrada.");
  }

  return mapInstance(result.rows[0]);
}

export async function getInstanceByName(instanceName: string) {
  await ensureBaseTables();
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from public.app_instances
      where instance_name = $1
      limit 1
    `,
    [instanceName],
  );

  return result.rows[0] ? mapInstance(result.rows[0]) : null;
}

export async function createManagedInstance(input: {
  instanceName: string;
  apiToken: string;
  baseUrl: string;
  profile?: Record<string, unknown>;
}) {
  await ensureBaseTables();
  const pool = getPool();
  const schemaName = generateSchemaForInstance(input.instanceName);
  const profile = input.profile ?? {};

  const result = await pool.query(
    `
      insert into public.app_instances (
        instance_name,
        api_token,
        base_url,
        db_schema,
        profile,
        updated_at
      )
      values ($1, $2, $3, $4, $5::jsonb, now())
      returning *
    `,
    [
      input.instanceName,
      input.apiToken,
      input.baseUrl,
      schemaName,
      JSON.stringify(profile),
    ],
  );

  await ensureInstanceSchema(schemaName);

  return mapInstance(result.rows[0]);
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
  await ensureBaseTables();
  const pool = getPool();
  const profile = input.profile ?? {};
  const result = await pool.query(
    `
      update public.app_instances
      set
        instance_name = $2,
        api_token = $3,
        base_url = $4,
        profile = $5::jsonb,
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      instanceId,
      input.instanceName,
      input.apiToken,
      input.baseUrl,
      JSON.stringify(profile),
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Instancia nao encontrada para atualizacao.");
  }

  return mapInstance(result.rows[0]);
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

async function getSchemaForInstance(instanceId: string) {
  const instance = await getInstanceById(instanceId);

  return {
    instance,
    schema: safeSchema(instance.dbSchema),
  };
}

export async function getCustomContacts(instanceId: string) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from ${schema}.custom_contacts
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map(
    (row): CustomContact => ({
      id: String(row.id),
      fullName: String(row.full_name),
      phoneNumber: String(row.phone_number),
      email: typeof row.email === "string" ? row.email : null,
      organization:
        typeof row.organization === "string" ? row.organization : null,
      notes: typeof row.notes === "string" ? row.notes : null,
      tags: Array.isArray(row.tags)
        ? row.tags.map((tag: unknown) => String(tag))
        : [],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }),
  );
}

export async function saveCustomContact(
  instanceId: string,
  payload: Omit<CustomContact, "createdAt" | "updatedAt">,
) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  const contactId = payload.id || randomUUID();
  const result = await pool.query(
    `
      insert into ${schema}.custom_contacts (
        id,
        full_name,
        phone_number,
        email,
        organization,
        notes,
        tags,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
      on conflict (id) do update set
        full_name = excluded.full_name,
        phone_number = excluded.phone_number,
        email = excluded.email,
        organization = excluded.organization,
        notes = excluded.notes,
        tags = excluded.tags,
        updated_at = now()
      returning *
    `,
    [
      contactId,
      payload.fullName.trim(),
      normalizeDigits(payload.phoneNumber),
      payload.email,
      payload.organization,
      payload.notes,
      JSON.stringify(payload.tags),
    ],
  );

  const row = result.rows[0];

  return {
    id: String(row.id),
    fullName: String(row.full_name),
    phoneNumber: String(row.phone_number),
    email: typeof row.email === "string" ? row.email : null,
    organization: typeof row.organization === "string" ? row.organization : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag: unknown) => String(tag))
      : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  } satisfies CustomContact;
}

export async function deleteCustomContact(instanceId: string, contactId: string) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  await pool.query(
    `
      delete from ${schema}.custom_contacts
      where id = $1
    `,
    [contactId],
  );
}

export async function getBroadcastLists(instanceId: string) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from ${schema}.broadcast_lists
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map(
    (row): BroadcastListRecord => ({
      id: String(row.id),
      name: String(row.name),
      description: typeof row.description === "string" ? row.description : null,
      recipients: Array.isArray(row.recipients)
        ? row.recipients.map(
            (recipient: unknown) =>
              recipient as BroadcastListRecord["recipients"][number],
          )
        : [],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }),
  );
}

export async function saveBroadcastList(
  instanceId: string,
  payload: Omit<BroadcastListRecord, "createdAt" | "updatedAt">,
) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  const listId = payload.id || randomUUID();
  const result = await pool.query(
    `
      insert into ${schema}.broadcast_lists (
        id,
        name,
        description,
        recipients,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4::jsonb, now(), now())
      on conflict (id) do update set
        name = excluded.name,
        description = excluded.description,
        recipients = excluded.recipients,
        updated_at = now()
      returning *
    `,
    [
      listId,
      payload.name.trim(),
      payload.description,
      JSON.stringify(payload.recipients),
    ],
  );

  const row = result.rows[0];

  return {
    id: String(row.id),
    name: String(row.name),
    description: typeof row.description === "string" ? row.description : null,
    recipients: Array.isArray(row.recipients)
      ? row.recipients.map(
          (recipient: unknown) =>
            recipient as BroadcastListRecord["recipients"][number],
        )
      : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  } satisfies BroadcastListRecord;
}

export async function deleteBroadcastList(instanceId: string, listId: string) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  await pool.query(
    `
      delete from ${schema}.broadcast_lists
      where id = $1
    `,
    [listId],
  );
}

export async function listDispatchJobs(instanceId: string) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  const result = await pool.query(
    `
      select *
      from ${schema}.dispatch_jobs
      order by created_at desc
    `,
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    instanceId: String(row.instance_id),
    instanceName: String(row.instance_name),
    status: String(row.status) as DispatchJob["status"],
    throttleMs: Number(row.throttle_ms),
    createdAt: String(row.created_at),
    scheduledFor: String(row.scheduled_for),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    totalRecipients: Number(row.total_recipients),
    successfulRecipients: Number(row.successful_recipients),
    failedRecipients: Number(row.failed_recipients),
    message: row.message as DispatchJob["message"],
    recipients: row.recipients as DispatchJob["recipients"],
  })) satisfies DispatchJob[];
}

export async function upsertDispatchJob(instanceId: string, job: DispatchJob) {
  const { schema } = await getSchemaForInstance(instanceId);
  const pool = getPool();
  await pool.query(
    `
      insert into ${schema}.dispatch_jobs (
        id,
        name,
        instance_id,
        instance_name,
        status,
        throttle_ms,
        created_at,
        scheduled_for,
        started_at,
        completed_at,
        total_recipients,
        successful_recipients,
        failed_recipients,
        message,
        recipients
      )
      values (
        $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::timestamptz,
        $11, $12, $13, $14::jsonb, $15::jsonb
      )
      on conflict (id) do update set
        name = excluded.name,
        status = excluded.status,
        throttle_ms = excluded.throttle_ms,
        scheduled_for = excluded.scheduled_for,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        total_recipients = excluded.total_recipients,
        successful_recipients = excluded.successful_recipients,
        failed_recipients = excluded.failed_recipients,
        message = excluded.message,
        recipients = excluded.recipients
    `,
    [
      job.id,
      job.name,
      job.instanceId,
      job.instanceName,
      job.status,
      job.throttleMs,
      job.createdAt,
      job.scheduledFor,
      job.startedAt,
      job.completedAt,
      job.totalRecipients,
      job.successfulRecipients,
      job.failedRecipients,
      JSON.stringify(job.message),
      JSON.stringify(job.recipients),
    ],
  );
}
