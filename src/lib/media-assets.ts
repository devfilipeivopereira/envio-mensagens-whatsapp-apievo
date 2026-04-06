import { getSupabaseClient } from "@/lib/supabase";
import { MediaAsset } from "@/types/messaging";

const ASSET_TABLE = "app_media_assets";
const BUCKET_NAME = "media-assets";

interface MediaAssetRow {
  id: string;
  instance_name: string;
  media_kind: "image" | "audio" | "video" | "document" | "sticker" | "other";
  bucket: string;
  path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  original_file_name: string | null;
  created_at: string;
}

function mapRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    instanceName: row.instance_name,
    mediaKind: row.media_kind,
    bucket: row.bucket,
    path: row.path,
    publicUrl: row.public_url,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    originalFileName: row.original_file_name ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listMediaAssets(instanceName: string): Promise<MediaAsset[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(ASSET_TABLE)
    .select("*")
    .eq("instance_name", instanceName)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to list media assets:", error?.message);
    return [];
  }

  return (data as MediaAssetRow[]).map(mapRow);
}

function inferMediaKind(file: File): MediaAsset["mediaKind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "image/webp") return "sticker";
  if (file.type) return "document";
  return "other";
}

export async function uploadMediaAsset(instanceName: string, file: File): Promise<{ success: boolean; asset?: MediaAsset; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Supabase não configurado." };
  }

  const randomPart = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${instanceName}/${Date.now()}-${randomPart}-${sanitizedName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  const row = {
    instance_name: instanceName,
    media_kind: inferMediaKind(file),
    bucket: BUCKET_NAME,
    path,
    public_url: publicUrl,
    mime_type: file.type || null,
    size_bytes: file.size,
    original_file_name: file.name,
  };

  const { data, error: insertError } = await supabase.from(ASSET_TABLE).insert(row).select("*").single();

  if (insertError || !data) {
    console.error("Failed to persist media asset metadata:", insertError?.message);
    return { success: false, error: insertError?.message ?? "Failed to save asset metadata" };
  }

  return { success: true, asset: mapRow(data as MediaAssetRow) };
}

export async function deleteMediaAsset(asset: MediaAsset): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase não configurado." };

  const { error: removeStorageError } = await supabase.storage.from(asset.bucket).remove([asset.path]);
  if (removeStorageError) {
    return { success: false, error: removeStorageError.message };
  }

  const { error: deleteRowError } = await supabase.from(ASSET_TABLE).delete().eq("id", asset.id);
  if (deleteRowError) {
    return { success: false, error: deleteRowError.message };
  }

  return { success: true };
}
