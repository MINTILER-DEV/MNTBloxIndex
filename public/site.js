const DEVICE_ID_STORAGE_KEY = "mntbloxindex-device-id";

export async function fetchSongs()
{
  const response = await fetch("/api/index", { cache: "no-store" });
  if (!response.ok)
  {
    throw new Error("Could not load the song index API.");
  }

  const body = await response.json();
  const songs = Array.isArray(body.songs) ? body.songs : [];
  return songs.map(normalizeSong);
}

export async function submitSong(body)
{
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const responseBody = await response.json();
  if (!response.ok)
  {
    throw new Error(responseBody.error || "Link submission failed.");
  }

  return normalizeSong(responseBody);
}

export function filterSongs(entries, filters)
{
  const normalizedQuery = normalizeText(filters.query);
  const normalizedArtist = normalizeText(filters.artist);
  const normalizedUploader = normalizeText(filters.uploader);
  const normalizedHost = normalizeText(filters.host);

  const filtered = entries.filter((song) =>
  {
    const matchesQuery = !normalizedQuery
      || [song.code, song.songName, song.artist, song.uploaderName, song.audioUrl, song.audioHost]
        .some((value) => normalizeText(value).includes(normalizedQuery));

    const matchesArtist = !normalizedArtist || normalizeText(song.artist) === normalizedArtist;
    const matchesUploader = !normalizedUploader || normalizeText(song.uploaderName) === normalizedUploader;
    const matchesHost = !normalizedHost || normalizeText(song.audioHost) === normalizedHost;

    return matchesQuery && matchesArtist && matchesUploader && matchesHost;
  });

  return sortSongs(filtered, filters.sort);
}

export function sortSongs(entries, sort = "newest")
{
  const cloned = [...entries];

  switch (sort)
  {
    case "oldest":
      cloned.sort((left, right) => getTimestamp(left) - getTimestamp(right));
      break;
    case "title":
      cloned.sort((left, right) => compareText(left.songName, right.songName));
      break;
    case "artist":
      cloned.sort((left, right) => compareText(left.artist, right.artist) || compareText(left.songName, right.songName));
      break;
    case "code":
      cloned.sort((left, right) => compareText(left.code, right.code));
      break;
    case "newest":
    default:
      cloned.sort((left, right) => getTimestamp(right) - getTimestamp(left));
      break;
  }

  return cloned;
}

export function createSongCard(song, options = {})
{
  const article = document.createElement("article");
  article.className = options.compact ? "song-card song-card--compact" : "song-card";

  const topRow = document.createElement("div");
  topRow.className = "song-card__top";

  const identity = document.createElement("div");
  identity.className = "song-card__identity";

  const code = document.createElement("button");
  code.type = "button";
  code.className = "song-code";
  code.textContent = song.code;
  code.title = "Copy song code";
  code.addEventListener("click", async () =>
  {
    try
    {
      await navigator.clipboard.writeText(song.code);
      code.textContent = "COPIED";
      window.setTimeout(() =>
      {
        code.textContent = song.code;
      }, 1200);
    }
    catch
    {
      code.textContent = song.code;
    }
  });

  const textWrap = document.createElement("div");
  textWrap.className = "song-card__text";

  const title = document.createElement("h3");
  title.className = "song-title";
  title.textContent = song.songName;

  const meta = document.createElement("p");
  meta.className = "song-meta";
  meta.textContent = buildMetaLine(song);

  const subMeta = document.createElement("p");
  subMeta.className = "song-submeta";
  subMeta.textContent = song.uploaderName
    ? `Uploaded by ${song.uploaderName}`
    : `Source host ${song.audioHost}`;

  textWrap.append(title, meta, subMeta);
  identity.append(code, textWrap);

  const actions = document.createElement("div");
  actions.className = "song-card__actions";

  const openLink = document.createElement("a");
  openLink.className = "action-link";
  openLink.href = song.audioUrl;
  openLink.target = "_blank";
  openLink.rel = "noreferrer";
  openLink.textContent = "Open";

  actions.append(openLink);
  topRow.append(identity, actions);

  const audio = document.createElement("audio");
  audio.className = "song-preview";
  audio.controls = true;
  audio.preload = "none";
  audio.src = song.audioUrl;

  article.append(topRow, audio);
  return article;
}

export function getStoredDeviceId()
{
  return localStorage.getItem(DEVICE_ID_STORAGE_KEY) ?? "";
}

export function storeDeviceId(deviceId)
{
  const normalizedDeviceId = `${deviceId ?? ""}`.trim();
  if (!normalizedDeviceId)
  {
    return;
  }

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, normalizedDeviceId);
}

export function uniqueValues(values)
{
  return [...new Set(values
    .map((value) => `${value ?? ""}`.trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function normalizeSong(song)
{
  const audioHost = getAudioHost(song.audioUrl);

  return {
    code: `${song.code ?? ""}`.trim().toUpperCase(),
    songName: `${song.songName ?? ""}`.trim(),
    artist: `${song.artist ?? ""}`.trim(),
    uploaderName: `${song.uploaderName ?? ""}`.trim(),
    uploadedAt: song.uploadedAt ?? "",
    audioUrl: `${song.audioUrl ?? ""}`.trim(),
    audioHost
  };
}

function buildMetaLine(song)
{
  const segments = [song.artist, song.audioHost];
  if (song.uploadedAt)
  {
    segments.push(formatDate(song.uploadedAt));
  }

  return segments.filter(Boolean).join(" / ");
}

function getAudioHost(url)
{
  try
  {
    return new URL(url).host;
  }
  catch
  {
    return "Unknown host";
  }
}

function normalizeText(value)
{
  return `${value ?? ""}`.trim().toLowerCase();
}

function getTimestamp(song)
{
  const parsed = Date.parse(song.uploadedAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareText(left, right)
{
  return `${left ?? ""}`.localeCompare(`${right ?? ""}`);
}

function formatDate(value)
{
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
  {
    return value;
  }

  return parsed.toLocaleDateString();
}
