"use client";

/**
 * Host moderation grid: lazy-loaded tiles (native `loading="lazy"` + a
 * paged "load more" so large events don't render thousands of DOM nodes at
 * once), hide/delete/favorite, filter by uploader, bulk select. Every
 * mutation calls the object-owner-checked API routes; state updates
 * optimistically then reconciles on error (PLAYBOOK 1.4).
 */
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckSquare, Eye, EyeOff, Heart, Loader2, ShieldAlert, Square, Trash2, Video, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import type { MediaView } from "@/lib/media";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

type Filter = "all" | "needs_review" | "hidden" | "favorites" | "guestbook";

async function callAction(slug: string, id: string, action: string): Promise<boolean> {
  const res = await fetch(`/api/events/${slug}/media/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return res.ok;
}

async function callDelete(slug: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/events/${slug}/media/${id}`, { method: "DELETE" });
  return res.ok;
}

async function callBulk(slug: string, ids: string[], action: string): Promise<boolean> {
  const res = await fetch(`/api/events/${slug}/media/bulk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, action }),
  });
  return res.ok;
}

export function GalleryGrid({
  slug,
  initialMedia,
  hideUploaderNames,
}: {
  slug: string;
  initialMedia: MediaView[];
  hideUploaderNames: boolean;
}) {
  const [items, setItems] = useState(initialMedia);
  const [filter, setFilter] = useState<Filter>("all");
  const [uploader, setUploader] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const uploaders = useMemo(() => {
    const names = new Set<string>();
    for (const m of items) if (m.uploaderName) names.add(m.uploaderName);
    return [...names].sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((m) => {
      if (filter === "needs_review" && !m.needsReview) return false;
      if (filter === "hidden" && !m.isHidden) return false;
      if (filter === "favorites" && !m.isFavorite) return false;
      if (filter === "guestbook" && !m.isGuestbook) return false;
      if (filter === "all" && m.isHidden) return false; // hidden tucked away unless explicitly filtered
      if (uploader !== "all" && m.uploaderName !== uploader) return false;
      return true;
    });
  }, [items, filter, uploader]);

  const visible = filtered.slice(0, visibleCount);
  const needsReviewCount = items.filter((m) => m.needsReview).length;

  function patchLocal(id: string, patch: Partial<MediaView>) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function withBusy(id: string, fn: () => Promise<void>) {
    setBusy((prev) => new Set(prev).add(id));
    fn().finally(() => {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  function toggleHide(m: MediaView) {
    const next = !m.isHidden;
    patchLocal(m.id, { isHidden: next }); // optimistic
    withBusy(m.id, async () => {
      const ok = await callAction(slug, m.id, next ? "hide" : "show");
      if (!ok) patchLocal(m.id, { isHidden: m.isHidden });
    });
  }

  function toggleFavorite(m: MediaView) {
    const next = !m.isFavorite;
    patchLocal(m.id, { isFavorite: next });
    withBusy(m.id, async () => {
      const ok = await callAction(slug, m.id, next ? "favorite" : "unfavorite");
      if (!ok) patchLocal(m.id, { isFavorite: m.isFavorite });
    });
  }

  function approve(m: MediaView) {
    patchLocal(m.id, { needsReview: false });
    withBusy(m.id, async () => {
      const ok = await callAction(slug, m.id, "approve");
      if (!ok) patchLocal(m.id, { needsReview: true });
    });
  }

  function remove(m: MediaView) {
    if (!confirm("Delete this permanently? This can't be undone.")) return;
    const prevItems = items;
    setItems((prev) => prev.filter((x) => x.id !== m.id));
    withBusy(m.id, async () => {
      const ok = await callDelete(slug, m.id);
      if (!ok) setItems(prevItems);
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: "hide" | "show" | "favorite" | "approve" | "delete") {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} item(s) permanently?`)) return;
    const ok = await callBulk(slug, ids, action);
    if (!ok) return;
    if (action === "delete") {
      setItems((prev) => prev.filter((m) => !ids.includes(m.id)));
    } else {
      setItems((prev) =>
        prev.map((m) =>
          ids.includes(m.id)
            ? {
                ...m,
                ...(action === "hide" ? { isHidden: true } : {}),
                ...(action === "show" ? { isHidden: false } : {}),
                ...(action === "favorite" ? { isFavorite: true } : {}),
                ...(action === "approve" ? { needsReview: false } : {}),
              }
            : m
        )
      );
    }
    setSelected(new Set());
  }

  const lightboxItem = items.find((m) => m.id === lightbox) ?? null;

  return (
    <div className="mt-8">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip
          label={`Needs review${needsReviewCount ? ` (${needsReviewCount})` : ""}`}
          active={filter === "needs_review"}
          onClick={() => setFilter("needs_review")}
          alert={needsReviewCount > 0}
        />
        <FilterChip label="Favorites" active={filter === "favorites"} onClick={() => setFilter("favorites")} />
        <FilterChip label="Hidden" active={filter === "hidden"} onClick={() => setFilter("hidden")} />
        <FilterChip label="Guestbook" active={filter === "guestbook"} onClick={() => setFilter("guestbook")} />

        {uploaders.length > 0 ? (
          <Select
            value={uploader}
            onChange={(e) => setUploader(e.target.value)}
            className="ml-auto h-9 w-auto max-w-[180px] text-sm"
            aria-label="Filter by uploader"
          >
            <option value="all">Everyone</option>
            {uploaders.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        ) : null}

        <Button
          type="button"
          variant={selectMode ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
        >
          {selectMode ? "Cancel" : "Select"}
        </Button>
      </div>

      {/* Bulk toolbar */}
      {selectMode && selected.size > 0 ? (
        <div className="sticky top-2 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-soft">
          <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void bulk("approve")}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void bulk("favorite")}>
              Favorite
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void bulk("hide")}>
              Hide
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void bulk("show")}>
              Unhide
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => void bulk("delete")}>
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyGrid filter={filter} />
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((m) => (
              <li key={m.id} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-all",
                    m.isHidden ? "border-border opacity-50" : "border-border",
                    selected.has(m.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => (selectMode ? toggleSelect(m.id) : setLightbox(m.id))}
                >
                  <Image
                    src={m.thumbUrl}
                    alt=""
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    unoptimized
                  />
                  {m.type === "video" ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white">
                      <Video className="h-3 w-3" />
                    </span>
                  ) : null}
                  {m.needsReview ? (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      <ShieldAlert className="h-3 w-3" /> Review
                    </span>
                  ) : null}
                  {m.isFavorite ? (
                    <span className="absolute bottom-1.5 right-1.5 text-primary drop-shadow">
                      <Heart className="h-4 w-4 fill-current" />
                    </span>
                  ) : null}
                  {selectMode ? (
                    <span className="absolute left-1.5 bottom-1.5 rounded-full bg-black/50 p-0.5 text-white">
                      {selected.has(m.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </span>
                  ) : null}
                  {busy.has(m.id) ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </span>
                  ) : null}
                </button>

                {!hideUploaderNames && m.uploaderName ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{m.uploaderName}</p>
                ) : null}

                {!selectMode ? (
                  <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {m.needsReview ? (
                      <IconBtn label="Approve" onClick={() => approve(m)}>
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </IconBtn>
                    ) : null}
                    <IconBtn label={m.isFavorite ? "Unfavorite" : "Favorite"} onClick={() => toggleFavorite(m)}>
                      <Heart className={cn("h-3.5 w-3.5", m.isFavorite && "fill-current text-primary")} />
                    </IconBtn>
                    <IconBtn label={m.isHidden ? "Show" : "Hide"} onClick={() => toggleHide(m)}>
                      {m.isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => remove(m)} destructive>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {filtered.length > visible.length ? (
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="outline" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
                Load more ({filtered.length - visible.length} left)
              </Button>
            </div>
          ) : null}
        </>
      )}

      {lightboxItem ? (
        <Lightbox
          item={lightboxItem}
          hideUploaderNames={hideUploaderNames}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  alert,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  alert?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : alert
            ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card transition-colors hover:bg-accent",
        destructive && "hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

function EmptyGrid({ filter }: { filter: Filter }) {
  const copy: Record<Filter, string> = {
    all: "No photos yet. Share the QR code and they'll land here within seconds.",
    needs_review: "Nothing waiting on you. Flagged or reported uploads will show up here.",
    hidden: "Nothing hidden.",
    favorites: "No favorites yet — hover a photo and tap the heart.",
    guestbook: "No guestbook clips yet.",
  };
  return (
    <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-primary/60" aria-hidden>
        <rect x="8" y="14" width="48" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="22" cy="26" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 46l14-12 9 7 8-6 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <p className="mt-4 max-w-xs text-sm">{copy[filter]}</p>
    </div>
  );
}

function Lightbox({
  item,
  hideUploaderNames,
  onClose,
}: {
  item: MediaView;
  hideUploaderNames: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-h-[85vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {item.type === "video" ? (
          <video src={item.url} controls autoPlay className="max-h-[85vh] w-full rounded-lg" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />
        )}
        {!hideUploaderNames && item.uploaderName ? (
          <p className="mt-3 text-center font-display italic text-white/90">{item.uploaderName}</p>
        ) : null}
      </div>
    </div>
  );
}
