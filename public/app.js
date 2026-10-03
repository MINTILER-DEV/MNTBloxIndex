import { autofillFromRobloxSoundId, createSongCard, fetchSongs, sortSongs, submitSong } from "./site.js";
import { copyDeviceId, initializeDeviceId, normalizeDeviceId, storeDeviceId } from "./device-id.js";
import { deleteSong, fetchMySongs, updateSong } from "./site.js";
import { authenticate, clearSession, getSession } from "./account.js";

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
const accountStatus = document.querySelector("#account-status");
const usernameInput = document.querySelector("#account-username");
const passwordInput = document.querySelector("#account-password");
const signInButton = document.querySelector("#sign-in");
const createAccountButton = document.querySelector("#create-account");
const signOutButton = document.querySelector("#sign-out");
let session = getSession();
const myAudio = document.querySelector("#my-audio");
const myAudioList = document.querySelector("#my-audio-list");
const myAudioStatus = document.querySelector("#my-audio-status");

const identity = initializeDeviceId(window.location.href);
deviceIdInput.value = identity.id;
// Remove the handoff from the address bar before the user copies or shares the page URL.
window.history.replaceState(window.history.state, "", identity.cleanUrl);
function updateAccountUi(message = "") {
  const signedIn = Boolean(session?.token);
  accountStatus.textContent = message || (signedIn ? `Signed in as ${session.username}.` : "Sign in or create an account. Existing device submissions transfer when you sign in.");
  signInButton.hidden = signedIn; createAccountButton.hidden = signedIn; signOutButton.hidden = !signedIn;
  usernameInput.disabled = signedIn; passwordInput.disabled = signedIn; myAudio.hidden = !signedIn;
}
async function runAuth(mode) {
  try { session = await authenticate(mode, usernameInput.value, passwordInput.value, deviceIdInput.value); passwordInput.value = ""; updateAccountUi(session.migratedCount ? `Signed in as ${session.username}. Moved ${session.migratedCount} device submission(s).` : ""); await refreshMyAudio(); }
  catch (exception) { updateAccountUi(exception instanceof Error ? exception.message : "Authentication failed."); }
}
signInButton.addEventListener("click", () => runAuth("login"));
createAccountButton.addEventListener("click", () => runAuth("register"));
signOutButton.addEventListener("click", () => { clearSession(); session = null; updateAccountUi(); });
updateAccountUi();
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
  if (!session?.token) { updateAccountUi("Sign in before sharing audio."); return; }
  uploadButton.disabled = true;
  uploadButton.textContent = "Sharing…";
  uploadForm.setAttribute("aria-busy", "true");
  uploadStatus.textContent = "Checking your audio link…";
  successPanel.hidden = true;
  const body = Object.fromEntries(new FormData(uploadForm).entries());
  try {
    const song = await submitSong(body, session.token);
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
async function refreshMyAudio() {
  if (!session?.token) return;
  myAudioStatus.textContent = "Loading your submissions…";
  try {
    const songs = await fetchMySongs(session.token);
    myAudioList.replaceChildren(...songs.map(createManageCard));
    myAudioStatus.textContent = songs.length ? "Edit or delete your submissions." : "You have not shared any audio yet.";
  } catch (exception) { myAudioStatus.textContent = exception instanceof Error ? exception.message : "Could not load your audio."; }
}
function createManageCard(song) {
  const card = createSongCard(song); const actions = card.querySelector(".song-card__actions");
  const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
  edit.addEventListener("click", async () => {
    const songName = prompt("Song name", song.songName); if (songName === null) return;
    const artist = prompt("Artist", song.artist); const audioUrl = prompt("Direct audio URL", song.audioUrl); const linkedAssetId = prompt("Roblox sound ID to replace", song.linkedAssetId);
    try { await updateSong(song.code, { songName, artist, audioUrl, linkedAssetId, uploaderName: song.uploaderName }, session.token); await refreshMyAudio(); void refreshSongs(); }
    catch (exception) { alert(exception instanceof Error ? exception.message : "Could not update audio."); }
  });
  const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete";
  remove.addEventListener("click", async () => { if (!confirm(`Delete ${song.songName}?`)) return; try { await deleteSong(song.code, session.token); await refreshMyAudio(); void refreshSongs(); } catch (exception) { alert(exception instanceof Error ? exception.message : "Could not delete audio."); } });
  actions.append(edit, remove); return card;
}
void refreshSongs();
if (session?.token) void refreshMyAudio();
