"use client";

/**
 * Video guestbook (Premium): records a <=30s clip in-browser via
 * MediaRecorder — no app, no download. Front camera by default (it's a
 * "leave a message" moment, like a wedding guestbook). Uploads through the
 * same /api/events/[slug]/upload route with guestbook=1 so server-side
 * duration/size caps and moderation review still apply.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, RotateCcw, Square, Video as VideoIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/components/analytics-provider";
import { GUESTBOOK_MAX_SECONDS } from "@/lib/tiers";

type Stage = "idle" | "requesting" | "ready" | "recording" | "preview" | "uploading" | "done" | "error";

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "video/webm";
}

export function GuestbookRecorder({
  slug,
  uploaderName,
  deviceKey,
  onDone,
}: {
  slug: string;
  uploaderName: string;
  deviceKey: string;
  onDone: (result: { ok: boolean; needsReview?: boolean }) => void;
}) {
  const analytics = useAnalytics();
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  async function openCamera() {
    setStage("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStage("ready");
    } catch {
      setError("We couldn't access your camera. Check your browser permissions and try again.");
      setStage("error");
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      blobRef.current = new Blob(chunksRef.current, { type: mimeType });
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blobRef.current);
        videoRef.current.controls = true;
        videoRef.current.muted = false;
      }
      stopStream();
      setStage("preview");
    };
    recorderRef.current = recorder;
    recorder.start();
    setStage("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= GUESTBOOK_MAX_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function retake() {
    blobRef.current = null;
    if (videoRef.current) {
      videoRef.current.src = "";
      videoRef.current.controls = false;
    }
    void openCamera();
  }

  async function submit() {
    const blob = blobRef.current;
    if (!blob) return;
    setStage("uploading");
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("file", blob, `guestbook-${Date.now()}.${ext}`);
      if (uploaderName.trim()) fd.append("uploaderName", uploaderName.trim());
      fd.append("uploaderKey", deviceKey);
      fd.append("guestbook", "1");
      const res = await fetch(`/api/events/${slug}/upload`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { message?: string; needsReview?: boolean };
      if (!res.ok) {
        setError(data.message || "That upload didn't go through. Try again.");
        setStage("error");
        return;
      }
      setStage("done");
      analytics.track("guestbook_recorded", { event_id: slug });
      onDone({ ok: true, needsReview: data.needsReview });
    } catch {
      setError("Connection dropped. Try again.");
      setStage("error");
    }
  }

  const remaining = GUESTBOOK_MAX_SECONDS - seconds;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <VideoIcon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg">Leave a video message</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Up to {GUESTBOOK_MAX_SECONDS} seconds — say a few words for the guestbook.
      </p>

      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink">
        {stage === "idle" ? (
          <button
            type="button"
            onClick={() => void openCamera()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/80"
          >
            <VideoIcon className="h-8 w-8" />
            <span className="text-sm">Tap to turn on your camera</span>
          </button>
        ) : null}

        {stage === "requesting" ? (
          <div className="flex h-full w-full items-center justify-center text-white/70 text-sm">
            Asking for camera access…
          </div>
        ) : null}

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          playsInline
          muted={stage !== "preview"}
          className="h-full w-full object-cover"
          style={{ display: stage === "ready" || stage === "recording" || stage === "preview" ? "block" : "none" }}
        />

        {stage === "recording" ? (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white tabular-nums">
            <Circle className="h-2 w-2 animate-pulse fill-destructive text-destructive" />
            0:{String(remaining).padStart(2, "0")}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 flex items-center justify-center gap-2">
        {stage === "ready" ? (
          <Button type="button" size="lg" onClick={startRecording}>
            <Circle className="h-4 w-4 fill-current" /> Start recording
          </Button>
        ) : null}
        {stage === "recording" ? (
          <Button type="button" size="lg" variant="secondary" onClick={stopRecording}>
            <Square className="h-4 w-4" /> Stop
          </Button>
        ) : null}
        {stage === "preview" ? (
          <>
            <Button type="button" variant="outline" onClick={retake}>
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
            <Button type="button" onClick={() => void submit()}>
              Add to guestbook
            </Button>
          </>
        ) : null}
        {stage === "uploading" ? (
          <span className="text-sm text-muted-foreground">Uploading your message…</span>
        ) : null}
        {stage === "error" ? (
          <Button type="button" variant="outline" onClick={() => void openCamera()}>
            Try again
          </Button>
        ) : null}
        {stage === "done" ? (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <VideoIcon className="h-4 w-4" /> Added — thank you
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function GuestbookDismiss({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
