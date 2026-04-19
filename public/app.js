const searchInput = document.querySelector("#search-input");
const refreshButton = document.querySelector("#refresh-button");
const resultSummary = document.querySelector("#result-summary");
const resultsContainer = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");
const uploadForm = document.querySelector("#upload-form");
const uploadStatus = document.querySelector("#upload-status");

let songs = [];

await refreshSongs();

searchInput.addEventListener("input", () =>
{
  renderSongs(filterSongs(searchInput.value));
});

refreshButton.addEventListener("click", async () =>
{
  await refreshSongs();
});

uploadForm.addEventListener("submit", async (event) =>
{
  event.preventDefault();

  uploadStatus.textContent = "Submitting...";
  const body = Object.fromEntries(new FormData(uploadForm).entries());

  try
  {
    const response = await fetch("./api/upload", {
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

    uploadForm.reset();
    uploadStatus.textContent = `Saved ${responseBody.songName} as ${responseBody.code}.`;
    await refreshSongs();
  }
  catch (error)
  {
    uploadStatus.textContent = error instanceof Error
      ? error.message
      : "Link submission failed. The GitHub Pages build is read-only unless a live API is available.";
  }
});

async function refreshSongs()
{
  resultSummary.textContent = "Loading songs...";

  try
  {
    const response = await fetch("./data/index.json", { cache: "no-store" });
    if (!response.ok)
    {
      throw new Error("Could not load the JSON song index.");
    }

    const body = await response.json();
    songs = Array.isArray(body.songs) ? body.songs : [];
    renderSongs(filterSongs(searchInput.value));
  }
  catch (error)
  {
    songs = [];
    resultsContainer.innerHTML = `<div class="empty-state">${escapeHtml(error instanceof Error ? error.message : "Index load failed.")}</div>`;
    resultSummary.textContent = "0 songs";
  }
}

function filterSongs(query)
{
  const trimmedQuery = `${query || ""}`.trim().toLowerCase();
  if (!trimmedQuery)
  {
    return songs;
  }

  return songs.filter((song) =>
  {
    return [song.code, song.songName, song.artist, song.uploaderName, song.audioUrl]
      .filter(Boolean)
      .some((value) => `${value}`.toLowerCase().includes(trimmedQuery));
  });
}

function renderSongs(entries)
{
  resultsContainer.innerHTML = "";
  resultSummary.textContent = `${entries.length} song${entries.length === 1 ? "" : "s"}`;

  if (entries.length === 0)
  {
    resultsContainer.innerHTML = `<div class="empty-state">No songs matched that search yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const song of entries)
  {
    const node = resultTemplate.content.cloneNode(true);
    node.querySelector(".result-code").textContent = song.code;
    node.querySelector(".result-title").textContent = song.songName;
    node.querySelector(".result-meta").textContent = `${song.artist}${song.uploadedAt ? ` - ${formatDate(song.uploadedAt)}` : ""}`;
    node.querySelector(".result-uploader").textContent = song.uploaderName
      ? `Uploaded by ${song.uploaderName}`
      : "Uploader name not provided";

    const link = node.querySelector(".result-link");
    link.href = song.audioUrl;

    fragment.appendChild(node);
  }

  resultsContainer.appendChild(fragment);
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

function escapeHtml(value)
{
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
