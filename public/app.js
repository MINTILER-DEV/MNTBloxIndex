import {
  createSongCard,
  fetchSongs,
  getStoredDeviceId,
  sortSongs,
  storeDeviceId,
  submitSong
} from "./site.js";

const uploadForm = document.querySelector("#upload-form");
const uploadStatus = document.querySelector("#upload-status");
const deviceIdInput = document.querySelector("#device-id");
const resultsContainer = document.querySelector("#results");
const resultSummary = document.querySelector("#result-summary");

if (deviceIdInput)
{
  deviceIdInput.value = getStoredDeviceId();
}

await refreshSongs();

uploadForm.addEventListener("submit", async (event) =>
{
  event.preventDefault();

  uploadStatus.textContent = "Submitting...";
  const body = Object.fromEntries(new FormData(uploadForm).entries());
  storeDeviceId(body.deviceId);

  try
  {
    const uploadedSong = await submitSong(body);
    uploadStatus.textContent = `Saved ${uploadedSong.songName} as ${uploadedSong.code}.`;
    uploadForm.reset();

    if (deviceIdInput)
    {
      deviceIdInput.value = getStoredDeviceId();
    }

    await refreshSongs();
  }
  catch (error)
  {
    uploadStatus.textContent = error instanceof Error
      ? error.message
      : "Link submission failed.";
  }
});

async function refreshSongs()
{
  resultSummary.textContent = "Loading songs...";

  try
  {
    const songs = await fetchSongs();
    const recentSongs = sortSongs(songs, "newest").slice(0, 8);
    renderSongs(recentSongs);
    resultSummary.textContent = `${recentSongs.length} recent song${recentSongs.length === 1 ? "" : "s"}`;
  }
  catch (error)
  {
    resultsContainer.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = error instanceof Error
      ? error.message
      : "Index load failed.";
    resultsContainer.append(emptyState);
    resultSummary.textContent = "0 songs";
  }
}

function renderSongs(entries)
{
  resultsContainer.innerHTML = "";

  if (entries.length === 0)
  {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No songs are in the index yet.";
    resultsContainer.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const song of entries)
  {
    fragment.append(createSongCard(song, { compact: true }));
  }

  resultsContainer.append(fragment);
}
