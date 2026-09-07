import test from "node:test";
import assert from "node:assert/strict";
import { copyDeviceId, DEVICE_ID_STORAGE_KEY, initializeDeviceId, normalizeDeviceId, storeDeviceId } from "../public/device-id.js";

function memoryStorage(initial = "") {
  const entries = new Map(initial ? [[DEVICE_ID_STORAGE_KEY, initial]] : []);
  return { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
}

test("app identity wins, persists, and is removed from the address bar", () => {
  const storage = memoryStorage("browser-id");
  const result = initializeDeviceId("https://example.test/upload.html?q=keep#deviceId=app-id&section=audio", storage);
  assert.equal(result.id, "app-id");
  assert.equal(result.fromApp, true);
  assert.equal(result.persisted, true);
  assert.equal(result.cleanUrl, "/upload.html?q=keep#section=audio");
  assert.equal(initializeDeviceId("https://example.test/upload.html", storage).id, "app-id");
});

test("a direct first visit creates one ID and subsequent visits reuse it", () => {
  const storage = memoryStorage();
  assert.equal(initializeDeviceId("https://example.test/upload.html", storage, () => "generated-id").id, "generated-id");
  assert.equal(initializeDeviceId("https://example.test/upload.html", storage, () => { throw new Error("Must reuse saved ID"); }).id, "generated-id");
  assert.equal(storeDeviceId("pasted-id", storage), true);
  assert.equal(initializeDeviceId("https://example.test/upload.html", storage).id, "pasted-id");
});

test("invalid handoff cannot overwrite a valid saved identity", () => {
  const storage = memoryStorage("keep-me");
  for (const invalid of ["<script>", "a".repeat(65), "has spaces"]) {
    const result = initializeDeviceId(`https://example.test/upload.html#deviceId=${encodeURIComponent(invalid)}`, storage);
    assert.equal(result.id, "keep-me");
    assert.equal(result.fromApp, false);
    assert.equal(result.cleanUrl, "/upload.html");
  }
  assert.equal(normalizeDeviceId("  MNT_abc-123  "), "MNT_abc-123");
});

test("blocked browser storage leaves a usable, copyable in-memory ID", async () => {
  const blocked = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };
  const identity = initializeDeviceId("https://example.test/upload.html#deviceId=app-id", blocked);
  assert.equal(identity.id, "app-id"); assert.equal(identity.persisted, false);
  let copied;
  assert.equal(await copyDeviceId(identity.id, { writeText: async value => { copied = value; } }), true);
  assert.equal(copied, "app-id");
});

test("clipboard denial and invalid IDs return a manual-copy fallback", async () => {
  assert.equal(await copyDeviceId("app-id", null), false);
  assert.equal(await copyDeviceId("app-id", { writeText: async () => { throw new Error("Denied"); } }), false);
  assert.equal(await copyDeviceId("", { writeText: async () => { throw new Error("Should not be called"); } }), false);
});
