import { requireSession } from "../_lib/auth.js";
import { json } from "../_lib/http.js";
export async function GET(request) { const auth = requireSession(request); return auth.response ?? json({ account: { username: auth.session.username } }); }
