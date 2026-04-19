# MNTBloxIndex

Node-based companion repo for the public MNTBlox song index.

## What it does

- Serves a searchable static site from `public/`
- Stores song metadata in `public/data/index.json`
- Uses six-letter uppercase song codes such as `MKSDAF`
- Stores direct audio links instead of uploaded files
- Provides a local Node API for submit and delete flows during development
- Builds a static `dist/` folder for GitHub Pages deployment

## Local development

```powershell
npm install
npm run dev
```

The local site runs on `http://localhost:3000`.

### Local API

- `GET /api/index`
- `GET /api/songs/:code`
- `POST /api/upload`
  - JSON body: `audioUrl`, `songName`, `artist`, optional `uploaderName`, `deviceId`
- `DELETE /api/songs/:code?deviceId=...`

The GitHub Pages deployment is read-only. Search and code resolution work there because they read `public/data/index.json`, but upload and delete need a live Node API somewhere else.
