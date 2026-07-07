"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useAnalytics } from "@/components/analytics-provider";
import { AlbumCapture } from "./album-capture";

type Tier = "free" | "standard" | "premium";

interface Item {
  id: string;
  name: string;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  message?: string;
  needsReview?: boolean;
}

const NAME_KEY = "gs_uploader_name";
const DEVICE_KEY = "gs_uploader_key";

function deviceKey(): string {
  if (typeof window === "undefined") return "";
  let k = localStorage.getItem(DEVICE_KEY);
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, k);
  }
  return k;
}

export function GuestUploader({
  slug,
  eventId,
  remaining,
  unlimited,
  allowGuestbook,
}: {
  slug: string;
  eventId: string;
  remaining: number;
  unlimited: boolean;
  tier: Tier;
  allowGuestbook: boolean;
}) {
  const analytics = useAnalytics();
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [limitHit, setLimitHit] = useState(remaining <= 0 && !unlimited);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneCount = items.filter((i) => i.status === "done").length;

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) || "");
    analytics.track("guest_page_viewed", { event_id: eventId });
  }, [analytics, eventId]);

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  async function compress(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;
    try {
      const mod = await import("browser-image-compression");
      return await mod.default(file, { maxSizeMB: 4, maxWidthOrHeight: 2600, useWebWorker: true });
    } catch {
      return file; // fall back to the original; server caps still apply
    }
  }

  async function uploadOne(item: Item, file: File) {
    update(item.id, { status: "uploading" });
    try {
      const prepared = await compress(file);
      const fd = new FormData();
      fd.append("file", prepared, file.name);
      if (name.trim()) fd.append("uploaderName", name.trim());
      fd.append("uploaderKey", deviceKey());
      const res = await fetch(`/api/events/${slug}/upload`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        needsReview?: boolean;
      };
      if (!res.ok) {
        if (data.error === "upload_limit_reached") {
          setLimitHit(true);
          update(item.id, { status: "error", message: "The album is full." });
          return;
        }
        update(item.id, { status: "error", message: data.message || "Upload failed. Try again." });
        return;
      }
      update(item.id, { status: "done", needsReview: data.needsReview });
    } catch {
      update(item.id, { status: "error", message: "Connection dropped. Try again." });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
    const list = Array.from(files);
    analytics.track("guest_upload_started", { event_id: eventId, file_count: list.length });

    const newItems: { item: Item; file: File }[] = list.map((file) => ({
      item: {
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: "queued" as const,
      },
      file,
    }));
    setItems((prev) => [...newItems.map((n) => n.item), ...prev]);

    // Upload sequentially — keeps mobile connections stable and progress clear.
    for (const { item, file } of newItems) {
      await uploadOne(item, file);
    }
  }

  if (limitHit) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="font-display text-2xl">This album is full</p>
        <p className="mt-2 text-muted-foreground">
          The host is on the free plan, which holds 20 photos. Ask them to upgrade so everyone&apos;s
          photos fit — or leave your email and we&apos;ll send you the album when it&apos;s ready.
        </p>
        <AlbumCapture slug={slug} eventId={eventId} className="mt-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="uploaderName">Your name (optional)</Label>
        <Input
          id="uploaderName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So the host knows who to thank"
          maxLength={60}
          autoComplete="name"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={allowGuestbook ? "image/*,video/*" : "image/*"}
        multiple
        className="sr-only"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-5 w-5" /> Add your photos
      </Button>

      {!unlimited ? (
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {remaining - doneCount > 0
            ? `${Math.max(0, remaining - doneCount)} more can be added to this album`
            : "Album is filling up"}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.previewUrl}
                alt=""
                className="h-full w-full object-cover transition-all duration-700"
                style={{
                  opacity: it.status === "done" ? 1 : 0.45,
                  filter: it.status === "done" ? "none" : "contrast(0.7) brightness(1.15)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {it.status === "uploading" || it.status === "queued" ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : it.status === "done" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="px-1 text-center text-[10px] font-medium text-destructive">
                    {it.message}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
          <Camera className="h-8 w-8 text-primary/70" />
          <p className="mt-3 text-sm">Tap the button to add photos from your phone.</p>
        </div>
      )}

      {doneCount > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-center shadow-soft">
          <p className="font-display text-lg">Thank you</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount === 1 ? "Your photo was added." : `${doneCount} photos added.`}{" "}
            Want the full album when it&apos;s ready?
          </p>
          <AlbumCapture slug={slug} eventId={eventId} className="mt-4" />
          <p className="mt-4 text-xs text-muted-foreground">
            Hosting your own event?{" "}
            <Link href="/" className="underline underline-offset-2">
              Start free
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
