import { getSupabaseClient } from "@/lib/supabase";

export type InstanceStatus = "created" | "connecting" | "open" | "close";

export interface Instance {
  id: string;
  name: string;
  token: string;
  phoneNumber: string;
  status: InstanceStatus;
  qrcode?: string;
  createdAt: string;
}

const STORAGE_KEY = "evolution-instances";
const TABLE_NAME = "app_instances";

interface InstanceRow {
  id: string;
  name: string;
  token: string;
  phone_number: string;
  status: InstanceStatus;
  qrcode: string | null;
  created_at: string;
}

function loadInstancesFromLocalStorage(): Instance[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveInstancesToLocalStorage(instances: Instance[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
}

function mapRowToInstance(row: InstanceRow): Instance {
  return {
    id: row.id,
    name: row.name,
    token: row.token,
    phoneNumber: row.phone_number ?? "",
    status: row.status,
    qrcode: row.qrcode ?? undefined,
    createdAt: row.created_at,
  };
}

function mapInstanceToRow(instance: Instance): InstanceRow {
  return {
    id: instance.id,
    name: instance.name,
    token: instance.token,
    phone_number: instance.phoneNumber,
    status: instance.status,
    qrcode: instance.qrcode ?? null,
    created_at: instance.createdAt,
  };
}

export async function loadInstances(): Promise<Instance[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return loadInstancesFromLocalStorage();
  }

  const { data, error } = await supabase.from(TABLE_NAME).select("*").order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Falha ao carregar instâncias do Supabase:", error?.message);
    return loadInstancesFromLocalStorage();
  }

  const instances = (data as InstanceRow[]).map(mapRowToInstance);
  saveInstancesToLocalStorage(instances);
  return instances;
}

export async function saveInstances(instances: Instance[]): Promise<void> {
  saveInstancesToLocalStorage(instances);

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const rows = instances.map(mapInstanceToRow);
  const { data: existingRows, error: existingRowsError } = await supabase.from(TABLE_NAME).select("id");

  if (existingRowsError) {
    console.error("Falha ao listar instâncias atuais no Supabase:", existingRowsError.message);
    return;
  }

  const existingIds = (existingRows ?? []).map((row: { id: string }) => row.id);
  const incomingIds = new Set(instances.map((instance) => instance.id));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().in("id", idsToDelete);
    if (deleteError) {
      console.error("Falha ao remover instâncias no Supabase:", deleteError.message);
    }
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "id" });
    if (upsertError) {
      console.error("Falha ao salvar instâncias no Supabase:", upsertError.message);
    }
  }
}

export function generateInstanceName(phone: string): string {
  return `instance_${phone.replace(/\D/g, "")}`;
}

export function generateToken(): string {
  return crypto.randomUUID();
}
