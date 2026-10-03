import { requireSession } from "./_lib/auth.js";
import { error, json } from "./_lib/http.js";
import { findSongsByAccountAsync } from "./_lib/index-store.js";
export async function GET(request) { const auth = requireSession(request); if (auth.response) return auth.response; try { return json({ songs: await findSongsByAccountAsync(auth.session.sub) }); } catch { return error(503, "Your submissions are temporarily unavailable."); } }
