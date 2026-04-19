# MNTBloxIndex

Vercel-native companion repo for the public MNTBlox song index.

## What it does

- Serves a searchable static site from `public/`
- Uses Vercel Functions under `api/`
- Stores the canonical song index in Vercel Blob as a single JSON document
- Uses six-letter uppercase song codes such as `MKSDAF`
- Stores direct audio links instead of uploaded files
- Falls back to `public/data/index.json` during local development when a Blob token is not available

## Local development

```powershell
npm install
npm run dev
```

```powershell
npx vercel dev
```

### Local API

- `GET /api/index`
- `GET /api/songs/:code`
- `POST /api/upload`
  - JSON body: `audioUrl`, `songName`, `artist`, optional `uploaderName`, `deviceId`
- `DELETE /api/songs/:code?deviceId=...`

## Deploying to Vercel

1. Import this repo into Vercel.
2. Create a Vercel Blob store for the project.
3. Add the Blob read-write token to the project environment so the API routes can update the index.
4. Deploy.