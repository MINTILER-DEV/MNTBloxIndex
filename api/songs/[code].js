import { error, json } from "../_lib/http.js";
import { deleteSongAsync, findSongByCodeAsync } from "../_lib/index-store.js";
import { updateSongAsync } from "../_lib/index-store.js";
import { requireSession } from "../_lib/auth.js";
import { consumeRateLimit } from "../_lib/rate-limit.js";
import { validateAudioUrlAsync } from "../_lib/audio-url.js";

export async function GET(request)
{
  const code = getCodeFromRequest(request);
  if (!code)
  {
    return error(400, "Song code is required.");
  }

  const song = await findSongByCodeAsync(code);
  if (!song)
  {
    return error(404, "Song code was not found.");
  }

  return json(song);
}

export async function DELETE(request)
{
  const code = getCodeFromRequest(request);
  if (!code)
  {
    return error(400, "Song code is required.");
  }

  const auth = requireSession(request); if (auth.response) return auth.response;

  const result = await deleteSongAsync(code, auth.session.sub, index => consumeRateLimit(index, `delete:${auth.session.sub}`, 5, 30_000));
  if (result.response) return result.response;
  if (result.notFound)
  {
    return error(404, "Song code was not found.");
  }

  if (result.forbidden)
  {
    return error(403, "This device is not allowed to delete that submission.");
  }

  return json({
    ok: true,
    code: result.value.code
  });
}

export async function PUT(request)
{
  const code = getCodeFromRequest(request); if (!code) return error(400, "Song code is required.");
  const auth = requireSession(request); if (auth.response) return auth.response;
  let body; try { body = await request.json(); } catch { return error(400, "Request body must be valid JSON."); }
  const linkedAssetId = `${body?.linkedAssetId ?? ""}`.trim().replace(/^rbxassetid:\/\//i, "");
  const audioUrl = await validateAudioUrlAsync(`${body?.audioUrl ?? ""}`.trim());
  const songName = `${body?.songName ?? ""}`.trim(); const artist = `${body?.artist ?? ""}`.trim();
  if (!/^\d+$/.test(linkedAssetId) || !audioUrl || !songName || !artist) return error(400, "Provide a Roblox sound ID, working audio URL, song name, and artist.");
  const result = await updateSongAsync(code, auth.session.sub, { linkedAssetId, audioUrl, songName, artist, uploaderName: `${body?.uploaderName ?? ""}` }, index => consumeRateLimit(index, `edit:${auth.session.sub}`, 10, 60_000));
  if (result.response) return result.response;
  if (result.notFound) return error(404, "Song code was not found."); if (result.forbidden) return error(403, "You can only edit your own submissions.");
  return json(result.value);
}

function getCodeFromRequest(request)
{
  const { pathname } = new URL(request.url);
  return pathname.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? "";
}
