import { validateAudioUrlAsync } from "../_lib/audio-url.js";
import { error, json } from "../_lib/http.js";
import { checkSongsAsync } from "../_lib/index-store.js";

export async function GET(request) {
  if (!process.env.CRON_SECRET) return error(503, "CRON_SECRET must be configured.");
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return error(401, "Unauthorized.");
  const result = await checkSongsAsync(async song => Boolean(await validateAudioUrlAsync(song.audioUrl)) && Boolean(await validateRobloxAudioAsync(song.linkedAssetId)));
  return json({ ok: true, ...result.value });
}

async function validateRobloxAudioAsync(assetId) {
  if (!/^\d+$/.test(`${assetId ?? ""}`)) return false;
  const response = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`, { headers: { accept: "application/json" } }).catch(() => null);
  if (!response?.ok) return false;
  const details = await response.json().catch(() => null);
  return details?.AssetTypeId === 3;
}
