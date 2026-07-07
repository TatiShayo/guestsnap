"use client";

/**
 * Moderation + privacy settings (PLAYBOOK content-safety / privacy
 * requirements): approve-before-visible toggle, gallery visibility,
 * hide-uploader-names, and the slideshow PIN. All changes PATCH
 * /api/events/[slug]/settings (host-owner-checked); optimistic with
 * rollback on failure, consistent with the rest of the dashboard.
 */
import { useState } from "react";
import { ChevronDown, Lock, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { EventVisibility } from "@/lib/data";

interface SettingsState {
  requireApproval: boolean;
  visibility: EventVisibility;
  hideUploaderNames: boolean;
  hasPinSet: boolean;
}

async function patchSettings(slug: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/events/${slug}/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function SettingsPanel({
  slug,
  initial,
}: {
  slug: string;
  initial: SettingsState;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initial);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  async function toggle(key: "requireApproval" | "hideUploaderNames") {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const ok = await patchSettings(slug, { [key]: next });
    if (!ok) setState((s) => ({ ...s, [key]: !next }));
  }

  async function changeVisibility(visibility: EventVisibility) {
    const prev = state.visibility;
    setState((s) => ({ ...s, visibility }));
    const ok = await patchSettings(slug, { visibility });
    if (!ok) setState((s) => ({ ...s, visibility: prev }));
  }

  async function savePin() {
    if (pin.length !== 4) return;
    setPinBusy(true);
    setPinMessage(null);
    const ok = await patchSettings(slug, { slideshowPin: pin });
    setPinBusy(false);
    if (ok) {
      setState((s) => ({ ...s, hasPinSet: true }));
      setPin("");
      setPinMessage("PIN saved.");
    } else {
      setPinMessage("Couldn't save the PIN — try again.");
    }
  }

  async function clearPin() {
    setPinBusy(true);
    setPinMessage(null);
    const ok = await patchSettings(slug, { slideshowPin: "" });
    setPinBusy(false);
    if (ok) {
      setState((s) => ({ ...s, hasPinSet: false }));
      setPinMessage("PIN removed — slideshow is open to anyone with the link.");
    } else {
      setPinMessage("Couldn't remove the PIN — try again.");
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-display text-lg">Moderation & privacy</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-6 border-t border-border px-6 py-5">
          <ToggleRow
            label="Approve uploads before they appear"
            hint="New photos and videos wait in Needs review until you approve them."
            checked={state.requireApproval}
            onChange={() => void toggle("requireApproval")}
          />

          <ToggleRow
            label="Hide uploader names"
            hint="Names won't show under photos or in the live slideshow."
            checked={state.hideUploaderNames}
            onChange={() => void toggle("hideUploaderNames")}
          />

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" /> Who can see the gallery
            </label>
            <Select
              value={state.visibility}
              onChange={(e) => void changeVisibility(e.target.value as EventVisibility)}
              className="mt-2 max-w-xs"
            >
              <option value="gallery">Everyone with the link sees the full gallery</option>
              <option value="own">Guests see only their own uploads</option>
              <option value="host">Only you can see the gallery</option>
            </Select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-muted-foreground" /> Slideshow PIN
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.hasPinSet
                ? "A 4-digit PIN is required to view the live slideshow."
                : "Optional — add a 4-digit PIN so only people at the event can view the slideshow."}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className="h-10 w-24 rounded-md border border-input bg-card px-3 text-center text-lg tracking-[0.3em] tabular-nums shadow-sm focus-visible:border-primary focus-visible:outline-none"
              />
              <Button type="button" size="sm" disabled={pin.length !== 4 || pinBusy} onClick={() => void savePin()}>
                {state.hasPinSet ? "Change PIN" : "Set PIN"}
              </Button>
              {state.hasPinSet ? (
                <Button type="button" size="sm" variant="outline" disabled={pinBusy} onClick={() => void clearPin()}>
                  Remove
                </Button>
              ) : null}
            </div>
            {pinMessage ? <p className="mt-2 text-xs text-muted-foreground">{pinMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
