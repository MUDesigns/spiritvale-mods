# SpiritVale Mods

Public catalog for SpiritVale mods and Mod Manager releases. Hosted on Vercel with Blob storage.

## API

Unauthenticated:

- `GET /api/catalog` — all mods + latest app release
- `GET /api/mods/{id}` — one mod and version history
- `GET /api/app` — latest Mod Manager installer/portable

Authenticated (`Authorization: Bearer $PUBLISH_TOKEN`):

- `POST /api/upload` — `{ pathname, contentType }` → client token for Vercel Blob
- `PUT /api/mods/{id}/versions` — register a published zip
- `PUT /api/app/versions` — register an installer or portable build

Upload pathnames must be `mods/{id}/{version}/{filename}` or `app/{version}/{filename}`. After uploading to Blob with the client token, send the returned `url` as `downloadUrl`.

## Env

```
BLOB_READ_WRITE_TOKEN=
PUBLISH_TOKEN=
```

Create a Blob store in the Vercel project, then set both values in the project environment.

## Develop

```bash
npm install
npm run dev
```
