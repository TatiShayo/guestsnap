"use client";

/**
 * THE signature interaction (PLAYBOOK 1.4): cinematic crossfades with slow
 * Ken Burns drift, uploader name set in italic Fraunces, new arrivals enter
 * with a gentle scale-settle. Built to run on a TV at a real wedding — 60fps
 * or it doesn't ship. Polls the gallery feed (works with zero keys / memory
 * mode); the interface is identical to what a Supabase Realtime subscription
 * would drive, so swapping in true push later is a one-file change.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAnalytics } from "@/components/analytics-provider";

interface MediaItem {
  id: string;
  type: "photo" | "video";
  url: string;
  thumbUrl: string;
  uploaderName: string | null;
  createdAt: string;
}

const POLL_MS = 4000;
const SLIDE_MS = 6500;
const KEN_BURNS_VARIANTS = [
  { from: "scale(1) translate(0,0)", to: "scale(1.08) translate(-1%,-1%)" },
  { from: "scale(1.06) translate(1%,0)", to: "scale(1) translate(0,-1%)" },
  { from: "scale(1) translate(0,1%)", to: "scale(1.08) translate(1%,0)" },
];

export function LiveSlideshow({
  slug,
  title,
  brandColor,
  watermark,
  pinToken,
}: {
  slug: string;
  title: string;
  brandColor: string | null;
  watermark: boolean;
  pinToken?: string;
}) {
  const analytics = useAnalytics();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);
  const [presenceCount] = useState<number | null>(null);
  const sinceRef = useRef<string | null>(null);
  const kenBurnsIndex = useRef(0);

  useEffect(() => {
    analytics.track("slideshow_viewed", { event_id: slug });
  }, [analytics, slug]);

  // Poll for new arrivals (and initial load). New photos are prepended so
  // they show next, without disrupting the photo currently on screen.
  useEffect(() => {
    let cancelled = false;

    async function fetchFeed() {
      const qs = new URLSearchParams();
      if (pinToken) qs.set("pin_token", pinToken);
      if (sinceRef.current) qs.set("since", sinceRef.current);
      try {
        const res = await fetch(`/api/events/${slug}/gallery?${qs.toString()}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { media: MediaItem[]; serverTime: string };
        sinceRef.current = data.serverTime;
        if (data.media.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = data.media.filter((m) => !existingIds.has(m.id));
            return [...fresh.reverse(), ...prev]; // oldest-of-the-new-batch first
          });
        }
      } catch {
        // transient network blip — next poll retries
      }
    }

    void fetchFeed();
    const interval = setInterval(fetchFeed, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug, pinToken]);

  // Auto-advance.
  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, items.length]);

  const current = items[index] ?? null;
  kenBurnsIndex.current = (kenBurnsIndex.current + 1) % KEN_BURNS_VARIANTS.length;
  const kb = KEN_BURNS_VARIANTS[index % KEN_BURNS_VARIANTS.length];

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-ink">
      <AnimatePresence mode="sync">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {current.type === "video" ? (
              <video
                src={current.url}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full bg-cover bg-center will-change-transform"
                style={{
                  backgroundImage: `url(${current.url})`,
                  animation: `gs-kenburns ${SLIDE_MS + 800}ms ease-out forwards`,
                  // @ts-expect-error -- custom props read by the keyframe below
                  "--kb-from": kb.from,
                  "--kb-to": kb.to,
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

            {current.uploaderName ? (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="absolute bottom-10 left-0 right-0 text-center font-display text-2xl italic text-white/90 drop-shadow-lg sm:text-3xl"
              >
                {current.uploaderName}
              </motion.p>
            ) : null}
          </motion.div>
        ) : (
          <EmptyStage title={title} />
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes gs-kenburns {
          from {
            transform: var(--kb-from);
          }
          to {
            transform: var(--kb-to);
          }
        }
      `}</style>

      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-3 text-white/80">
        <span className="font-display text-lg tracking-tight">{title}</span>
        {presenceCount ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs tabular-nums">
            {presenceCount} watching
          </span>
        ) : null}
      </div>

      {watermark ? (
        <div className="pointer-events-none absolute bottom-6 right-6 text-xs tracking-wide text-white/50">
          Powered by GuestSnap
        </div>
      ) : null}

      {items.length > 1 ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.slice(0, 12).map((it, i) => (
            <span
              key={it.id}
              className="h-1 w-4 rounded-full transition-colors"
              style={{ backgroundColor: i === index % Math.min(items.length, 12) ? (brandColor ?? "#fff") : "rgba(255,255,255,0.25)" }}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}

function EmptyStage({ title }: { title: string }) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center text-center text-white/70"
    >
      <p className="font-display text-3xl text-white">{title}</p>
      <p className="mt-3 max-w-sm text-white/60">
        Waiting for the first photo. Scan the QR code to add yours — it&apos;ll appear here in seconds.
      </p>
    </motion.div>
  );
}
