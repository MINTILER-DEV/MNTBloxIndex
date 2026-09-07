export function searchIndex(document, query = "", limit = null) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const songs = document.songs.filter(song => {
    const text = [song.code, song.linkedAssetId, song.songName, song.artist, song.uploaderName].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => (Date.parse(b.uploadedAt) || 0) - (Date.parse(a.uploadedAt) || 0));
  return { ...document, total: songs.length, songs: limit == null ? songs : songs.slice(0, limit) };
}
