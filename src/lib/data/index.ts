import { dataMode } from "@/lib/config";
import type { BlobStore, DataStore } from "./types";
import { MemoryStore, MemoryBlobStore } from "./memory";
import { SupabaseStore, SupabaseBlobStore } from "./supabase";

let data: DataStore | null = null;
let blobs: BlobStore | null = null;

export function getData(): DataStore {
  if (!data) data = dataMode === "supabase" ? new SupabaseStore() : new MemoryStore();
  return data;
}

export function getBlobs(): BlobStore {
  if (!blobs) blobs = dataMode === "supabase" ? new SupabaseBlobStore() : new MemoryBlobStore();
  return blobs;
}

export * from "./types";
