import { getSupabaseClient } from "@/lib/supabase";

export interface ContactGroup {
  id: string;
  name: string;
  numbers: string[];
}

const STORAGE_KEY = "evolution-contact-groups";
const TABLE_NAME = "app_contact_groups";

interface GroupRow {
  id: string;
  name: string;
  numbers: string[] | null;
}

function loadGroupsFromLocalStorage(): ContactGroup[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveGroupsToLocalStorage(groups: ContactGroup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function mapRowToGroup(row: GroupRow): ContactGroup {
  return {
    id: row.id,
    name: row.name,
    numbers: row.numbers ?? [],
  };
}

function mapGroupToRow(group: ContactGroup): GroupRow {
  return {
    id: group.id,
    name: group.name,
    numbers: group.numbers,
  };
}

export async function loadGroups(): Promise<ContactGroup[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return loadGroupsFromLocalStorage();
  }

  const { data, error } = await supabase.from(TABLE_NAME).select("*").order("name", { ascending: true });

  if (error || !data) {
    console.error("Falha ao carregar grupos do Supabase:", error?.message);
    return loadGroupsFromLocalStorage();
  }

  const groups = (data as GroupRow[]).map(mapRowToGroup);
  saveGroupsToLocalStorage(groups);
  return groups;
}

export async function saveGroups(groups: ContactGroup[]): Promise<void> {
  saveGroupsToLocalStorage(groups);

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const rows = groups.map(mapGroupToRow);
  const { data: existingRows, error: existingRowsError } = await supabase.from(TABLE_NAME).select("id");

  if (existingRowsError) {
    console.error("Falha ao listar grupos atuais no Supabase:", existingRowsError.message);
    return;
  }

  const existingIds = (existingRows ?? []).map((row: { id: string }) => row.id);
  const incomingIds = new Set(groups.map((group) => group.id));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().in("id", idsToDelete);
    if (deleteError) {
      console.error("Falha ao remover grupos no Supabase:", deleteError.message);
    }
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "id" });
    if (upsertError) {
      console.error("Falha ao salvar grupos no Supabase:", upsertError.message);
    }
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
