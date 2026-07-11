/**
 * ZIP export of an event's original media. Standard+ only.
 *
 * Security (BUILD_PROMPT + PLAYBOOK 2.4):
 * - Authorizes the host session server-side and re-checks object ownership by
 *   slug — never trusts a client-supplied id.
 * - Streams straight from the blob store through `archiver`; writes NO temp
 *   files to any public path.
 * - Reads originals via the server-side blob store (not signed URLs), so the
 *   private bucket is never exposed.
 */
import { PassThrough, Readable } from "stream";
import archiver from "archiver";
import { getCurrentUser } from "@/lib/auth";
import { getBlobs, getData } from "@/lib/data";
import { TIERS } from "@/lib/tiers";
import { serverTrack } from "@/lib/analytics-server";
import { captureError } from "@/lib/monitoring";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized");

  const data = getData();
  const event = await data.getEventBySlug(slug);
  // Object-level authorization: 404 (not 403) so we don't confirm existence.
  if (!event || event.hostId !== user.id) return jsonError(404, "not_found");

  const spec = TIERS[event.tier];
  if (!spec.zipDownload) {
    return jsonError(403, "upgrade_required");
  }

  // Include everything the host owns EXCEPT items still awaiting review — the
  // export is the "finished album", so hidden/needs-review are left out.
  const media = (await data.listMedia(event.id, { includeHidden: true })).filter(
    (m) => !m.isHidden && !m.needsReview
  );
  if (media.length === 0) return jsonError(404, "nothing_to_export");

  const blobs = getBlobs();
  const archive = archiver("zip", { zlib: { level: 6 } });
  const pass = new PassThrough();
  archive.on("warning", (err) => captureError(err, { where: "events.zip.warning" }));
  archive.on("error", (err) => {
    captureError(err, { where: "events.zip.archive" });
    pass.destroy(err);
  });
  archive.pipe(pass);

  // Append originals as we go; names are stable and collision-free.
  (async () => {
    try {
      let i = 0;
      const pad = String(media.length).length;
      for (const m of media) {
        i += 1;
        const blob = await blobs.get(m.storagePath);
        if (!blob) continue;
        const ext = m.type === "video" ? "mp4" : "jpg";
        const seq = String(i).padStart(pad, "0");
        const uploader = m.uploaderName ? safeName(m.uploaderName, "guest") : "guest";
        const folder = m.isGuestbook ? "guestbook" : "photos";
        archive.append(blob.data, { name: `${folder}/${seq}-${uploader}.${ext}` });
      }
      await archive.finalize();
    } catch (e) {
      captureError(e, { where: "events.zip.stream" });
      pass.destroy(e instanceof Error ? e : new Error("zip_failed"));
    }
  })();

  await serverTrack(user.id, "zip_downloaded", { event_id: event.id });

  const filename = `${safeName(event.slug, "guestsnap")}-photos.zip`;
  // Convert the Node stream to a real web ReadableStream for the Response
  // body — passing the Node stream directly (even cast) never pumps data
  // through Next's Response and the request hangs forever.
  return new Response(Readable.toWeb(pass) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
