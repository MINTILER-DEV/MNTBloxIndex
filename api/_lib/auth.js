import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { error } from "./http.js";

const scrypt = promisify(scryptCallback);
const tokenLifetimeSeconds = 60 * 60 * 24 * 7;

export function normalizeUsername(value) {
  const username = `${value ?? ""}`.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{2,31}$/.test(username) ? username : "";
}

export function validatePassword(value) {
  return typeof value === "string" && value.length >= 10 && value.length <= 200;
}

export async function hashPasswordAsync(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPasswordAsync(password, hash) {
  const [scheme, salt, encoded] = `${hash ?? ""}`.split("$");
  if (scheme !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSession(account) {
  const payload = Buffer.from(JSON.stringify({ sub: account.id, username: account.username, exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getSession(request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session?.sub && session?.username && Number(session.exp) > Math.floor(Date.now() / 1000) ? session : null;
  } catch { return null; }
}

export function requireSession(request) {
  const session = getSession(request);
  return session ? { session } : { response: error(401, "Sign in to manage audio.") };
}

function sign(value) {
  // Production must set this. The fallback only keeps local development usable.
  const secret = process.env.AUTH_SESSION_SECRET?.trim() || "local-development-secret-change-before-deploy";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
