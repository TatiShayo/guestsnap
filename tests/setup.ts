/**
 * Runs before every vitest test file. Points the memory data/blob store at a
 * throwaway temp directory so security/integration tests never read or
 * write the real project .data/ (dev sessions, seeded demo event, etc).
 */
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guestsnap-test-"));
process.env.GUESTSNAP_DATA_DIR = dir;
process.env.APP_SECRET = process.env.APP_SECRET || "test-secret-do-not-use-in-prod";
process.env.ADMIN_EMAILS = "admin@example.com,ops@example.com";
