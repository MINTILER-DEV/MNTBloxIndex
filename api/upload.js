import { validateAudioUrlAsync } from "./_lib/audio-url.js";
import { error, json } from "./_lib/http.js";
import { createSongAsync } from "./_lib/index-store.js";
import { requireSession } from "./_lib/auth.js";
import { consumeRateLimit } from "./_lib/rate-limit.js";

export async function POST(request)
{
  let body;

  try
  {
    body = await request.json();
  }
  catch
  {
    return error(400, "Request body must be valid JSON.");
  }

  const linkedAssetId = `${body?.linkedAssetId ?? ""}`.trim().replace(/^rbxassetid:\/\//i, "");
  const audioUrl = `${body?.audioUrl ?? ""}`.trim();
  const songName = `${body?.songName ?? ""}`.trim();
  const artist = `${body?.artist ?? ""}`.trim();
  const uploaderName = `${body?.uploaderName ?? ""}`.trim();
  const auth = requireSession(request);
  if (auth.response) return auth.response;

  if (!linkedAssetId || !audioUrl || !songName || !artist)
  {
    return error(400, "linkedAssetId, audioUrl, songName, and artist are required.");
  }

  if (!/^\d+$/.test(linkedAssetId))
  {
    return error(400, "Linked Roblox sound ID must contain digits only.");
  }

  const normalizedAudioUrl = await validateAudioUrlAsync(audioUrl);
  if (!normalizedAudioUrl)
  {
    return error(400, "The provided URL did not look like a direct audio file.");
  }

  const result = await createSongAsync({
    linkedAssetId,
    audioUrl: normalizedAudioUrl,
    songName,
    artist,
    uploaderName,
    accountId: auth.session.sub,
    consumeRateLimit: index => consumeRateLimit(index, `add:${auth.session.sub}`, 2, 60_000)
  });

  if (result.response) return result.response;

  return json(result.value, { status: 201 });
}
