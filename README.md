# MNTBloxIndex

Public search and audio-link submissions for MNTBloxAudio.

- `/` and `/search.html`: centered search, live filtering, preview cards, and copyable song codes.
- `/upload.html`: guided audio-link submission with preview, Roblox metadata autofill, a remembered device ID, and copy buttons for device IDs and submitted song codes.
- Opening from MNTBloxAudio imports `#deviceId=...`, saves it to browser storage, and removes it from the URL. Direct visits reuse that ID or generate one on first use. Manual changes are saved immediately; blocked storage and clipboard access have fallbacks.
- `GET /api/index?q=...&limit=100`: optional multi-term search and result limit (1–500); omitting parameters preserves the complete index response.
- `GET /api/songs/:code`: direct code lookup used by the desktop application.

The original JSON fields remain compatible with existing desktop clients. Data stays in the existing private Vercel Blob store; deploying the website does not replace song data. Production writes require `BLOB_READ_WRITE_TOKEN` in Vercel's environment settings. Do not commit local environment files.

```sh
npm ci
npm test
npm run build
vercel --prod
```

The production build checks page presence and parses browser/API modules. Tests cover multi-term search, ordering, limits, and invalid API inputs. Animations respect reduced-motion preferences.
