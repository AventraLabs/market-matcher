import "server-only";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Local disk in dev (zero setup), Supabase Storage in prod once configured.
// Vercel's filesystem is ephemeral/read-only outside /tmp, so the local
// adapter is dev-only — see README for the Supabase Storage setup.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "public-media";

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const VIDEO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_EXTENSION_BY_MIME_TYPE);
export const ALLOWED_VIDEO_TYPES = Object.keys(VIDEO_EXTENSION_BY_MIME_TYPE);

export function uploadImage(file: File, folder: string): Promise<{ url: string }> {
  return uploadFile(file, folder, IMAGE_EXTENSION_BY_MIME_TYPE);
}

export function uploadVideo(file: File, folder: string): Promise<{ url: string }> {
  return uploadFile(file, folder, VIDEO_EXTENSION_BY_MIME_TYPE);
}

async function uploadFile(
  file: File,
  folder: string,
  extensionByMimeType: Record<string, string>,
): Promise<{ url: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = extensionByMimeType[file.type] ?? "bin";
  const key = `${folder}/${randomUUID()}.${extension}`;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    return uploadToSupabase(key, bytes, file.type);
  }
  return uploadToLocalDisk(key, bytes);
}

async function uploadToLocalDisk(key: string, bytes: Buffer): Promise<{ url: string }> {
  const filePath = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return { url: `/uploads/${key}` };
}

async function uploadToSupabase(key: string, bytes: Buffer, contentType: string): Promise<{ url: string }> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(`Supabase Storage upload failed: ${res.status} ${await res.text()}`);
  }
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}` };
}
