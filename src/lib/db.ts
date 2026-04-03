import { Pool } from "pg";

import { requiredEnv, safeSchemaName } from "@/lib/utils";

declare global {
  var __whatsappSupabasePool: Pool | undefined;
}

function createPool() {
  const connectionString =
    process.env.SUPABASE_DB_POOLER_URL ?? requiredEnv("SUPABASE_DB_URL");
  const isVercel = process.env.VERCEL === "1";

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: isVercel ? 1 : 5,
  });
}

export function getPool() {
  if (!globalThis.__whatsappSupabasePool) {
    globalThis.__whatsappSupabasePool = createPool();
  }

  return globalThis.__whatsappSupabasePool;
}

export async function ensureBaseTables() {
  const pool = getPool();

  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists public.app_instances (
      id uuid primary key default gen_random_uuid(),
      instance_name text not null unique,
      api_token text not null,
      base_url text not null,
      db_schema text not null unique,
      profile jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.dispatch_runtime_state (
      runtime_key text primary key,
      last_sent_at timestamptz
    );
  `);
}

export async function ensureInstanceSchema(schemaName: string) {
  const pool = getPool();
  const safeName = schemaName.replace(/[^a-zA-Z0-9_]/g, "");

  await pool.query(`
    create schema if not exists ${safeName};

    create table if not exists ${safeName}.instance_profile (
      id uuid primary key default gen_random_uuid(),
      profile jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${safeName}.custom_contacts (
      id uuid primary key default gen_random_uuid(),
      full_name text not null,
      phone_number text not null,
      email text,
      organization text,
      notes text,
      tags jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${safeName}.broadcast_lists (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text,
      recipients jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${safeName}.dispatch_jobs (
      id uuid primary key,
      name text not null,
      instance_id uuid not null,
      instance_name text not null,
      status text not null,
      throttle_ms integer not null,
      created_at timestamptz not null,
      scheduled_for timestamptz not null,
      started_at timestamptz,
      completed_at timestamptz,
      total_recipients integer not null,
      successful_recipients integer not null,
      failed_recipients integer not null,
      message jsonb not null,
      recipients jsonb not null
    );

    alter table ${safeName}.dispatch_jobs
      add column if not exists scheduled_for timestamptz not null default now();
  `);

  await pool.query(
    `
      insert into ${safeName}.instance_profile (profile)
      select '{}'::jsonb
      where not exists (select 1 from ${safeName}.instance_profile);
    `,
  );
}

export function generateSchemaForInstance(instanceName: string) {
  return safeSchemaName(instanceName);
}
