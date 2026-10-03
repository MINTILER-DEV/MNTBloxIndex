const SESSION_KEY = "mntbloxindex.session";
export function getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
export function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch {} }
export async function authenticate(mode, username, password, deviceId) {
  const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, deviceId }) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || "Authentication failed.");
  const session = { token: body.token, username: body.account.username }; try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
  return { ...session, migratedCount: body.migratedCount ?? 0 };
}
