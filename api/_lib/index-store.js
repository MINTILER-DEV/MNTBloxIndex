import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

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

export async function createAccountAsync({ username, passwordHash, deviceId })
{
  return mutateIndexDocumentAsync((index) =>
  {
    if (index.accounts.some(account => account.username === username)) return { conflict: true };
    const account = { id: randomUUID(), username, passwordHash, createdAt: new Date().toISOString() };
    const migratedCount = migrateDeviceSongs(index, account.id, deviceId);
    index.accounts.push(account);
    return { index, value: { account, migratedCount } };
  });
}

export async function findAccountByUsernameAsync(username)
{
  const index = await readIndexDocumentAsync();
  return index.accounts.find(account => account.username === username) ?? null;
}

export async function findSongsByAccountAsync(accountId)
{
  const index = await readIndexDocumentAsync();
  return index.songs.filter(song => song.accountId === accountId);
}

export async function migrateDeviceSongsAsync(accountId, deviceId)
{
  if (!deviceId) return { value: 0 };
  return mutateIndexDocumentAsync(index => ({ index, value: migrateDeviceSongs(index, accountId, deviceId) }));
}

export async function createSongAsync({ linkedAssetId, audioUrl, songName, artist, uploaderName, accountId, consumeRateLimit })
{
  return mutateIndexDocumentAsync((index) =>
  {
    const rateLimit = consumeRateLimit?.(index);
    if (rateLimit?.response) return rateLimit;
    const code = generateUniqueCode(index.songs);
    const song = {
      code,
      linkedAssetId: normalizeAssetId(linkedAssetId),
      songName: songName.trim(),
      artist: artist.trim(),
      uploaderName: uploaderName?.trim() || "",
      accountId,
      uploadedByDeviceId: "",
      audioUrl,
      uploadedAt: new Date().toISOString()
    };

    index.songs.unshift(song);
    return { index, value: song };
  });
}

export async function deleteSongAsync(code, accountId, consumeRateLimit)
{
  const normalizedCode = normalizeSongCode(code);

  return mutateIndexDocumentAsync((index) =>
  {
    const songIndex = index.songs.findIndex((song) => song.code === normalizedCode);
    if (songIndex < 0)
    {
      return { notFound: true };
    }

    if (index.songs[songIndex].accountId !== accountId)
    {
      return { forbidden: true };
    }

    const rateLimit = consumeRateLimit?.(index);
    if (rateLimit?.response) return rateLimit;
    const [song] = index.songs.splice(songIndex, 1);
    return { index, value: song };
  });
}

export async function updateSongAsync(code, accountId, changes, consumeRateLimit)
{
  const normalizedCode = normalizeSongCode(code);
  return mutateIndexDocumentAsync(index =>
  {
    const song = index.songs.find(candidate => candidate.code === normalizedCode);
    if (!song) return { notFound: true };
    if (song.accountId !== accountId) return { forbidden: true };
    const rateLimit = consumeRateLimit?.(index);
    if (rateLimit?.response) return rateLimit;
    Object.assign(song, {
      linkedAssetId: normalizeAssetId(changes.linkedAssetId), audioUrl: changes.audioUrl,
      songName: changes.songName.trim(), artist: changes.artist.trim(), uploaderName: changes.uploaderName?.trim() || "",
      updatedAt: new Date().toISOString(), invalidSince: ""
    });
    return { index, value: song };
  });
}

export async function checkSongsAsync(validateSong, now = new Date())
{
  return mutateIndexDocumentAsync(async index => {
    let deleted = 0; let markedInvalid = 0;
    const kept = [];
    for (const song of index.songs) {
      if (await validateSong(song)) { song.invalidSince = ""; kept.push(song); continue; }
      const invalidSince = Date.parse(song.invalidSince || "") || now.getTime();
      if (now.getTime() - invalidSince >= 6 * 60 * 60 * 1000) { deleted++; continue; }
      song.invalidSince = new Date(invalidSince).toISOString(); markedInvalid++; kept.push(song);
    }
    index.songs = kept;
    return { index, value: { deleted, markedInvalid } };
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
  let result = mutator(cloneIndex(snapshot.index));

  if (result && typeof result.then === "function") result = await result;
  if (result?.notFound || result?.forbidden || result?.conflict || result?.response)
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
          accountId: `${song.accountId ?? ""}`.trim(),
          audioUrl: `${song.audioUrl ?? ""}`.trim(),
          uploadedAt: `${song.uploadedAt ?? ""}`.trim(), updatedAt: `${song.updatedAt ?? ""}`.trim(), invalidSince: `${song.invalidSince ?? ""}`.trim()
        }))
        .filter((song) => song.code && song.songName && song.artist && song.audioUrl)
    : [];

  return {
    schemaVersion: 3, songs,
    accounts: Array.isArray(value?.accounts) ? value.accounts.filter(account => account?.id && account?.username && account?.passwordHash).map(account => ({ id: `${account.id}`, username: `${account.username}`, passwordHash: `${account.passwordHash}`, createdAt: `${account.createdAt ?? ""}` })) : [],
    rateLimits: typeof value?.rateLimits === "object" && value.rateLimits ? value.rateLimits : {}
  };
}

function createEmptyIndexDocument()
{
  return {
    schemaVersion: 3, songs: [], accounts: [], rateLimits: {}
  };
}

function migrateDeviceSongs(index, accountId, deviceId)
{
  const normalizedDeviceId = `${deviceId ?? ""}`.trim();
  if (!normalizedDeviceId) return 0;
  let count = 0;
  for (const song of index.songs) {
    if (!song.accountId && song.uploadedByDeviceId === normalizedDeviceId) { song.accountId = accountId; song.uploadedByDeviceId = ""; count++; }
  }
  return count;
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
