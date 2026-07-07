/**
 * Event slug generator: human-readable + random 4-char suffix so slugs
 * can't be enumerated (`emma-and-jake-x7k2`).
 */
const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no confusable chars

export function randomSuffix(len = 4): string {
  let out = "";
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  return out;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function generateEventSlug(title: string): string {
  const base = slugify(title) || "event";
  return `${base}-${randomSuffix()}`;
}
