import { error, json } from "../_lib/http.js";
import { deleteSongAsync, findSongByCodeAsync } from "../_lib/index-store.js";

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

  const { searchParams } = new URL(request.url);
  const deviceId = `${searchParams.get("deviceId") ?? ""}`.trim();
  if (!deviceId)
  {
    return error(400, "deviceId is required.");
  }

  const result = await deleteSongAsync(code, deviceId);
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

function getCodeFromRequest(request)
{
  const { pathname } = new URL(request.url);
  return pathname.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? "";
}
