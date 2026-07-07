"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { createEventAction, type CreateEventState } from "./actions";

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday" },
  { value: "funeral", label: "Funeral / memorial" },
  { value: "corporate", label: "Corporate event" },
  { value: "other", label: "Something else" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Creating…" : "Create event"}
    </Button>
  );
}

export function CreateEventForm() {
  const [state, action] = useActionState<CreateEventState, FormData>(createEventAction, null);
  const [coverName, setCoverName] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="title">Event name</Label>
        <Input id="title" name="title" required maxLength={80} placeholder="Emma &amp; Jake's Wedding" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="eventType">Type</Label>
          <Select id="eventType" name="eventType" defaultValue="wedding">
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="eventDate">Date</Label>
          <Input id="eventDate" name="eventDate" type="date" required defaultValue={today} />
        </div>
      </div>

      <div>
        <Label htmlFor="welcomeMessage">Welcome message (optional)</Label>
        <Textarea
          id="welcomeMessage"
          name="welcomeMessage"
          maxLength={300}
          placeholder="Thanks for celebrating with us — share your favorite moments here."
        />
      </div>

      <div>
        <Label htmlFor="cover">Cover photo (optional)</Label>
        <label
          htmlFor="cover"
          className="flex h-11 cursor-pointer items-center rounded-md border border-dashed border-input bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:border-primary"
        >
          {coverName ?? "Choose an image…"}
        </label>
        <input
          id="cover"
          name="cover"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => setCoverName(e.target.files?.[0]?.name ?? null)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          We re-encode every image and strip location data before storing it.
        </p>
      </div>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <SubmitButton />
    </form>
  );
}
