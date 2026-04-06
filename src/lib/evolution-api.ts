import { getSupabaseClient } from "@/lib/supabase";
import { EvolutionGroup, EvolutionGroupParticipant, SendResult } from "@/types/messaging";

export interface EvolutionConfig {
  baseUrl: string;
  apiToken: string;
}

const STORAGE_KEY = "evolution-api-config";
const SETTINGS_TABLE_NAME = "app_settings";
const SETTINGS_KEY = "evolution-api-config";

function saveConfigToLocalStorage(config: EvolutionConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadConfigFromLocalStorage(): EvolutionConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveConfig(config: EvolutionConfig): Promise<void> {
  saveConfigToLocalStorage(config);

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from(SETTINGS_TABLE_NAME)
    .upsert({ key: SETTINGS_KEY, value: config }, { onConflict: "key" });

  if (error) {
    console.error("Failed to save configuration in Supabase:", error.message);
  }
}

export async function loadConfig(): Promise<EvolutionConfig | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return loadConfigFromLocalStorage();
  }

  const { data, error } = await supabase
    .from(SETTINGS_TABLE_NAME)
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.error("Failed to load configuration from Supabase:", error.message);
    return loadConfigFromLocalStorage();
  }

  const value = data?.value as EvolutionConfig | undefined;
  if (!value || !value.baseUrl || !value.apiToken) {
    return loadConfigFromLocalStorage();
  }

  saveConfigToLocalStorage(value);
  return value;
}

export async function clearConfig(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from(SETTINGS_TABLE_NAME).delete().eq("key", SETTINGS_KEY);
  if (error) {
    console.error("Failed to remove configuration from Supabase:", error.message);
  }
}

function baseUrl(config: EvolutionConfig) {
  return config.baseUrl.replace(/\/$/, "");
}

function headers(config: EvolutionConfig) {
  return {
    "Content-Type": "application/json",
    apikey: config.apiToken,
  };
}

async function requestJson<T = unknown>(
  config: EvolutionConfig,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> {
  const response = await fetch(`${baseUrl(config)}${path}`, {
    method: options?.method ?? "GET",
    headers: headers(config),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, text };
  }

  if (!text) {
    return { ok: true, status: response.status };
  }

  try {
    return { ok: true, status: response.status, data: JSON.parse(text) as T };
  } catch {
    return { ok: true, status: response.status, text };
  }
}

function toError(status: number, message?: string) {
  return `Error ${status}: ${message || "Unknown error"}`;
}

export async function checkConnection(config: EvolutionConfig, instanceName: string): Promise<string> {
  const result = await requestJson<{ instance?: { state?: string } }>(config, `/instance/connectionState/${instanceName}`);
  if (!result.ok) throw new Error(toError(result.status, result.text));
  return result.data?.instance?.state ?? "close";
}

export async function createInstance(
  config: EvolutionConfig,
  payload: { instanceName: string; token: string; number?: string }
): Promise<SendResult> {
  const result = await requestJson(config, "/instance/create", {
    method: "POST",
    body: {
      instanceName: payload.instanceName,
      token: payload.token,
      number: payload.number,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    },
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export async function deleteInstance(config: EvolutionConfig, instanceName: string): Promise<SendResult> {
  const result = await requestJson(config, `/instance/delete/${instanceName}`, { method: "DELETE" });
  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true };
}

export async function connectInstance(
  config: EvolutionConfig,
  instanceName: string
): Promise<{ qrcode?: string; error?: string }> {
  const result = await requestJson<{ base64?: string; qrcode?: { base64?: string }; code?: string }>(
    config,
    `/instance/connect/${instanceName}`
  );

  if (!result.ok) return { error: toError(result.status, result.text) };

  const qr = result.data?.base64 ?? result.data?.qrcode?.base64 ?? result.data?.code;
  return { qrcode: qr };
}

export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
  linkPreview?: boolean;
}

export async function sendTextMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendTextPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendText/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendMediaPayload {
  number: string;
  mediatype: "image" | "video" | "document";
  mimetype: string;
  caption: string;
  media: string;
  fileName: string;
  delay?: number;
  linkPreview?: boolean;
}

export async function sendMediaMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendMediaPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendWhatsAppAudioPayload {
  number: string;
  audio: string;
  delay?: number;
}

export async function sendWhatsAppAudioMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendWhatsAppAudioPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendWhatsAppAudio/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendStickerPayload {
  number: string;
  sticker: string;
  delay?: number;
}

export async function sendStickerMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendStickerPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendSticker/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendLocationPayload {
  number: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  delay?: number;
}

export async function sendLocationMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendLocationPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendLocation/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface ContactPayloadItem {
  fullName: string;
  wuid?: string;
  phoneNumber?: string;
  organization?: string;
  email?: string;
  url?: string;
}

export interface SendContactPayload {
  number: string;
  contact: ContactPayloadItem[];
}

export async function sendContactMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendContactPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendContact/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendReactionPayload {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  reaction: string;
}

export async function sendReactionMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendReactionPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendReaction/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendPollPayload {
  number: string;
  name: string;
  selectableCount: number;
  values: string[];
  delay?: number;
}

export async function sendPollMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendPollPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendPoll/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export interface SendStatusPayload {
  type: "text" | "image" | "audio";
  content: string;
  caption?: string;
  backgroundColor?: string;
  font?: number;
  allContacts: boolean;
  statusJidList: string[];
}

export async function sendStatusMessage(
  config: EvolutionConfig,
  instanceName: string,
  payload: SendStatusPayload
): Promise<SendResult> {
  const result = await requestJson(config, `/message/sendStatus/${instanceName}`, {
    method: "POST",
    body: payload,
  });

  if (!result.ok) return { success: false, error: toError(result.status, result.text) };
  return { success: true, data: result.data ?? result.text };
}

export async function fetchAllGroups(
  config: EvolutionConfig,
  instanceName: string,
  getParticipants = true
): Promise<{ success: boolean; groups: EvolutionGroup[]; error?: string }> {
  const result = await requestJson<EvolutionGroup[]>(
    config,
    `/group/fetchAllGroups/${instanceName}?getParticipants=${String(getParticipants)}`
  );

  if (!result.ok) {
    return { success: false, groups: [], error: toError(result.status, result.text) };
  }

  return { success: true, groups: result.data ?? [] };
}

export async function findGroupParticipants(
  config: EvolutionConfig,
  instanceName: string,
  groupJid: string
): Promise<{ success: boolean; participants: EvolutionGroupParticipant[]; error?: string }> {
  const encodedJid = encodeURIComponent(groupJid);
  const result = await requestJson<{ participants?: EvolutionGroupParticipant[] }>(
    config,
    `/group/participants/${instanceName}?groupJid=${encodedJid}`
  );

  if (!result.ok) {
    return { success: false, participants: [], error: toError(result.status, result.text) };
  }

  return { success: true, participants: result.data?.participants ?? [] };
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
