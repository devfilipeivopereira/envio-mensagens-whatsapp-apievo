import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase";

const STATE_BUCKET = "whatsapp-runtime";

let bucketReadyPromise: Promise<void> | null = null;

function isMissingObjectError(error: { message?: string; statusCode?: string | number } | null) {
  if (!error) {
    return false;
  }

  const message = String(error.message ?? "").toLowerCase();
  const statusCode = String(error.statusCode ?? "");

  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("object not found") ||
    statusCode === "404" ||
    statusCode === "400"
  );
}

export async function ensureStateBucket() {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const supabase = createSupabaseAdminClient();
      const listed = await supabase.storage.listBuckets();

      if (listed.error) {
        throw new Error(`Falha ao listar buckets do Supabase Storage: ${listed.error.message}`);
      }

      const exists = listed.data?.some((bucket) => bucket.id === STATE_BUCKET);

      if (exists) {
        return;
      }

      const created = await supabase.storage.createBucket(STATE_BUCKET, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["application/json"],
      });

      if (created.error && !String(created.error.message).toLowerCase().includes("already exists")) {
        throw new Error(`Falha ao criar bucket de runtime: ${created.error.message}`);
      }
    })();
  }

  await bucketReadyPromise;
}

export async function readStateJson<T>(path: string, fallback: T): Promise<T> {
  await ensureStateBucket();
  const supabase = createSupabaseAdminClient();
  const downloaded = await supabase.storage.from(STATE_BUCKET).download(path);

  if (downloaded.error) {
    if (isMissingObjectError(downloaded.error)) {
      return fallback;
    }

    throw new Error(`Falha ao ler estado persistido (${path}): ${downloaded.error.message}`);
  }

  const text = await downloaded.data.text();

  if (!text.trim()) {
    return fallback;
  }

  return JSON.parse(text) as T;
}

export async function writeStateJson(path: string, value: unknown) {
  await ensureStateBucket();
  const supabase = createSupabaseAdminClient();
  const body = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });

  const uploaded = await supabase.storage.from(STATE_BUCKET).upload(path, body, {
    upsert: true,
    contentType: "application/json",
  });

  if (uploaded.error) {
    throw new Error(`Falha ao salvar estado persistido (${path}): ${uploaded.error.message}`);
  }
}

export async function removeStateFile(path: string) {
  await ensureStateBucket();
  const supabase = createSupabaseAdminClient();
  const removed = await supabase.storage.from(STATE_BUCKET).remove([path]);

  if (removed.error && !isMissingObjectError(removed.error)) {
    throw new Error(`Falha ao remover estado persistido (${path}): ${removed.error.message}`);
  }
}
