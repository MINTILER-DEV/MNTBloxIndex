import { validateAudioUrlAsync } from "./_lib/audio-url.js";
import { error, json } from "./_lib/http.js";
import { createSongAsync } from "./_lib/index-store.js";

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

  const audioUrl = `${body?.audioUrl ?? ""}`.trim();
  const songName = `${body?.songName ?? ""}`.trim();
  const artist = `${body?.artist ?? ""}`.trim();
  const uploaderName = `${body?.uploaderName ?? ""}`.trim();
  const deviceId = `${body?.deviceId ?? ""}`.trim();

  if (!audioUrl || !songName || !artist || !deviceId)
  {
    return error(400, "audioUrl, songName, artist, and deviceId are required.");
  }

  const normalizedAudioUrl = await validateAudioUrlAsync(audioUrl);
  if (!normalizedAudioUrl)
  {
    return error(400, "The provided URL did not look like a direct audio file.");
  }

  const result = await createSongAsync({
    audioUrl: normalizedAudioUrl,
    songName,
    artist,
    uploaderName,
    deviceId
  });

  return json(result.value, { status: 201 });
}
