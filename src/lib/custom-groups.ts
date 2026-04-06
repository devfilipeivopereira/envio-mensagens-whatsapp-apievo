import { parsePhoneCsv } from "@/lib/csv";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getSupabaseClient } from "@/lib/supabase";
import { CsvImportResult, CustomGroup } from "@/types/messaging";

const GROUP_TABLE = "app_custom_groups";
const MEMBER_TABLE = "app_custom_group_members";

interface CustomGroupRow {
  id: string;
  name: string;
  created_at: string;
}

interface CustomGroupMemberRow {
  id: string;
  group_id: string;
  phone_number: string;
  created_at: string;
}

function mapGroups(rows: CustomGroupRow[], memberRows: CustomGroupMemberRow[]): CustomGroup[] {
  const byGroup = new Map<string, string[]>();
  for (const member of memberRows) {
    const current = byGroup.get(member.group_id) ?? [];
    current.push(member.phone_number);
    byGroup.set(member.group_id, current);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    members: [...new Set((byGroup.get(row.id) ?? []).map(normalizePhoneNumber).filter(Boolean))],
    createdAt: row.created_at,
  }));
}

export async function listCustomGroups(): Promise<CustomGroup[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const [{ data: groups, error: groupsError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from(GROUP_TABLE).select("*").order("created_at", { ascending: true }),
    supabase.from(MEMBER_TABLE).select("*").order("created_at", { ascending: true }),
  ]);

  if (groupsError || membersError || !groups || !members) {
    console.error("Failed to list custom groups", groupsError?.message || membersError?.message);
    return [];
  }

  return mapGroups(groups as CustomGroupRow[], members as CustomGroupMemberRow[]);
}

export async function createCustomGroup(name: string, numbers: string[]): Promise<{ success: boolean; group?: CustomGroup; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase não configurado." };

  const normalized = [...new Set(numbers.map(normalizePhoneNumber).filter(isValidPhoneNumber))];

  const { data: groupData, error: groupError } = await supabase
    .from(GROUP_TABLE)
    .insert({ name })
    .select("*")
    .single();

  if (groupError || !groupData) {
    return { success: false, error: groupError?.message ?? "Erro ao criar grupo" };
  }

  if (normalized.length > 0) {
    const payload = normalized.map((phone) => ({ group_id: groupData.id, phone_number: phone }));
    const { error: memberError } = await supabase.from(MEMBER_TABLE).insert(payload);
    if (memberError) {
      return { success: false, error: memberError.message };
    }
  }

  const group: CustomGroup = {
    id: groupData.id,
    name: groupData.name,
    members: normalized,
    createdAt: groupData.created_at,
  };

  return { success: true, group };
}

export async function updateCustomGroup(groupId: string, name: string, numbers: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase não configurado." };

  const normalized = [...new Set(numbers.map(normalizePhoneNumber).filter(isValidPhoneNumber))];

  const { error: updateError } = await supabase.from(GROUP_TABLE).update({ name }).eq("id", groupId);
  if (updateError) return { success: false, error: updateError.message };

  const { error: clearMembersError } = await supabase.from(MEMBER_TABLE).delete().eq("group_id", groupId);
  if (clearMembersError) return { success: false, error: clearMembersError.message };

  if (normalized.length > 0) {
    const payload = normalized.map((phone) => ({ group_id: groupId, phone_number: phone }));
    const { error: memberError } = await supabase.from(MEMBER_TABLE).insert(payload);
    if (memberError) return { success: false, error: memberError.message };
  }

  return { success: true };
}

export async function deleteCustomGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase não configurado." };

  const { error } = await supabase.from(GROUP_TABLE).delete().eq("id", groupId);
  if (error) return { success: false, error: error.message };

  return { success: true };
}

export function importNumbersFromManualInput(input: string): CsvImportResult {
  const rawNumbers = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const importedSet = new Set<string>();
  const duplicatesSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const raw of rawNumbers) {
    const normalized = normalizePhoneNumber(raw);

    if (!isValidPhoneNumber(normalized)) {
      invalidSet.add(raw);
      continue;
    }

    if (importedSet.has(normalized)) {
      duplicatesSet.add(normalized);
      continue;
    }

    importedSet.add(normalized);
  }

  return {
    imported: [...importedSet],
    duplicates: [...duplicatesSet],
    invalid: [...invalidSet],
  };
}

export function importNumbersFromCsv(csvRaw: string): CsvImportResult {
  return parsePhoneCsv(csvRaw);
}
