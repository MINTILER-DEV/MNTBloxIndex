export const DEVICE_ID_STORAGE_KEY = "mntbloxindex-device-id";

export function normalizeDeviceId(value) {
  const id = `${value ?? ""}`.trim();
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : "";
}

export function getBrowserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function getStoredDeviceId(storage = getBrowserStorage()) {
  try { return normalizeDeviceId(storage?.getItem(DEVICE_ID_STORAGE_KEY)); } catch { return ""; }
}

export function storeDeviceId(value, storage = getBrowserStorage()) {
  const id = normalizeDeviceId(value);
  if (!id || !storage) return false;
  try { storage.setItem(DEVICE_ID_STORAGE_KEY, id); return true; } catch { return false; }
}

export function initializeDeviceId(url, storage = getBrowserStorage(), createId = () => crypto.randomUUID().replaceAll("-", "")) {
  const location = new URL(url);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const fromApp = normalizeDeviceId(fragment.get("deviceId"));
  const id = fromApp || getStoredDeviceId(storage) || normalizeDeviceId(createId());
  const persisted = storeDeviceId(id, storage);
  fragment.delete("deviceId");
  location.hash = fragment.toString();
  return { id, fromApp: Boolean(fromApp), persisted, cleanUrl: location.pathname + location.search + location.hash };
}

export async function copyDeviceId(value, clipboard = globalThis.navigator?.clipboard) {
  const id = normalizeDeviceId(value);
  if (!id || !clipboard) return false;
  try { await clipboard.writeText(id); return true; } catch { return false; }
}
