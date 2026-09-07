import { error, json } from "./_lib/http.js";
import { readIndexDocumentAsync } from "./_lib/index-store.js";
import { searchIndex } from "./_lib/search.js";

export async function GET(request)
{
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const limit = params.has("limit") ? Number(params.get("limit")) : null;
  if (query.length > 200 || (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 500)))
    return error(400, "Use a query up to 200 characters and a limit from 1 to 500.");
  try { return json(searchIndex(await readIndexDocumentAsync(), query, limit)); }
  catch { return error(503, "The song library is temporarily unavailable. Please try again."); }
}
