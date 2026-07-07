/**
 * Route-handler helpers: consistent JSON errors (generic to clients — details
 * go to monitoring), zod parsing, and host-ownership checks used by every
 * host-scoped API route (object-level authorization, PLAYBOOK 2.4).
 */
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AuthError, requireUser, type SessionUser } from "@/lib/auth";
import { getData, type EventRecord } from "@/lib/data";
import { captureError } from "@/lib/monitoring";

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Wrap a handler: auth errors → 401, ApiError → its status, rest → generic 500. */
export function withErrorHandling<Args extends unknown[]>(
  where: string,
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof AuthError) return jsonError(401, "unauthorized");
      if (e instanceof ApiError) return jsonError(e.status, e.code);
      captureError(e, { where });
      return jsonError(500, "something_went_wrong");
    }
  };
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "invalid_request");
  return parsed.data;
}

/** Re-validates session AND object-level ownership of the event. */
export async function requireEventOwner(eventId: string): Promise<{ user: SessionUser; event: EventRecord }> {
  const user = await requireUser();
  const event = await getData().getEvent(eventId);
  if (!event || event.hostId !== user.id) throw new ApiError(404, "not_found");
  return { user, event };
}
