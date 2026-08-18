# SpiritVale Mods

Public catalog for SpiritVale mods and Mod Manager releases. Hosted on Vercel with Blob storage, Clerk auth, and Neon metadata.

## API

Unauthenticated:

- `GET /api/catalog` — all live mods + latest app release
- `GET /api/mods/{id}` — one mod, live version history, screenshots, thumbnail, and download count
- `GET /api/mods/{id}/download` — increment that mod's download count (all versions share one total) and redirect to the zip
- `GET /api/app` — latest Mod Manager installer/portable

Authenticated (`Authorization: Bearer $PUBLISH_TOKEN`):

- `POST /api/upload` — `{ pathname, contentType }` → client token for Vercel Blob
- `PUT /api/mods/{id}/versions` — register a published zip (trusted publisher path, no scan)
- `PUT /api/app/versions` — register an installer or portable build

Community (Clerk session or user API key):

- `GET /api/v1/me` — confirm an API key
- `GET /api/v1/me/mods` — your mods and version statuses
- `DELETE /api/v1/me/mods/{id}` — delete a listing you own, including all files
- `DELETE /api/v1/me/mods/{id}/versions/{version}` — delete one uploaded file
- `POST /api/v1/uploads` — `{ id, version, filename }` → Blob client token for a private zip (50 MB max)
- `POST /api/v1/mods` — register the uploaded zip; queued for VirusTotal and live after a clean scan
- `POST /api/community/upload-token` — browser Blob client token
- `POST /api/community/publish` — same scan queue as `/api/v1/mods`
- `POST /api/community/image-upload-token` — browser Blob client token for a screenshot
- `GET`/`POST`/`PATCH /api/community/mods/{id}/images` — list, register, or set the thumbnail
- `DELETE /api/community/mods/{id}/images/{imageId}` — remove a screenshot
- `DELETE /api/community/mods/{id}` — session: delete a listing you own
- `DELETE /api/community/mods/{id}/versions/{version}` — session: delete one uploaded file

Community upload endpoints allow 4 requests per 5 seconds per account. There is no hourly upload cap.

Catalog admin (`matt03803@gmail.com`, plus emails granted at `/admin`, `ADMIN_EMAILS`, and `ADMIN_ALERT_EMAIL`):

- `/admin` — review quarantined/scanning uploads, approve them onto the catalog, edit and delete any listing, and grant admin to other accounts
- `GET`/`POST`/`DELETE /api/admin/admins` — list, grant, or revoke catalog admins
- `POST /api/community/mods/{id}/versions/{version}/approve` — session: promote a quarantined or scanning zip

Create and revoke keys at `/account`. Example scripts: [spiritvale-mod-devkit](https://github.com/MUDesigns/spiritvale-mod-devkit).

Upload pathnames for the publisher must be `mods/{id}/{version}/{filename}` or `app/{version}/{filename}`. Community zips use `quarantine/{userId}/{uploadId}/{filename.zip}` until a clean scan copies them to `mods/...`.

## Env

See `.env.example`. Required for production community uploads:

- `BLOB_READ_WRITE_TOKEN`, `PUBLISH_TOKEN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `VIRUSTOTAL_API_KEY`
- `RESEND_API_KEY` (scan-failure mail to `ADMIN_ALERT_EMAIL`)
- `ADMIN_EMAILS` (optional comma-separated extra catalog admins; `matt03803@gmail.com` is always included)

In the Clerk dashboard enable Email/password, Google, and Discord. Add `https://spiritvalemods.com/sign-in`, `/sign-up`, and `/sso-callback` plus Clerk's provided callback URLs.

## Develop

```bash
npm install
npm run dev
```

Owners add screenshots from `/me` (admins can also do this on `/admin`). Uploads are PNG, JPEG, WebP, or GIF, 8 MB each, 16 per mod. One image can be the thumbnail shown next to the title in the catalog.

To copy existing images from mapped Nexus listings into Blob + Postgres:

```bash
node scripts/sync-nexus-images.mjs
```

Uses the same `%APPDATA%/com.matt0.spiritvale-mod-publisher/nexus-map.json` as `scripts/sync-nexus-descriptions.mjs`. Mods that already have screenshots are left alone unless you pass `--force`.
