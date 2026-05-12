import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobNotFoundError, get, put } from "@vercel/blob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..", "..");
const localIndexPath = path.join(rootDirectory, "public", "data", "index.json");
const blobIndexPath = "state/index.json";
const privateBlobAccess = "private";
export async function readIndexDocumentAsync()
{
  const snapshot = await readSnapshotAsync();
  return snapshot.index;
}

export async function findSongByCodeAsync(code)
{
  const normalizedCode = normalizeSongCode(code);
  const index = await readIndexDocumentAsync();
  return index.songs.find((song) => song.code === normalizedCode) ?? null;
}

export async function createSongAsync({ linkedAssetId, audioUrl, songName, artist, uploaderName, deviceId })
{
  return mutateIndexDocumentAsync((index) =>
  {
    const code = generateUniqueCode(index.songs);
    const song = {
      code,
      linkedAssetId: normalizeAssetId(linkedAssetId),
      songName: songName.trim(),
      artist: artist.trim(),
      uploaderName: uploaderName?.trim() || "",
      uploadedByDeviceId: deviceId.trim(),
      audioUrl,
      uploadedAt: new Date().toISOString()
    };

    index.songs.unshift(song);
    return { index, value: song };
  });
}

export async function deleteSongAsync(code, deviceId)
{
  const normalizedCode = normalizeSongCode(code);

  return mutateIndexDocumentAsync((index) =>
  {
    const songIndex = index.songs.findIndex((song) => song.code === normalizedCode);
    if (songIndex < 0)
    {
      return { notFound: true };
    }

    if (index.songs[songIndex].uploadedByDeviceId !== deviceId.trim())
    {
      return { forbidden: true };
    }

    const [song] = index.songs.splice(songIndex, 1);
    return { index, value: song };
  });
}

function hasBlobToken()
{
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function isVercelDeployment()
{
  const vercelEnvironment = `${process.env.VERCEL_ENV ?? ""}`.trim().toLowerCase();
  return vercelEnvironment === "production" || vercelEnvironment === "preview";
}

function canUseLocalFallback()
{
  return !hasBlobToken() && !isVercelDeployment();
}

async function readSnapshotAsync()
{
  return hasBlobToken()
    ? await readBlobSnapshotAsync()
    : await readLocalSnapshotAsync();
}

async function mutateIndexDocumentAsync(mutator)
{
  const snapshot = await readSnapshotAsync();
  const result = mutator(cloneIndex(snapshot.index));

  if (result?.notFound || result?.forbidden)
  {
    return result;
  }

  const nextIndex = normalizeIndexDocument(result.index);
  await writeSnapshotAsync(nextIndex);
  return { value: result.value, index: nextIndex };
}

async function readBlobSnapshotAsync()
{
  try
  {
    const response = await get(blobIndexPath, {
      access: privateBlobAccess,
      useCache: false
    });

    if (!response || response.statusCode !== 200 || !response.stream)
    {
      return { index: createEmptyIndexDocument(), etag: null };
    }

    const raw = await new Response(response.stream).text();
    return {
      index: parseIndex(raw),
      etag: response.blob.etag
    };
  }
  catch (error)
  {
    if (error instanceof BlobNotFoundError)
    {
      return { index: createEmptyIndexDocument(), etag: null };
    }

    throw error;
  }
}

async function writeSnapshotAsync(index)
{
  if (hasBlobToken())
  {
    await put(blobIndexPath, JSON.stringify(index, null, 2) + "\n", {
      access: privateBlobAccess,
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      contentType: "application/json"
    });
    return;
  }

  if (isVercelDeployment())
  {
    throw new Error(
      "This Vercel deployment is read-only because BLOB_READ_WRITE_TOKEN is missing. Connect a Vercel Blob store to this project before using uploads or deletes.");
  }

  await fs.mkdir(path.dirname(localIndexPath), { recursive: true });
  await fs.writeFile(localIndexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

async function readLocalSnapshotAsync()
{
  try
  {
    const raw = await fs.readFile(localIndexPath, "utf8");
    return { index: parseIndex(raw), etag: null };
  }
  catch
  {
    const empty = createEmptyIndexDocument();

    if (canUseLocalFallback())
    {
      await writeSnapshotAsync(empty);
    }

    return { index: empty, etag: null };
  }
}

function parseIndex(raw)
{
  try
  {
    return normalizeIndexDocument(JSON.parse(raw));
  }
  catch
  {
    return createEmptyIndexDocument();
  }
}

function normalizeIndexDocument(value)
{
  const songs = Array.isArray(value?.songs)
    ? value.songs
        .filter((song) => song && typeof song === "object")
        .map((song) => ({
          code: normalizeSongCode(song.code),
          linkedAssetId: normalizeAssetId(song.linkedAssetId),
          songName: `${song.songName ?? ""}`.trim(),
          artist: `${song.artist ?? ""}`.trim(),
          uploaderName: `${song.uploaderName ?? ""}`.trim(),
          uploadedByDeviceId: `${song.uploadedByDeviceId ?? ""}`.trim(),
          audioUrl: `${song.audioUrl ?? ""}`.trim(),
          uploadedAt: `${song.uploadedAt ?? ""}`.trim()
        }))
        .filter((song) => song.code && song.songName && song.artist && song.audioUrl)
    : [];

  return {
    schemaVersion: 2,
    songs
  };
}

function createEmptyIndexDocument()
{
  return {
    schemaVersion: 2,
    songs: []
  };
}

function generateUniqueCode(songs)
{
  const usedCodes = new Set(songs.map((song) => song.code));
  let code = "";

  do
  {
    code = Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
  }
  while (usedCodes.has(code));

  return code;
}

function normalizeSongCode(value)
{
  return `${value ?? ""}`.trim().toUpperCase();
}

function normalizeAssetId(value)
{
  let normalizedValue = `${value ?? ""}`.trim();
  if (normalizedValue.toLowerCase().startsWith("rbxassetid://"))
  {
    normalizedValue = normalizedValue.slice("rbxassetid://".length);
  }

  return /^\d+$/.test(normalizedValue) ? normalizedValue : "";
}

function cloneIndex(index)
{
  return structuredClone(index);
}
