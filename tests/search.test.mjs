import test from "node:test";
import assert from "node:assert/strict";
import { searchIndex } from "../api/_lib/search.js";
import { GET } from "../api/index.js";
const document = { songs: [
  { code: "ABCDEF", songName: "Night Drive", artist: "Mint", linkedAssetId: "123", uploadedAt: "2026-01-01" },
  { code: "GHIJKL", songName: "Morning", artist: "Other", linkedAssetId: "456", uploadedAt: "2026-02-01" }
] };
test("search matches terms across title and artist, case insensitive", () => {
  assert.equal(searchIndex(document, "MINT night").songs[0].code, "ABCDEF");
  assert.equal(searchIndex(document, "123").songs[0].code, "ABCDEF");
  assert.equal(searchIndex(document, "ghijkl").songs[0].code, "GHIJKL");
  assert.equal(searchIndex(document, "missing").songs.length, 0);
});
test("limit preserves total and newest ordering without mutating storage", () => {
  const result = searchIndex(document, "", 1);
  assert.equal(result.total, 2); assert.equal(result.songs.length, 1);
  assert.equal(result.songs[0].code, "GHIJKL"); assert.equal(document.songs[0].code, "ABCDEF");
});
test("API rejects invalid limits and oversized queries before accessing storage", async () => {
  for (const query of ["limit=0", "limit=501", "limit=NaN", "limit=1.5", `q=${"a".repeat(201)}`])
    assert.equal((await GET(new Request(`https://example.test/api/index?${query}`))).status, 400);
});
