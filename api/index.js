import { json } from "./_lib/http.js";
import { readIndexDocumentAsync } from "./_lib/index-store.js";

export async function GET()
{
  return json(await readIndexDocumentAsync());
}
