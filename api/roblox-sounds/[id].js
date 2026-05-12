import { validateAudioUrlAsync } from "../_lib/audio-url.js";
import { error, json } from "../_lib/http.js";

const robloxAssetTypeId = 3;

export async function GET(_request, context)
{
  const assetId = resolveAssetId(_request, context);
  if (!assetId || !/^\d+$/.test(assetId))
  {
    return error(400, "Roblox sound ID must contain digits only.");
  }

  try
  {
    const [economyDetails, toolboxDetails] = await Promise.all([
      fetchEconomyDetailsAsync(assetId),
      fetchToolboxDetailsAsync(assetId)
    ]);

    if (!isAudioAsset(economyDetails, toolboxDetails))
    {
      return error(400, "That Roblox asset does not look like an audio asset.");
    }

    const audioUrl = `https://assetdelivery.roblox.com/v1/asset?id=${assetId}`;
    const validatedAudioUrl = await validateAudioUrlAsync(audioUrl);
    if (!validatedAudioUrl)
    {
      return error(400, "That Roblox sound could not be resolved into a playable audio URL.");
    }

    const songName = firstNonEmpty(
      toolboxDetails?.asset?.audioDetails?.title,
      toolboxDetails?.asset?.name,
      economyDetails?.Name,
      `Roblox Sound ${assetId}`);

    const artist = firstNonEmpty(
      toolboxDetails?.asset?.audioDetails?.artist,
      toolboxDetails?.creator?.name,
      economyDetails?.Creator?.Name,
      "Unknown Artist");

    const creatorName = firstNonEmpty(
      toolboxDetails?.creator?.name,
      economyDetails?.Creator?.Name,
      artist);

    return json({
      assetId,
      audioUrl,
      songName,
      artist,
      creatorName
    });
  }
  catch (lookupError)
  {
    return error(502, lookupError instanceof Error ? lookupError.message : "Roblox sound lookup failed.");
  }
}

async function fetchEconomyDetailsAsync(assetId)
{
  const response = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok)
  {
    throw new Error("Roblox economy details lookup failed.");
  }

  return response.json();
}

async function fetchToolboxDetailsAsync(assetId)
{
  const response = await fetch(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${assetId}`, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok)
  {
    return null;
  }

  const body = await response.json();
  return Array.isArray(body?.data) ? body.data[0] ?? null : null;
}

function isAudioAsset(economyDetails, toolboxDetails)
{
  return economyDetails?.AssetTypeId === robloxAssetTypeId
    || toolboxDetails?.asset?.typeId === robloxAssetTypeId;
}

function firstNonEmpty(...values)
{
  for (const value of values)
  {
    const normalizedValue = `${value ?? ""}`.trim();
    if (normalizedValue)
    {
      return normalizedValue;
    }
  }

  return "";
}

function resolveAssetId(request, context)
{
  const directParam = `${context?.params?.id ?? ""}`.trim();
  if (directParam)
  {
    return directParam;
  }

  try
  {
    const requestUrl = new URL(request?.url ?? "http://localhost/");
    const queryParam = `${requestUrl.searchParams.get("id") ?? ""}`.trim();
    if (queryParam)
    {
      return queryParam;
    }

    const pathnameSegments = requestUrl.pathname.split("/").filter(Boolean);
    return `${pathnameSegments[pathnameSegments.length - 1] ?? ""}`.trim();
  }
  catch
  {
    return "";
  }
}
