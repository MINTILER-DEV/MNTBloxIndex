import path from "node:path";

const knownAudioExtensions = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".weba"
]);

export async function validateAudioUrlAsync(url)
{
  let parsedUrl;

  try
  {
    parsedUrl = new URL(url);
  }
  catch
  {
    return null;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol))
  {
    return null;
  }

  const headResponse = await fetch(parsedUrl, {
    method: "HEAD",
    redirect: "follow"
  }).catch(() => null);

  if (headResponse?.ok)
  {
    const contentType = `${headResponse.headers.get("content-type") ?? ""}`.toLowerCase();
    if (looksLikeAudioContentType(contentType))
    {
      return headResponse.url;
    }
  }

  const getResponse = await fetch(parsedUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      Range: "bytes=0-0"
    }
  }).catch(() => null);

  if (!getResponse || (!getResponse.ok && getResponse.status !== 206))
  {
    return null;
  }

  const contentType = `${getResponse.headers.get("content-type") ?? ""}`.toLowerCase();
  if (looksLikeAudioContentType(contentType))
  {
    return getResponse.url;
  }

  const extension = path.extname(new URL(getResponse.url).pathname).toLowerCase();
  return knownAudioExtensions.has(extension) ? getResponse.url : null;
}

function looksLikeAudioContentType(contentType)
{
  return contentType.startsWith("audio/")
    || contentType.includes("application/ogg");
}
