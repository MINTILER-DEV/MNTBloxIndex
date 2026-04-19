import {
  createSongCard,
  fetchSongs,
  filterSongs,
  uniqueValues
} from "./site.js";

const searchInput = document.querySelector("#search-input");
const artistFilter = document.querySelector("#artist-filter");
const uploaderFilter = document.querySelector("#uploader-filter");
const hostFilter = document.querySelector("#host-filter");
const sortFilter = document.querySelector("#sort-filter");
const refreshButton = document.querySelector("#refresh-button");
const clearFiltersButton = document.querySelector("#clear-filters-button");
const resultsContainer = document.querySelector("#results");
const resultSummary = document.querySelector("#result-summary");

let songs = [];

const query = new URLSearchParams(window.location.search);
searchInput.value = query.get("q") ?? "";

await loadSongs();

searchInput.addEventListener("input", render);
artistFilter.addEventListener("change", render);
uploaderFilter.addEventListener("change", render);
hostFilter.addEventListener("change", render);
sortFilter.addEventListener("change", render);

refreshButton.addEventListener("click", async () =>
{
  await loadSongs();
});

clearFiltersButton.addEventListener("click", () =>
{
  searchInput.value = "";
  artistFilter.value = "";
  uploaderFilter.value = "";
  hostFilter.value = "";
  sortFilter.value = "newest";
  render();
});

async function loadSongs()
{
  resultSummary.textContent = "Loading songs...";

  try
  {
    songs = await fetchSongs();
    hydrateFilters(songs);
    render();
  }
  catch (error)
  {
    songs = [];
    resultsContainer.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = error instanceof Error
      ? error.message
      : "Could not load songs.";
    resultsContainer.append(emptyState);
    resultSummary.textContent = "0 songs";
  }
}

function hydrateFilters(entries)
{
  const previousArtist = artistFilter.value;
  const previousUploader = uploaderFilter.value;
  const previousHost = hostFilter.value;

  populateSelect(artistFilter, uniqueValues(entries.map((song) => song.artist)));
  populateSelect(uploaderFilter, uniqueValues(entries.map((song) => song.uploaderName)));
  populateSelect(hostFilter, uniqueValues(entries.map((song) => song.audioHost)));

  artistFilter.value = previousArtist;
  uploaderFilter.value = previousUploader;
  hostFilter.value = previousHost;
}

function populateSelect(element, values)
{
  element.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  element.append(allOption);

  for (const value of values)
  {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.append(option);
  }
}

function render()
{
  const filteredSongs = filterSongs(songs, {
    query: searchInput.value,
    artist: artistFilter.value,
    uploader: uploaderFilter.value,
    host: hostFilter.value,
    sort: sortFilter.value
  });

  const searchParams = new URLSearchParams();
  if (searchInput.value.trim())
  {
    searchParams.set("q", searchInput.value.trim());
  }

  const nextUrl = searchParams.toString()
    ? `${window.location.pathname}?${searchParams.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);

  resultsContainer.innerHTML = "";
  resultSummary.textContent = `${filteredSongs.length} song${filteredSongs.length === 1 ? "" : "s"} shown`;

  if (filteredSongs.length === 0)
  {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No songs matched those filters.";
    resultsContainer.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const song of filteredSongs)
  {
    fragment.append(createSongCard(song));
  }

  resultsContainer.append(fragment);
}
