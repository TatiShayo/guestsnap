"use client";

/**
 * AI culling panel (Premium): fetches near-duplicate groups from
 * /api/events/[slug]/culling, shows the sharpest shot pre-selected per
 * group with the rest dimmed. Host can favorite the keeper or hide the
 * rest with one tap — both call the existing moderation endpoints, so
 * culling is a smarter selection UI, not a separate data path.
 */
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Heart, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/components/analytics-provider";
import { cn } from "@/lib/utils";

interface CullItem {
  id: string;
  thumbUrl: string;
  uploaderName: string | null;
}

interface CullGroup {
  bestId: string;
  items: CullItem[];
}

async function patchMedia(slug: string, id: string, action: string) {
  await fetch(`/api/events/${slug}/media/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export function CullingPanel({ slug, enabled }: { slug: string; enabled: boolean }) {
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<CullGroup[] | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || groups !== null) return;
    setLoading(true);
    fetch(`/api/events/${slug}/culling`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { groups: CullGroup[] }) => setGroups(data.groups))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [open, groups, slug]);

  if (!enabled) return null;

  async function keepBest(group: CullGroup) {
    setResolved((prev) => new Set(prev).add(group.bestId + ":group"));
    await patchMedia(slug, group.bestId, "favorite");
    await Promise.all(
      group.items.filter((it) => it.id !== group.bestId).map((it) => patchMedia(slug, it.id, "hide"))
    );
    analytics.track("culling_group_resolved", { event_id: slug });
  }

  const pending = groups?.filter((g) => !resolved.has(g.bestId + ":group")) ?? [];

  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display text-lg">AI best-shot culling</span>
          {groups && groups.length > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
              {pending.length} group{pending.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-border px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning for near-duplicate shots…
            </div>
          ) : pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No duplicate bursts found — every photo looks distinct.
            </p>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                We grouped photos taken in quick succession and picked the sharpest. Keep the best and
                hide the rest with one tap, or review each group yourself.
              </p>
              {pending.map((group) => (
                <div key={group.bestId} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((it) => (
                      <div
                        key={it.id}
                        className={cn(
                          "relative h-20 w-20 overflow-hidden rounded-md border-2",
                          it.id === group.bestId ? "border-primary" : "border-transparent opacity-60"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.thumbUrl} alt="" className="h-full w-full object-cover" />
                        {it.id === group.bestId ? (
                          <span className="absolute bottom-0.5 right-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                            <Sparkles className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button type="button" size="sm" onClick={() => void keepBest(group)}>
                      <Heart className="h-3.5 w-3.5" /> Keep sharpest, hide rest
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} shots · sharpest pre-selected
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
