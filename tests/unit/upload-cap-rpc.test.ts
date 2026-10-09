import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The per-event upload cap must be enforced atomically. The store used to do
 * insert-then-verify, which races under concurrent guest uploads; the fix
 * delegates to the insert_media_within_limit SQL function (migration 0002).
 */
const { mockRpc, mockInsert } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: () => ({
      insert: () => ({ select: () => ({ single: mockInsert }) }),
    }),
  }),
}));

import { SupabaseStore } from "@/lib/data/supabase";
import type { MediaRecord } from "@/lib/data/types";

function makeMedia(eventId: string): Omit<MediaRecord, "id" | "createdAt"> {
  return {
    eventId,
    storagePath: `${eventId}/photo.jpg`,
    thumbPath: null,
    type: "photo",
    uploaderName: "Guest",
    uploaderKey: "device-1",
    phash: null,
    sharpness: null,
    isHidden: false,
    isFavorite: false,
    needsReview: false,
    flagReason: null,
    reportCount: 0,
    isGuestbook: false,
    width: 100,
    height: 100,
    durationSec: null,
    sizeBytes: 1024,
  };
}

describe("SupabaseStore.insertMediaWithinLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates the capped insert to the atomic RPC", async () => {
    mockRpc.mockResolvedValue({
      data: { id: "media-1", event_id: "evt-1", storage_path: "evt-1/photo.jpg", type: "photo" },
      error: null,
    });

    const store = new SupabaseStore();
    const rec = await store.insertMediaWithinLimit(makeMedia("evt-1"), 20);

    expect(mockRpc).toHaveBeenCalledWith("insert_media_within_limit", {
      p_event_id: "evt-1",
      p_limit: 20,
      p_row: expect.objectContaining({ event_id: "evt-1", storage_path: "evt-1/photo.jpg" }),
    });
    expect(rec?.id).toBe("media-1");
    // The old path inserted first and compensated afterwards — no direct insert.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns null (cap reached) when the RPC reports no row", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const store = new SupabaseStore();
    const rec = await store.insertMediaWithinLimit(makeMedia("evt-1"), 20);

    expect(rec).toBeNull();
  });

  it("skips the cap check for unlimited tiers", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "media-2", event_id: "evt-1", storage_path: "evt-1/photo.jpg", type: "photo" },
      error: null,
    });

    const store = new SupabaseStore();
    const rec = await store.insertMediaWithinLimit(makeMedia("evt-1"), Number.MAX_SAFE_INTEGER);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(rec?.id).toBe("media-2");
  });

  it("rejects non-positive limits outright", async () => {
    const store = new SupabaseStore();
    expect(await store.insertMediaWithinLimit(makeMedia("evt-1"), 0)).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
