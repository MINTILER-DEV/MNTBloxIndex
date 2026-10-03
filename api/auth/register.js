import { createSession, hashPasswordAsync, normalizeUsername, validatePassword } from "../_lib/auth.js";
import { error, json } from "../_lib/http.js";
import { createAccountAsync } from "../_lib/index-store.js";

export async function POST(request) {
  let body; try { body = await request.json(); } catch { return error(400, "Request body must be valid JSON."); }
  const username = normalizeUsername(body?.username); const password = body?.password;
  if (!username) return error(400, "Username must be 3–32 lowercase letters, numbers, _ or -.");
  if (!validatePassword(password)) return error(400, "Password must be 10–200 characters.");
  const result = await createAccountAsync({ username, passwordHash: await hashPasswordAsync(password), deviceId: `${body?.deviceId ?? ""}`.trim() });
  if (result.conflict) return error(409, "That username is already taken.");
  return json({ token: createSession(result.value.account), account: { username }, migratedCount: result.value.migratedCount }, { status: 201 });
}
