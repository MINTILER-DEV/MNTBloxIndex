import { autofillFromRobloxSoundId, createSongCard, fetchSongs, sortSongs, submitSong } from "./site.js";
import { copyDeviceId, initializeDeviceId, normalizeDeviceId, storeDeviceId } from "./device-id.js";

const uploadForm = document.querySelector("#upload-form");
const uploadButton = document.querySelector("#upload-button");
const uploadStatus = document.querySelector("#upload-status");
const deviceIdInput = document.querySelector("#device-id");
const deviceStatus = document.querySelector("#device-id-status");
const resultsContainer = document.querySelector("#results");
const resultSummary = document.querySelector("#result-summary");
const audioUrlInput = document.querySelector("#audio-url");
const songNameInput = document.querySelector("#song-name");
const artistInput = document.querySelector("#artist");
const uploaderNameInput = document.querySelector("#uploader-name");
const robloxAssetIdInput = document.querySelector("#roblox-asset-id");
const autofillRobloxButton = document.querySelector("#autofill-roblox-button");
const autofillStatus = document.querySelector("#autofill-status");
const preview = document.querySelector("#upload-preview");
const successPanel = document.querySelector("#upload-success");
const copySongButton = document.querySelector("#copy-song-code");

const identity = initializeDeviceId(window.location.href);
deviceIdInput.value = identity.id;
// Remove the handoff from the address bar before the user copies or shares the page URL.
window.history.replaceState(window.history.state, "", identity.cleanUrl);
deviceStatus.textContent = !identity.persisted
  ? "Browser storage is unavailable. Copy this ID to keep it for next time."
  : identity.fromApp ? "Connected to your app. This ID is saved for next time." : "Your ID is saved in this browser. No need to reopen the app.";

function rememberDeviceId() {
  if (!deviceIdInput.checkValidity()) { deviceIdInput.reportValidity(); return false; }
  deviceIdInput.value = normalizeDeviceId(deviceIdInput.value);
  deviceStatus.textContent = storeDeviceId(deviceIdInput.value)
    ? "Device ID saved for your next visit." : "Copy this ID to keep it: browser storage is unavailable.";
  return true;
}
deviceIdInput.addEventListener("change", rememberDeviceId);
document.querySelector("#copy-device-id").addEventListener("click", async () => {
  if (!rememberDeviceId()) return;
  const copied = await copyDeviceId(deviceIdInput.value);
  deviceStatus.textContent = copied ? "Device ID copied." : "Select and copy the ID with Ctrl+C (or Command+C).";
  if (!copied) { deviceIdInput.focus(); deviceIdInput.select(); }
});

function updatePreview() {
  preview.pause();
  try {
    const url = new URL(audioUrlInput.value);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid audio URL");
    preview.src = url.href;
    preview.hidden = false;
  } catch { preview.removeAttribute("src"); preview.hidden = true; }
}
audioUrlInput.addEventListener("change", updatePreview);

autofillRobloxButton.addEventListener("click", async () => {
  if (autofillRobloxButton.disabled) return;
  autofillRobloxButton.disabled = true;
  autofillStatus.textContent = "Looking up the sound…";
  try {
    const autofill = await autofillFromRobloxSoundId(robloxAssetIdInput.value);
    audioUrlInput.value = autofill.audioUrl;
    songNameInput.value = autofill.songName;
    artistInput.value = autofill.artist;
    updatePreview();
    autofillStatus.textContent = "Audio details filled. Add the Roblox sound ID you want to replace below.";
  } catch (error) { autofillStatus.textContent = error instanceof Error ? error.message : "Couldn't find that sound. Try again."; }
  finally { autofillRobloxButton.disabled = false; }
});

uploadForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (uploadButton.disabled || !uploadForm.reportValidity() || !rememberDeviceId()) return;
  uploadButton.disabled = true;
  uploadButton.textContent = "Sharing…";
  uploadForm.setAttribute("aria-busy", "true");
  uploadStatus.textContent = "Checking your audio link…";
  successPanel.hidden = true;
  const body = Object.fromEntries(new FormData(uploadForm).entries());
  try {
    const song = await submitSong(body);
    uploadStatus.textContent = `Shared ${song.songName}.`;
    copySongButton.textContent = song.code;
    document.querySelector("#view-upload").href = `/?q=${encodeURIComponent(song.code)}`;
    document.querySelector("#song-code-status").textContent = "";
    successPanel.hidden = false;
    // Preserve the identity and credit fields, including when localStorage is unavailable.
    const currentId = deviceIdInput.value;
    const currentName = uploaderNameInput.value;
    uploadForm.reset();
    deviceIdInput.value = currentId;
    uploaderNameInput.value = currentName;
    autofillStatus.textContent = "";
    updatePreview();
    void refreshSongs();
    copySongButton.focus();
  } catch (error) { uploadStatus.textContent = error instanceof Error ? error.message : "Couldn't share this sound. Your details are still here; try again."; }
  finally { uploadButton.disabled = false; uploadButton.textContent = "Share sound"; uploadForm.removeAttribute("aria-busy"); }
});

copySongButton.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(copySongButton.textContent); document.querySelector("#song-code-status").textContent = "Song code copied."; }
  catch { document.querySelector("#song-code-status").textContent = `Copy this song code: ${copySongButton.textContent}`; }
});

async function refreshSongs() {
  resultSummary.textContent = "Loading sounds…";
  try {
    const songs = sortSongs(await fetchSongs(), "newest").slice(0, 3);
    resultsContainer.replaceChildren(...songs.map(song => createSongCard(song, { compact: true })));
    resultSummary.textContent = songs.length ? "Fresh from the community" : "Be the first to share a sound.";
  } catch {
    resultSummary.textContent = "Recent sounds are unavailable. You can still fill out your upload.";
  }
}
void refreshSongs();
