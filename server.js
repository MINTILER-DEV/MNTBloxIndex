import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDirectory = path.join(__dirname, "public");
const dataDirectory = path.join(publicDirectory, "data");
const indexFilePath = path.join(dataDirectory, "index.json");

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

await ensureStoreAsync();

app.use(express.json());
app.use(express.static(publicDirectory));

app.get("/api/index", async (_request, response) =>
{
  const index = await readIndexAsync();
  response.json(index);
});

app.get("/api/songs/:code", async (request, response) =>
{
  const index = await readIndexAsync();
  const song = index.songs.find((entry) => entry.code === normalizeSongCode(request.params.code));

  if (!song)
  {
    response.status(404).json({ error: "Song code was not found." });
    return;
  }

  response.json(song);
});

app.post("/api/upload", async (request, response) =>
{
  try
  {
    const { audioUrl, songName, artist, uploaderName, deviceId } = request.body ?? {};

    if (!audioUrl?.trim() || !songName?.trim() || !artist?.trim() || !deviceId?.trim())
    {
      response.status(400).json({ error: "audioUrl, songName, artist, and deviceId are required." });
      return;
    }

    const normalizedAudioUrl = await validateAudioUrlAsync(audioUrl.trim());
    if (!normalizedAudioUrl)
    {
      response.status(400).json({ error: "The provided URL did not look like a direct audio file." });
      return;
    }

    const index = await readIndexAsync();
    const code = generateUniqueCode(index.songs);

    const song = {
      code,
      songName: songName.trim(),
      artist: artist.trim(),
      uploaderName: uploaderName?.trim() || "",
      uploadedByDeviceId: deviceId.trim(),
      audioUrl: normalizedAudioUrl,
      uploadedAt: new Date().toISOString()
    };

    index.songs.unshift(song);
    await writeIndexAsync(index);

    response.status(201).json(song);
  }
  catch (error)
  {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Upload failed."
    });
  }
});

app.delete("/api/songs/:code", async (request, response) =>
{
  const deviceId = `${request.query.deviceId ?? ""}`.trim();
  if (!deviceId)
  {
    response.status(400).json({ error: "deviceId is required." });
    return;
  }

  const code = normalizeSongCode(request.params.code);
  const index = await readIndexAsync();
  const songIndex = index.songs.findIndex((entry) => entry.code === code);

  if (songIndex < 0)
  {
    response.status(404).json({ error: "Song code was not found." });
    return;
  }

  const song = index.songs[songIndex];
  if (song.uploadedByDeviceId !== deviceId)
  {
    response.status(403).json({ error: "This device is not allowed to delete that upload." });
    return;
  }

  index.songs.splice(songIndex, 1);
  await writeIndexAsync(index);

  response.json({ ok: true, code });
});

app.get("*", (_request, response) =>
{
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.listen(port, () =>
{
  console.log(`MNTBloxIndex listening on http://localhost:${port}`);
});

async function ensureStoreAsync()
{
  await fs.mkdir(dataDirectory, { recursive: true });

  if (!fsSync.existsSync(indexFilePath))
  {
    await writeIndexAsync({ schemaVersion: 1, songs: [] });
  }
}

async function readIndexAsync()
{
  const raw = await fs.readFile(indexFilePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.songs))
  {
    return { schemaVersion: 1, songs: [] };
  }

  return parsed;
}

async function writeIndexAsync(index)
{
  await fs.writeFile(indexFilePath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

function normalizeSongCode(value)
{
  return `${value ?? ""}`.trim().toUpperCase();
}

function generateUniqueCode(songs)
{
  const usedCodes = new Set(songs.map((entry) => entry.code));
  let code = "";

  do
  {
    code = Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
  }
  while (usedCodes.has(code));

  return code;
}

async function validateAudioUrlAsync(url)
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

  if (!getResponse?.ok && getResponse?.status !== 206)
  {
    return null;
  }

  const contentType = `${getResponse.headers.get("content-type") ?? ""}`.toLowerCase();
  if (looksLikeAudioContentType(contentType))
  {
    return getResponse.url;
  }

  const extension = path.extname(parsedUrl.pathname).toLowerCase();
  return isKnownAudioExtension(extension) ? getResponse.url : null;
}

function looksLikeAudioContentType(contentType)
{
  return contentType.startsWith("audio/")
    || contentType.includes("application/ogg");
}

function isKnownAudioExtension(extension)
{
  return new Set([
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".oga",
    ".opus",
    ".wav",
    ".weba"
  ]).has(extension);
}
