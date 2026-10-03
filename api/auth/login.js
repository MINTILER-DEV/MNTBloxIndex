import { createSession, normalizeUsername, verifyPasswordAsync } from "../_lib/auth.js";
import { error, json } from "../_lib/http.js";
import { findAccountByUsernameAsync, migrateDeviceSongsAsync } from "../_lib/index-store.js";

export async function POST(request) {
  let body; try { body = await request.json(); } catch { return error(400, "Request body must be valid JSON."); }
  const account = await findAccountByUsernameAsync(normalizeUsername(body?.username));
  if (!account || !await verifyPasswordAsync(body?.password ?? "", account.passwordHash)) return error(401, "Invalid username or password.");
  const migration = await migrateDeviceSongsAsync(account.id, `${body?.deviceId ?? ""}`.trim());
  return json({ token: createSession(account), account: { username: account.username }, migratedCount: migration.value });
}
